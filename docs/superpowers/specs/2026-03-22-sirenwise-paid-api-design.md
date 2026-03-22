# SirenWise Paid API — Design Spec

**Date:** 2026-03-22
**Status:** Approved
**Projects:** `missile-analysis/mcp-server/` (backend), `missile-analysis/` (frontend)

## Purpose

Monetize the SirenWise MCP server as a developer API. Three payment paths: Stripe API keys, x402 pay-per-request (Base USDC), and MPP pay-per-request (Stripe cards / Tempo stablecoins). Public endpoint at `mcp.sirenwise.com`. Developer docs page at `sirenwise.com/developer`. Existing Poke tunnel stays untouched.

## Architecture

```
Developer (browser)                        Agent (MCP client)
    │                                           │
    ▼                                           ▼
sirenwise.com/developer                  mcp.sirenwise.com/mcp
(Next.js on Vercel)                      (Caddy → FastMCP on VPS :8001)
    │                                           │
    ├─ Stripe Checkout → API key          ├─ API key auth (Stripe customers)
    ├─ x402 info + code examples          ├─ x402 via _meta (Base USDC)
    └─ MPP info + code examples           └─ MPP via 402 flow (Stripe/Tempo)
                                                │
                                                ▼
                                          Turso (alerts: read-only, keys+usage: read-write)

Personal (unchanged):
    Poke tunnel → localhost:8001/mcp → free pass (no auth, no payment)
```

## Pricing

- **$0.01 per tool call** — flat rate regardless of which tool
- Three payment methods:
  1. **Stripe API key** — prepay via Stripe Checkout, get an API key, use until credit runs out
  2. **x402** — pay-per-request in USDC on Base, no API key needed, permissionless
  3. **MPP** — pay-per-request via Stripe (cards) or Tempo (stablecoins), no API key needed

## Payment Flows

### Flow 1: API Key (Stripe)

1. Developer visits `sirenwise.com/developer`
2. Clicks "Buy API Key" → redirected to Stripe Checkout ($10 for 1,000 requests)
3. On success, Stripe webhook fires → Vercel API route generates API key, stores in Turso `api_keys` table with 1,000 credit balance
4. Developer is redirected to success page showing their API key (one-time display)
5. Developer uses `Authorization: Bearer <key>` on `mcp.sirenwise.com/mcp`
6. Each tool call decrements credit balance. Key stops working at 0.

### Flow 2: x402 (Base USDC)

Uses x402's native MCP integration (`x402.mcp` package). Payment data flows via JSON-RPC `_meta` field, not HTTP headers.

1. MCP client calls a tool on `mcp.sirenwise.com/mcp` with no payment
2. Server returns `CallToolResult` with `isError: true` and payment requirements in `structuredContent`:
   - price: `$0.01`
   - scheme: `exact`
   - network: `eip155:8453` (Base mainnet)
   - token: USDC
   - payee: server's EVM address
3. Client signs EIP-3009 `transferWithAuthorization` using their wallet
4. Client retries with `_meta["x402/payment"]` containing the signed payload
5. Server calls Coinbase CDP facilitator `/verify` endpoint (synchronous)
6. If valid, server executes the tool
7. Server calls facilitator `/settle` to submit on-chain transaction
8. Returns tool result with `_meta["x402/payment-response"]` containing settlement receipt

**Server wallet:** Only needs a receiving address (no private key). Set via `EVM_PAY_TO_ADDRESS` env var.

**Facilitator:** Coinbase CDP at `https://api.cdp.coinbase.com/platform/v2/x402`. Free tier: 1,000 tx/month. Requires `COINBASE_CDP_API_KEY`.

**Future:** When Coinbase adds Arbitrum support to the facilitator, switch `network` to `eip155:42161`.

### Flow 3: MPP (Stripe / Tempo)

Uses MPP's HTTP 402 challenge-response flow.

1. MCP client calls a tool on `mcp.sirenwise.com/mcp` with no auth
2. Server responds with HTTP 402 + `WWW-Authenticate: MPP` header + JSON body with payment challenge (price: $0.01, accepted methods: Stripe card, Tempo stablecoin)
3. Client fulfills payment (Stripe payment intent or Tempo on-chain)
4. Client retries with `Authorization: MPP <credential>` header
5. Server verifies credential, executes tool, returns result + `Receipt` header

