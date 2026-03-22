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

**`mcp-server/server.py`** — Replace `validate_api_key()` with `payments.check_access()` in each tool function. Add detection of request origin (localhost vs external).

### New files

**`mcp-server/payments.py`** — Payment orchestrator:
- `check_access(tool_name: str) -> None` — checks all payment paths in priority order, raises if none valid
- `is_localhost() -> bool` — checks if request is from 127.0.0.1 (Poke tunnel)
- `validate_api_key(token: str) -> bool` — checks Turso `api_keys` table, verifies credit balance > 0
- `decrement_credit(key: str)` — decrements credit balance
- `log_usage(key_or_wallet: str, tool: str, method: str)` — inserts into `usage_log`

**`mcp-server/x402_handler.py`** — x402 integration:
- Wraps each tool with `x402.mcp.create_payment_wrapper_sync`
- Configures: scheme=exact, network=eip155:8453, price=$0.01, pay_to=EVM_PAY_TO_ADDRESS
- Uses Coinbase CDP facilitator for verify + settle

**`mcp-server/mpp_handler.py`** — MPP integration:
- Handles 402 challenge generation
- Verifies MPP credentials
- Supports Stripe and Tempo payment methods

### New Turso tables

```sql
CREATE TABLE api_keys (
    key TEXT PRIMARY KEY,
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
- Generates API key (`crypto.randomUUID()` + prefix `sw_`)
- Inserts into Turso `api_keys` table with 1,000 credits
- Stores key in Stripe session metadata for retrieval

**`app/developer/success/page.tsx`** — Success page
- Retrieves session from Stripe using `session_id` query param
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
    }
}
```

The `X-Forwarded-For` header lets the server distinguish external requests from localhost (Poke tunnel).

### Server dual-mode detection

The server checks the request source:
- `127.0.0.1` or no `X-Forwarded-For` → localhost (Poke tunnel) → free pass
- Any `X-Forwarded-For` present → external (via Caddy) → requires payment/key

## Security Hardening

1. **Dual auth mode** — localhost = free, external = paid. Based on `X-Forwarded-For` header (only Caddy sets this; direct localhost connections don't have it)
2. **Input validation** — city/region params validated against `city_coords` table. Unknown values return a helpful error listing valid options.
3. **Rate limiting** — per API key: 100 req/min. Per IP (keyless x402/MPP): 30 req/min. Implemented in Python with in-memory counters.
4. **Error sanitization** — external requests get generic errors. Localhost gets detailed errors.
5. **Request logging** — all external requests logged to `usage_log`
6. **API key revocation** — revoked keys (non-null `revoked_at`) rejected immediately
7. **Token isolation** — read-only token for alerts, separate write token for keys/usage. Write token only on VPS and Vercel (for key generation), never exposed to clients.
8. **HTTPS only** — Caddy auto-TLS for `mcp.sirenwise.com`

## Poke Impact

**Zero.** The Poke tunnel connects to `localhost:8001` as before. The server detects localhost and serves without auth or payment. No changes needed to the tunnel service or Poke configuration.

## Implementation Order

1. **Phase 1: Public endpoint + API keys + Stripe** — Caddy config, dual-mode auth, api_keys table, Stripe Checkout, developer page
2. **Phase 2: x402 integration** — x402 payment wrapper on tools, CDP facilitator, code examples on developer page
3. **Phase 3: MPP integration** — MPP 402 flow, Stripe/Tempo methods, code examples on developer page

Each phase is independently deployable and testable.