**Dependencies:** `mppx` (TypeScript) for the protocol handling, or `pympp` (Python, early). Stripe secret key for card payments. MPP secret key for credential verification.

### Auth Priority (in server request handling)

1. **Localhost** (Poke tunnel) → free pass, serve immediately
2. **`Authorization: Bearer <key>`** → validate API key in Turso, check credit balance, serve
3. **`_meta["x402/payment"]`** in JSON-RPC body → verify via x402 facilitator, serve
4. **`Authorization: MPP <credential>`** → verify via MPP, serve
5. **None of the above** → return payment requirements (x402 format in tool result + MPP 402 challenge)

## Server Changes

### Modified files

**`mcp-server/server.py`** — Replace `validate_api_key()` with `payments.check_access()` in each tool function. Switch from `mcp.run()` to ASGI export via `mcp.http_app()` wrapped in a Starlette app with MPP middleware. Run with uvicorn directly: `uvicorn server:app --host 127.0.0.1 --port 8001`. The systemd ExecStart changes accordingly. The `/health` endpoint is mounted on the same Starlette app.

### New files

**`mcp-server/payments.py`** — Payment orchestrator:
- `check_access(tool_name: str) -> None` — checks all payment paths in priority order, raises if none valid. Uses `get_http_request()` from `fastmcp.server.dependencies` internally to access headers.
- `is_external() -> bool` — checks if `X-Caddy-Secret` header matches `CADDY_INTERNAL_SECRET` env var. If absent → localhost (Poke). If present and matches → external (paid). If present and wrong → reject.
- `validate_api_key(token: str) -> bool` — checks Turso `api_keys` table, verifies credit balance > 0 and `revoked_at` is null
- `decrement_credit(key: str)` — atomic decrement: `UPDATE api_keys SET credits_remaining = credits_remaining - 1 WHERE key = ? AND credits_remaining > 0`. Checks rows affected; if 0, key is exhausted.
- `log_usage(key_or_wallet: str, tool: str, method: str)` — inserts into `usage_log`

**`mcp-server/db_write.py`** — Write operations (separate from read-only `db.py`):
- Uses `TURSO_WRITE_TOKEN` env var (separate from `TURSO_READ_TOKEN`)
- Functions: `insert_api_key()`, `decrement_credit()`, `log_usage()`, `revoke_key()`
- Keeps `db.py` read-only for alert queries

**`mcp-server/x402_handler.py`** — x402 integration:
- Uses `x402.mcp.create_payment_wrapper_sync` to wrap each tool function
- The wrapper intercepts the tool call, checks for `_meta["x402/payment"]` in the JSON-RPC request
- If absent: returns `CallToolResult(isError=True)` with payment requirements in `structuredContent`
- If present: verifies via CDP facilitator, calls the wrapped function, settles payment, returns result with `_meta["x402/payment-response"]`
- Configures: scheme=exact, network=eip155:8453, price=$0.01, pay_to=EVM_PAY_TO_ADDRESS
- Uses Coinbase CDP facilitator for verify + settle

**x402 + FastMCP integration pattern:** The `create_payment_wrapper_sync` wraps the Python function itself (decorator pattern), not the HTTP layer. FastMCP passes `_meta` through to the tool context. The wrapper checks the context for payment data before executing the wrapped function. If FastMCP does not expose `_meta` in the tool function signature, an alternative approach is to use ASGI middleware at the HTTP level (via `PaymentMiddlewareASGI`) with a single route config for `POST /mcp`, where the price applies to all tool calls uniformly ($0.01 flat rate makes this viable).

**`mcp-server/mpp_handler.py`** — MPP integration:
- Handles MPP payment verification at the ASGI middleware level
- Since MPP uses HTTP 402 responses but MCP uses JSON-RPC over HTTP, the middleware must intercept the raw HTTP request BEFORE FastMCP processes it:
  1. Check for `Authorization: MPP <credential>` header on incoming POST to `/mcp`
  2. If credential present and valid → pass through to FastMCP normally
  3. If no credential and no other valid auth → return HTTP 402 with `WWW-Authenticate: MPP` header and JSON payment challenge body (this happens before FastMCP serializes a JSON-RPC response)
- This requires the server to use `mcp.http_app()` ASGI export (not `mcp.run()`) so the MPP middleware can wrap the ASGI app
- Supports Stripe (card payments) and Tempo (stablecoin) methods
- **Risk note:** `pympp` Python SDK is early-stage. If it proves unusable, Phase 3 can implement the MPP 402 protocol manually (it's a simple HTTP challenge-response pattern) or use a TypeScript sidecar via `mppx`

### New Turso tables

```sql
CREATE TABLE api_keys (
    key_hash TEXT PRIMARY KEY,        -- SHA-256 of the actual key (never store plaintext)
    key_prefix TEXT NOT NULL,         -- First 8 chars of key (e.g. 'sw_abc12') for identification in logs
    owner_email TEXT NOT NULL,
    credits_remaining INTEGER NOT NULL DEFAULT 1000,
    created_at INTEGER NOT NULL,
    revoked_at INTEGER
);

CREATE TABLE usage_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key_or_wallet TEXT NOT NULL,
    tool_name TEXT NOT NULL,
    payment_method TEXT NOT NULL,  -- 'api_key', 'x402', 'mpp'
    timestamp INTEGER NOT NULL
);
```

### New env vars on VPS

| Variable | Purpose |
|----------|---------|
| `TURSO_WRITE_TOKEN` | Read-write token for api_keys + usage_log |
| `CADDY_INTERNAL_SECRET` | Shared secret for Caddy→server dual-mode detection |
| `COINBASE_CDP_API_KEY` | x402 facilitator authentication |
| `EVM_PAY_TO_ADDRESS` | Wallet address to receive USDC on Base |
| `STRIPE_SECRET_KEY` | MPP Stripe payment processing |
| `MPP_SECRET_KEY` | MPP credential verification |

### Updated requirements.txt

```
fastmcp>=2.12.0
uvicorn>=0.35.0
httpx>=0.27.0
python-dotenv>=1.0.0
starlette>=0.40.0
x402[mcp,evm]>=2.5.0
pympp>=0.1.0
```

## Frontend: Developer Page

### New page: `app/developer/page.tsx`

Standalone page at `/developer`. Does NOT use AppShell/TabBar. English-only. Own layout with:

1. **Hero section** — "SirenWise API" heading, brief description, pricing ($0.01/request)
2. **Payment options** — Three cards side by side:
   - **Stripe** — "Buy 1,000 requests for $10" button → Stripe Checkout
   - **x402** — "Pay per request with USDC on Base" → wallet integration info + code example
   - **MPP** — "Machine payments via Stripe or Tempo" → integration code example
3. **Tools reference** — Four tools with parameters, descriptions, example responses
4. **Quick start** — Copy-paste code snippets for Python and TypeScript, for each payment method
5. **Footer** — Link back to main sirenwise.com app

### New API routes (Vercel)

**`app/api/developer/checkout/route.ts`** — POST: creates Stripe Checkout session
- Product: "SirenWise API — 1,000 requests"
- Price: $10.00 one-time
- Success URL: `/developer/success?session_id={CHECKOUT_SESSION_ID}`
- Cancel URL: `/developer`

**`app/api/developer/webhook/route.ts`** — POST: Stripe webhook
- Listens for `checkout.session.completed`
- Generates API key: `sw_` + `crypto.randomBytes(32).toString('base64url')` (256 bits entropy)
- Stores SHA-256 hash of the key in Turso `api_keys` table (never plaintext). If DB leaks, keys are not usable.
- Inserts with 1,000 credits
- Stores the plaintext key in Stripe session metadata for one-time retrieval on success page

**`app/developer/success/page.tsx`** — Success page (server component)
- Retrieves Stripe session using `session_id` query param via Stripe API
- Verifies payment status is `paid` (does not rely on webhook having fired)
- If paid and key not yet created: generates key synchronously and inserts into Turso (idempotent — checks if key already exists for this session)
- Displays API key one time with copy button
- Shows quick start instructions

### CTA on main app

Add a subtle link in `components/Footer.tsx`:
- Text: "Developers: Access the SirenWise API →"
- Link: `/developer`
- Styled as secondary text, non-intrusive

### CSP updates in `next.config.ts`

- `script-src`: add `https://js.stripe.com`
- `frame-src`: change from `'none'` to `https://js.stripe.com`
- `connect-src`: add `https://api.stripe.com`

### New env vars on Vercel

| Variable | Purpose |
|----------|---------|
| `STRIPE_SECRET_KEY` | Create Checkout sessions |
| `STRIPE_PUBLISHABLE_KEY` | Client-side Stripe.js |
| `STRIPE_WEBHOOK_SECRET` | Verify webhook signatures |
| `TURSO_WRITE_TOKEN` | Write API keys to Turso |

## Infrastructure: mcp.sirenwise.com

### DNS

Add A record for `mcp.sirenwise.com` → VPS IP (`161.97.74.48`) in Cloudflare.

### Caddy

Append to VPS Caddyfile:

```
mcp.sirenwise.com {
    reverse_proxy 127.0.0.1:8001 {
        header_up Host {host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Caddy-Secret {env.CADDY_INTERNAL_SECRET}
    }
}
```

Caddy injects `X-Caddy-Secret` on every proxied request. The server uses this to distinguish external (paid) from localhost (Poke, free). The secret is shared between Caddy and the server via environment variable.

### Server dual-mode detection

The Poke tunnel connects directly to `127.0.0.1:8001` (bypasses Caddy). External clients connect via Caddy to `mcp.sirenwise.com`. To distinguish:

1. Caddy injects a secret header: `X-Caddy-Secret: <shared-secret>` (stored as `CADDY_INTERNAL_SECRET` env var on VPS)
2. The server checks `get_http_request()`:
   - If `X-Caddy-Secret` matches the env var → external request → requires payment/key
   - If `X-Caddy-Secret` is absent → localhost (Poke tunnel) → free pass
   - If `X-Caddy-Secret` is present but wrong → reject (spoofing attempt)

This is unspoofable because external clients can never reach port 8001 directly (it binds to 127.0.0.1). Only Caddy and the Poke tunnel can connect.

**Note:** Cloudflare DNS for `mcp.sirenwise.com` should be set to **DNS-only** (not proxied) so Caddy handles TLS directly and gets the real client IP.

## Security Hardening

1. **Dual auth mode** — localhost = free, external = paid. Based on `X-Caddy-Secret` header (shared secret between Caddy and server; unspoofable because port 8001 binds to 127.0.0.1)
2. **Input validation** — city/region params validated against `city_coords` table. Unknown values return a helpful error listing valid options.
3. **Rate limiting** — per API key: 100 req/min. Per IP (keyless x402/MPP): 30 req/min. Implemented in Python with in-memory counters. Counters reset on restart (acceptable at this scale).
4. **Error sanitization** — external requests get generic errors. Localhost gets detailed errors.
5. **Request logging** — all external requests logged to `usage_log`
6. **API key hashing** — keys stored as SHA-256 hashes in Turso, never plaintext. If DB leaks, keys are not usable.
7. **API key revocation** — revoked keys (non-null `revoked_at`) rejected immediately
8. **Atomic credit decrement** — `UPDATE ... SET credits_remaining = credits_remaining - 1 WHERE key_hash = ? AND credits_remaining > 0` prevents race condition overdraw
9. **Token isolation** — `db.py` uses `TURSO_READ_TOKEN` for alerts. `db_write.py` uses `TURSO_WRITE_TOKEN` for keys/usage. Write token only on VPS and Vercel, never exposed to clients.
10. **HTTPS only** — Caddy auto-TLS for `mcp.sirenwise.com`. Cloudflare DNS set to DNS-only (no proxy) so Caddy handles TLS directly.
11. **Stripe webhook verification** — webhook handler verifies Stripe signature via `stripe.webhooks.constructEvent()` using `STRIPE_WEBHOOK_SECRET`
12. **Health endpoint** — `/health` on `mcp.sirenwise.com` remains accessible without auth for monitoring (returns Turso connectivity status only, no sensitive data)
13. **No CORS** — `mcp.sirenwise.com` is for server-side MCP clients only, not browser-based. No CORS headers needed.

## Poke Impact

**Zero.** The Poke tunnel connects to `localhost:8001` as before. The server detects localhost and serves without auth or payment. No changes needed to the tunnel service or Poke configuration.

## Implementation Order

1. **Phase 1: Public endpoint + API keys + Stripe** — Caddy config, dual-mode auth, api_keys table, Stripe Checkout, developer page
2. **Phase 2: x402 integration** — x402 payment wrapper on tools, CDP facilitator, code examples on developer page
3. **Phase 3: MPP integration** — MPP 402 flow, Stripe/Tempo methods, code examples on developer page

Each phase is independently deployable and testable.
