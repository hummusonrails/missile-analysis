# SirenWise Paid API — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose the SirenWise MCP server publicly at `mcp.sirenwise.com` with API key authentication and Stripe Checkout for key purchase, plus a developer page at `sirenwise.com/developer`.

**Architecture:** Public HTTPS endpoint via Caddy on VPS. Dual-mode auth: Poke tunnel (localhost) = free, external (via Caddy) = requires API key. Stripe Checkout on Vercel generates keys stored in Turso. Developer landing page with docs and code examples.

**Tech Stack:** Python (FastMCP backend), Next.js 16 (frontend), Stripe Checkout, Turso (key storage), Caddy (reverse proxy), Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-03-22-sirenwise-paid-api-design.md`

---

### Task 1: Turso write client and API key tables

**Files:**
- Create: `mcp-server/db_write.py`
- Create: `mcp-server/tests/test_db_write.py`

- [ ] **Step 1: Write tests for db_write**

```python
# mcp-server/tests/test_db_write.py
"""Tests for Turso write operations."""
import hashlib
from db_write import hash_api_key, make_key_prefix


def test_hash_api_key():
    key = "sw_abc123def456"
    h = hash_api_key(key)
    assert h == hashlib.sha256(key.encode()).hexdigest()
    assert len(h) == 64


def test_hash_api_key_deterministic():
    key = "sw_test"
    assert hash_api_key(key) == hash_api_key(key)


def test_make_key_prefix():
    key = "sw_abcdefghijklmnop"
    assert make_key_prefix(key) == "sw_abcde"


def test_make_key_prefix_short_key():
    key = "sw_ab"
    assert make_key_prefix(key) == "sw_ab"
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd /Users/bengreenberg/Dev/personal/missile-analysis/mcp-server
source venv/bin/activate
PYTHONPATH=. python -m pytest tests/test_db_write.py -v
```

- [ ] **Step 3: Write db_write.py**

```python
# mcp-server/db_write.py
"""Turso write operations for API keys and usage logging.

Uses TURSO_WRITE_TOKEN (separate from the read-only token in db.py).
"""
import hashlib
import logging
import os
import time

import httpx

logger = logging.getLogger(__name__)


def _get_turso_url() -> str:
    url = os.environ["TURSO_DB_URL"].strip()
    return url.replace("libsql://", "https://")


def _get_write_token() -> str:
    return os.environ["TURSO_WRITE_TOKEN"].strip()


def hash_api_key(key: str) -> str:
    """SHA-256 hash of an API key for storage."""
    return hashlib.sha256(key.encode()).hexdigest()


def make_key_prefix(key: str) -> str:
    """First 8 chars of key for identification in logs."""
    return key[:8]


async def _execute_write(statements: list[dict]) -> dict:
    """Execute write statements against Turso HTTP API."""
    url = f"{_get_turso_url()}/v2/pipeline"
    headers = {
        "Authorization": f"Bearer {_get_write_token()}",
        "Content-Type": "application/json",
    }
    body = {"requests": [{"type": "execute", "stmt": s} for s in statements]}

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(url, json=body, headers=headers)
        resp.raise_for_status()
        return resp.json()


async def create_tables():
    """Create api_keys and usage_log tables if they don't exist."""
    stmts = [
        {"sql": """CREATE TABLE IF NOT EXISTS api_keys (
            key_hash TEXT PRIMARY KEY,
            key_prefix TEXT NOT NULL,
            owner_email TEXT NOT NULL,
            credits_remaining INTEGER NOT NULL DEFAULT 1000,
            created_at INTEGER NOT NULL,
            revoked_at INTEGER
        )"""},
        {"sql": """CREATE TABLE IF NOT EXISTS usage_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key_or_wallet TEXT NOT NULL,
            tool_name TEXT NOT NULL,
            payment_method TEXT NOT NULL,
            timestamp INTEGER NOT NULL
        )"""},
    ]
    await _execute_write(stmts)


async def insert_api_key(key: str, email: str, credits: int = 1000):
    """Insert a new API key (stored as SHA-256 hash)."""
    stmt = {
        "sql": "INSERT INTO api_keys (key_hash, key_prefix, owner_email, credits_remaining, created_at) VALUES (?, ?, ?, ?, ?)",
        "args": [
            {"type": "text", "value": hash_api_key(key)},
            {"type": "text", "value": make_key_prefix(key)},
            {"type": "text", "value": email},
            {"type": "integer", "value": str(credits)},
            {"type": "integer", "value": str(int(time.time() * 1000))},
        ],
    }
    await _execute_write([stmt])


async def validate_and_decrement(key: str) -> bool:
    """Validate API key and atomically decrement credits. Returns True if valid."""
    from db import parse_turso_response

    key_hash = hash_api_key(key)
    stmt = {
        "sql": "UPDATE api_keys SET credits_remaining = credits_remaining - 1 WHERE key_hash = ? AND credits_remaining > 0 AND revoked_at IS NULL",
        "args": [{"type": "text", "value": key_hash}],
    }
    data = await _execute_write([stmt])
    # Check affected rows
    result = data.get("results", [{}])[0].get("response", {}).get("result", {})
    affected = result.get("affected_row_count", 0)
    return affected > 0


async def log_usage(key_or_wallet: str, tool_name: str, payment_method: str):
    """Log a tool call to usage_log."""
    stmt = {
        "sql": "INSERT INTO usage_log (key_or_wallet, tool_name, payment_method, timestamp) VALUES (?, ?, ?, ?)",
        "args": [
            {"type": "text", "value": key_or_wallet},
            {"type": "text", "value": tool_name},
            {"type": "text", "value": payment_method},
            {"type": "integer", "value": str(int(time.time() * 1000))},
        ],
    }
    await _execute_write([stmt])
```

- [ ] **Step 4: Run tests — expect PASS**

- [ ] **Step 5: Commit**

```bash
cd /Users/bengreenberg/Dev/personal/missile-analysis
git add mcp-server/db_write.py mcp-server/tests/test_db_write.py
git commit -m "feat(mcp): add Turso write client for API keys and usage logging"
```

---

### Task 2: Payment access control

**Files:**
- Create: `mcp-server/payments.py`
- Create: `mcp-server/tests/test_payments.py`

- [ ] **Step 1: Write tests**

```python
# mcp-server/tests/test_payments.py
"""Tests for payment access control."""
from payments import is_external, extract_bearer_token


def test_is_external_with_matching_secret():
    assert is_external("correct-secret", "correct-secret") is True


def test_is_external_no_header():
    assert is_external(None, "correct-secret") is False


def test_is_external_wrong_secret():
    # Wrong secret should raise
    import pytest
    with pytest.raises(ValueError, match="Unauthorized"):
        is_external("wrong-secret", "correct-secret")


def test_is_external_no_env_secret():
    # No env secret configured = localhost mode
    assert is_external(None, None) is False


def test_extract_bearer_token():
    assert extract_bearer_token("Bearer sw_abc123") == "sw_abc123"


def test_extract_bearer_token_no_bearer():
    assert extract_bearer_token("Basic abc") is None


def test_extract_bearer_token_empty():
    assert extract_bearer_token("") is None


def test_extract_bearer_token_none():
    assert extract_bearer_token(None) is None
```

- [ ] **Step 2: Run tests — expect FAIL**

- [ ] **Step 3: Write payments.py**

```python
# mcp-server/payments.py
"""Payment access control for SirenWise MCP server.

Handles dual-mode auth:
- Localhost (Poke tunnel): free pass
- External (via Caddy): requires API key or payment
"""
import logging
import os
import time
from collections import defaultdict

from fastmcp.server.dependencies import get_http_request

import db_write

logger = logging.getLogger(__name__)

# In-memory rate limiting (resets on restart, acceptable at this scale)
_rate_counters: dict[str, list[float]] = defaultdict(list)
RATE_LIMIT_PER_KEY = 100  # requests per minute
RATE_LIMIT_PER_IP = 30    # requests per minute (keyless)


def is_external(caddy_secret_header: str | None, expected_secret: str | None) -> bool:
    """Check if request came via Caddy (external) or localhost (Poke tunnel).

    Returns True if external, False if localhost.
    Raises ValueError if secret is present but wrong (spoofing attempt).
    """
    if not expected_secret:
        return False  # No secret configured = localhost-only mode
    if not caddy_secret_header:
        return False  # No header = localhost (Poke tunnel)
    if caddy_secret_header != expected_secret:
        raise ValueError("Unauthorized")
    return True


def extract_bearer_token(auth_header: str | None) -> str | None:
    """Extract Bearer token from Authorization header."""
    if not auth_header or not auth_header.startswith("Bearer "):
        return None
    return auth_header.split("Bearer ", 1)[1].strip()


def _check_rate_limit(identifier: str, limit: int):
    """Check rate limit for an identifier. Raises ValueError if exceeded."""
    now = time.time()
    window = [t for t in _rate_counters[identifier] if now - t < 60]
    _rate_counters[identifier] = window
    if len(window) >= limit:
        raise ValueError("Rate limit exceeded")
    window.append(now)


async def check_access(tool_name: str):
    """Check if the current request has valid access.

    Priority:
    1. Localhost (Poke tunnel) → free pass
    2. Bearer API key → validate + decrement credits
    3. (Future: x402, MPP)
    4. No valid auth → raise ValueError

    Logs usage for all external requests.
    """
    request = get_http_request()
    caddy_secret = request.headers.get("x-caddy-secret")
    expected_secret = os.environ.get("CADDY_INTERNAL_SECRET")

    if not is_external(caddy_secret, expected_secret):
        return  # Localhost — free pass

    # External request — require auth
    auth_header = request.headers.get("authorization", "")
    token = extract_bearer_token(auth_header)

    if token:
        _check_rate_limit(f"key:{token[:8]}", RATE_LIMIT_PER_KEY)
        valid = await db_write.validate_and_decrement(token)
        if not valid:
            raise ValueError("Invalid or exhausted API key")
        await db_write.log_usage(token[:8], tool_name, "api_key")
        return

    # No valid auth
    raise ValueError("Authentication required. Get an API key at https://sirenwise.com/developer")
```

- [ ] **Step 4: Run tests — expect PASS**

- [ ] **Step 5: Commit**

```bash
cd /Users/bengreenberg/Dev/personal/missile-analysis
git add mcp-server/payments.py mcp-server/tests/test_payments.py
git commit -m "feat(mcp): add payment access control with dual-mode auth"
```

---

### Task 3: Update server.py to use new auth

**Files:**
- Modify: `mcp-server/server.py`

- [ ] **Step 1: Replace validate_api_key() with payments.check_access() in server.py**

Replace the `validate_api_key` function and all calls to it. The import changes from using the old function to using `payments.check_access`.

In `server.py`:
- Remove the `validate_api_key` function (lines 28-44)
- Add `import payments` to imports
- Replace each `validate_api_key()` call with `await payments.check_access("<tool_name>")`

The four tool functions become:
```python
# In get_daily_context:
    await payments.check_access("get_daily_context")

# In get_sleep_impact:
    await payments.check_access("get_sleep_impact")

# In get_clustering:
    await payments.check_access("get_clustering")

# In get_streak:
    await payments.check_access("get_streak")
```

- [ ] **Step 2: Run all existing tests — expect PASS**

```bash
cd /Users/bengreenberg/Dev/personal/missile-analysis/mcp-server
PYTHONPATH=. python -m pytest tests/ -v
```

- [ ] **Step 3: Verify server still imports cleanly**

```bash
PYTHONPATH=. python -c "import server; print('OK')"
```

- [ ] **Step 4: Commit**

```bash
cd /Users/bengreenberg/Dev/personal/missile-analysis
git add mcp-server/server.py
git commit -m "feat(mcp): switch to payments.check_access for dual-mode auth"
```

---

### Task 4: Caddy config and DNS for mcp.sirenwise.com

**Files:**
- Modify: `mcp-server/sirenwise-mcp.service` (update env file path to include new vars)

This task uses the `contabo` CLI for VPS operations.

- [ ] **Step 1: Generate Caddy internal secret**

```bash
CADDY_SECRET=$(python3 -c "import secrets; print(secrets.token_hex(32))")
echo "Generated CADDY_INTERNAL_SECRET: $CADDY_SECRET"
```

- [ ] **Step 2: Generate Turso write token**

```bash
turso db tokens create missile-analysis
```

Save the output — this is `TURSO_WRITE_TOKEN`.

- [ ] **Step 3: Add env vars to VPS**

```bash
contabo ssh "cat >> /home/openclaw/.openclaw/skills/sirenwise-mcp/.env << 'EOF'
CADDY_INTERNAL_SECRET=<caddy-secret-from-step-1>
TURSO_WRITE_TOKEN=<write-token-from-step-2>
EOF"
```

- [ ] **Step 4: Create Turso tables on VPS**

```bash
contabo ssh 'cd /home/openclaw/.openclaw/skills/sirenwise-mcp && export $(grep -v "^#" .env | xargs) && .venv/bin/python3 -c "
import asyncio
import db_write
asyncio.run(db_write.create_tables())
print(\"Tables created\")
"'
```

- [ ] **Step 5: Add Caddy config for mcp.sirenwise.com**

```bash
contabo ssh 'cat >> /etc/caddy/Caddyfile << EOF

mcp.sirenwise.com {
    reverse_proxy 127.0.0.1:8001 {
        header_up Host {host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Caddy-Secret {env.CADDY_INTERNAL_SECRET}
    }
}
EOF'
```

Note: Caddy needs the `CADDY_INTERNAL_SECRET` env var. Set it in the Caddy systemd override:

```bash
contabo ssh "mkdir -p /etc/systemd/system/caddy.service.d && cat > /etc/systemd/system/caddy.service.d/env.conf << 'EOF'
[Service]
Environment=CADDY_INTERNAL_SECRET=<caddy-secret-from-step-1>
EOF
systemctl daemon-reload"
```

- [ ] **Step 6: Add DNS record**

Add an A record for `mcp.sirenwise.com` → `161.97.74.48` in Cloudflare DNS. Set to **DNS-only** (not proxied, grey cloud) so Caddy handles TLS.

- [ ] **Step 7: Deploy updated server files and restart**

```bash
cd /Users/bengreenberg/Dev/personal/missile-analysis/mcp-server
scp -i ~/.ssh/id_ed25519 server.py payments.py db_write.py root@161.97.74.48:/home/openclaw/.openclaw/skills/sirenwise-mcp/
contabo ssh "chown -R openclaw:openclaw /home/openclaw/.openclaw/skills/sirenwise-mcp/ && systemctl restart sirenwise-mcp && caddy reload --config /etc/caddy/Caddyfile"
```

- [ ] **Step 8: Validate Caddy + mcp.sirenwise.com**

Wait for DNS propagation and TLS cert, then:

```bash
# Should fail with auth error (external request)
curl -s -X POST https://mcp.sirenwise.com/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"get_daily_context","arguments":{}},"id":1}'

# Poke tunnel should still work (localhost, free pass)
contabo ssh 'curl -s -X POST http://localhost:8001/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d "{\"jsonrpc\":\"2.0\",\"method\":\"tools/call\",\"params\":{\"name\":\"get_daily_context\",\"arguments\":{}},\"id\":2}"'
```

- [ ] **Step 9: Commit deployment config changes**

```bash
cd /Users/bengreenberg/Dev/personal/missile-analysis
git add mcp-server/
git commit -m "feat(mcp): add Caddy config and dual-mode auth deployment"
```

---

### Task 5: Stripe Checkout API routes (Vercel)

**Files:**
- Create: `app/api/developer/checkout/route.ts`
- Create: `app/api/developer/webhook/route.ts`
- Create: `lib/stripe.ts`
- Create: `lib/api-keys.ts`

- [ ] **Step 1: Install Stripe SDK**

```bash
cd /Users/bengreenberg/Dev/personal/missile-analysis
npm install stripe
```

- [ ] **Step 2: Create lib/stripe.ts**

```typescript
// lib/stripe.ts
import Stripe from "stripe";

export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not set");
  return new Stripe(key);
}
```

- [ ] **Step 3: Create lib/api-keys.ts**

```typescript
// lib/api-keys.ts
import { createHash, randomBytes } from "crypto";
import { createServerClient } from "./db";

export function generateApiKey(): string {
  return "sw_" + randomBytes(32).toString("base64url");
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function keyPrefix(key: string): string {
  return key.slice(0, 8);
}

export async function storeApiKey(key: string, email: string, credits: number = 1000) {
  const client = createServerClient();
  const writeToken = process.env.TURSO_WRITE_TOKEN;
  if (!writeToken) throw new Error("TURSO_WRITE_TOKEN not set");

  // Use write token for this operation
  const url = process.env.TURSO_DB_URL?.trim().replace("libsql://", "https://");
  if (!url) throw new Error("TURSO_DB_URL not set");

  const resp = await fetch(`${url}/v2/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${writeToken.trim()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      requests: [
        {
          type: "execute",
          stmt: {
            sql: "INSERT OR IGNORE INTO api_keys (key_hash, key_prefix, owner_email, credits_remaining, created_at) VALUES (?, ?, ?, ?, ?)",
            args: [
              { type: "text", value: hashApiKey(key) },
              { type: "text", value: keyPrefix(key) },
              { type: "text", value: email },
              { type: "integer", value: String(credits) },
              { type: "integer", value: String(Date.now()) },
            ],
          },
        },
      ],
    }),
  });

  if (!resp.ok) throw new Error(`Turso write failed: ${resp.status}`);
}
```

- [ ] **Step 4: Create checkout route**

```typescript
// app/api/developer/checkout/route.ts
import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";

export async function POST() {
  const stripe = getStripe();

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: 1000, // $10.00
          product_data: {
            name: "SirenWise API — 1,000 requests",
            description: "Access to all 4 SirenWise MCP tools. $0.01 per request.",
          },
        },
        quantity: 1,
      },
    ],
    success_url: `${process.env.NEXT_PUBLIC_SITE_URL || "https://sirenwise.com"}/developer/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL || "https://sirenwise.com"}/developer`,
  });

  return NextResponse.json({ url: session.url });
}
```

- [ ] **Step 5: Create webhook route**

```typescript
// app/api/developer/webhook/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { generateApiKey, storeApiKey } from "@/lib/api-keys";

export async function POST(request: NextRequest) {
  const stripe = getStripe();
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");

  if (!sig) return NextResponse.json({ error: "No signature" }, { status: 400 });

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const email = session.customer_details?.email || "unknown";
    const apiKey = generateApiKey();

    await storeApiKey(apiKey, email);

    // Store key in session metadata for retrieval on success page
    await stripe.checkout.sessions.update(session.id, {
      metadata: { api_key: apiKey },
    });
  }

  return NextResponse.json({ received: true });
}
```

- [ ] **Step 6: Commit**

```bash
cd /Users/bengreenberg/Dev/personal/missile-analysis
git add lib/stripe.ts lib/api-keys.ts app/api/developer/checkout/route.ts app/api/developer/webhook/route.ts
git commit -m "feat: add Stripe Checkout API routes for API key purchase"
```

---

### Task 6: Developer page and success page

**Files:**
- Create: `app/developer/page.tsx`
- Create: `app/developer/success/page.tsx`
- Modify: `components/Footer.tsx`
- Modify: `next.config.ts`

- [ ] **Step 1: Update CSP headers in next.config.ts**

In `next.config.ts`, update the CSP:
- `script-src`: add `https://js.stripe.com`
- `frame-src`: change `'none'` to `https://js.stripe.com`
- `connect-src`: add `https://api.stripe.com`

- [ ] **Step 2: Create developer page**

```tsx
// app/developer/page.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SirenWise API — Developer Access",
  description: "Real-time missile alert analysis API for developers. Four MCP tools for daily context, sleep impact, clustering, and streak analysis.",
};

function CheckoutButton() {
  return (
    <form action="/api/developer/checkout" method="POST">
      <button
        type="submit"
        className="px-6 py-3 bg-accent-blue text-white rounded-lg font-medium hover:bg-accent-blue/90 transition-colors"
      >
        Buy 1,000 requests — $10
      </button>
    </form>
  );
}

export default function DeveloperPage() {
  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      <div className="max-w-3xl mx-auto px-6 py-16">
        {/* Hero */}
        <h1 className="text-4xl font-serif font-bold mb-4">SirenWise API</h1>
        <p className="text-lg text-text-secondary mb-2">
          Real-time missile alert analysis for Israel. Four MCP tools providing daily context,
          sleep impact assessment, alert clustering, and quiet-day streak tracking.
        </p>
        <p className="text-sm text-text-tertiary mb-12">
          Default scope: Modi&apos;in Maccabim Re&apos;ut. Pass any Israeli city or region.
        </p>

        {/* Pricing */}
        <div className="bg-bg-elevated border border-border rounded-xl p-8 mb-12">
          <h2 className="text-xl font-semibold mb-2">$0.01 per request</h2>
          <p className="text-text-secondary mb-6">Flat rate for all tools. No subscriptions.</p>

          <div className="grid gap-4 md:grid-cols-3">
            {/* Stripe */}
            <div className="bg-bg-surface border border-border rounded-lg p-5">
              <h3 className="font-mono text-sm font-semibold text-accent-blue mb-2">API Key</h3>
              <p className="text-xs text-text-tertiary mb-4">
                Buy credits via Stripe. Use your key with any MCP client.
              </p>
              <CheckoutButton />
            </div>

            {/* x402 */}
            <div className="bg-bg-surface border border-border rounded-lg p-5">
              <h3 className="font-mono text-sm font-semibold text-accent-amber mb-2">x402 (Base USDC)</h3>
              <p className="text-xs text-text-tertiary mb-4">
                Pay per request with USDC on Base. No API key needed. Permissionless.
              </p>
              <span className="text-xs text-text-tertiary italic">Coming soon — Phase 2</span>
            </div>

            {/* MPP */}
            <div className="bg-bg-surface border border-border rounded-lg p-5">
              <h3 className="font-mono text-sm font-semibold text-accent-green mb-2">MPP (Stripe / Tempo)</h3>
              <p className="text-xs text-text-tertiary mb-4">
                Machine payments via Stripe cards or Tempo stablecoins.
              </p>
              <span className="text-xs text-text-tertiary italic">Coming soon — Phase 3</span>
            </div>
          </div>
        </div>

        {/* Tools Reference */}
        <h2 className="text-xl font-semibold mb-4">Tools</h2>
        <div className="space-y-4 mb-12">
          {[
            { name: "get_daily_context", desc: "Compare today's alert count against 7-day and 30-day averages." },
            { name: "get_sleep_impact", desc: "Flag alerts during night hours (10 PM – 6 AM) with deep sleep markers." },
            { name: "get_clustering", desc: "Detect isolated alerts vs barrages within configurable time windows." },
            { name: "get_streak", desc: "Days since last alert. Flags streak-breakers." },
          ].map((tool) => (
            <div key={tool.name} className="bg-bg-elevated border border-border rounded-lg p-4">
              <code className="text-sm font-mono text-accent-blue">{tool.name}</code>
              <p className="text-sm text-text-secondary mt-1">{tool.desc}</p>
              <p className="text-xs text-text-tertiary mt-2">
                Params: <code>city</code> (optional), <code>region_id</code> (optional), <code>nationwide</code> (bool)
              </p>
            </div>
          ))}
        </div>

        {/* Quick Start */}
        <h2 className="text-xl font-semibold mb-4">Quick Start</h2>
        <div className="bg-bg-elevated border border-border rounded-lg p-4 mb-4">
          <p className="text-xs text-text-tertiary mb-2">MCP endpoint:</p>
          <code className="text-sm font-mono text-accent-blue block bg-bg-surface px-3 py-2 rounded">
            https://mcp.sirenwise.com/mcp
          </code>
        </div>
        <div className="bg-bg-elevated border border-border rounded-lg p-4">
          <p className="text-xs text-text-tertiary mb-2">Use with any MCP client — add your API key as a Bearer token:</p>
          <pre className="text-xs font-mono text-text-secondary bg-bg-surface px-3 py-2 rounded overflow-x-auto">
{`Authorization: Bearer sw_your_api_key_here`}
          </pre>
        </div>

        {/* Back link */}
        <div className="mt-12 text-center">
          <a href="/" className="text-sm text-text-tertiary hover:text-text-secondary transition-colors">
            ← Back to SirenWise
          </a>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create success page**

```tsx
// app/developer/success/page.tsx
import type { Metadata } from "next";
import { getStripe } from "@/lib/stripe";
import { generateApiKey, storeApiKey } from "@/lib/api-keys";

export const metadata: Metadata = {
  title: "API Key Created — SirenWise",
};

async function getOrCreateKey(sessionId: string) {
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId);

  if (session.payment_status !== "paid") {
    return null;
  }

  // Check if key already exists in metadata (from webhook)
  if (session.metadata?.api_key) {
    return session.metadata.api_key;
  }

  // Generate key synchronously (webhook may not have fired yet)
  const apiKey = generateApiKey();
  const email = session.customer_details?.email || "unknown";
  await storeApiKey(apiKey, email);

  await stripe.checkout.sessions.update(sessionId, {
    metadata: { api_key: apiKey },
  });

  return apiKey;
}

export default async function SuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const params = await searchParams;
  const sessionId = params.session_id;

  if (!sessionId) {
    return (
      <div className="min-h-screen bg-bg-primary text-text-primary flex items-center justify-center">
        <p className="text-text-secondary">Invalid session.</p>
      </div>
    );
  }

  const apiKey = await getOrCreateKey(sessionId);

  if (!apiKey) {
    return (
      <div className="min-h-screen bg-bg-primary text-text-primary flex items-center justify-center">
        <p className="text-text-secondary">Payment not confirmed yet. Please refresh in a moment.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      <div className="max-w-xl mx-auto px-6 py-16">
        <h1 className="text-2xl font-serif font-bold mb-4 text-accent-green">API Key Created</h1>
        <p className="text-text-secondary mb-6">
          Copy your API key below. This is the only time it will be displayed.
        </p>

        <div className="bg-bg-elevated border border-accent-green/30 rounded-lg p-4 mb-8">
          <p className="text-xs text-text-tertiary mb-2">Your API key (1,000 requests):</p>
          <code className="text-sm font-mono text-accent-green break-all block bg-bg-surface px-3 py-2 rounded select-all">
            {apiKey}
          </code>
        </div>

        <div className="bg-bg-elevated border border-border rounded-lg p-4 mb-8">
          <p className="text-xs text-text-tertiary mb-2">MCP endpoint:</p>
          <code className="text-sm font-mono text-accent-blue block">
            https://mcp.sirenwise.com/mcp
          </code>
          <p className="text-xs text-text-tertiary mt-3 mb-2">Authorization header:</p>
          <code className="text-sm font-mono text-text-secondary block">
            Bearer {apiKey.slice(0, 8)}...
          </code>
        </div>

        <a href="/developer" className="text-sm text-text-tertiary hover:text-text-secondary transition-colors">
          ← Back to Developer docs
        </a>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Add CTA to Footer.tsx**

Add a developer API link between the coffee link and the sister sites in `components/Footer.tsx`.

- [ ] **Step 5: Build and verify**

```bash
cd /Users/bengreenberg/Dev/personal/missile-analysis
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add app/developer/ components/Footer.tsx next.config.ts lib/stripe.ts lib/api-keys.ts
git commit -m "feat: add developer page with Stripe Checkout and API key delivery"
```

---

### Task 7: Vercel env vars and Stripe setup

This task requires manual steps in external services.

- [ ] **Step 1: Create Stripe product (if not auto-created by Checkout)**

The checkout route uses inline `price_data` so no manual product creation is needed.

- [ ] **Step 2: Set Vercel env vars**

```bash
cd /Users/bengreenberg/Dev/personal/missile-analysis
# These need to be set in the Vercel dashboard or via CLI:
# STRIPE_SECRET_KEY=sk_live_...
# STRIPE_PUBLISHABLE_KEY=pk_live_...
# STRIPE_WEBHOOK_SECRET=whsec_...
# TURSO_WRITE_TOKEN=<write-token>
# NEXT_PUBLIC_SITE_URL=https://sirenwise.com
```

- [ ] **Step 3: Configure Stripe webhook**

In Stripe Dashboard → Developers → Webhooks:
- Endpoint URL: `https://sirenwise.com/api/developer/webhook`
- Events: `checkout.session.completed`
- Copy the webhook signing secret to `STRIPE_WEBHOOK_SECRET` env var

- [ ] **Step 4: Deploy to Vercel**

```bash
git push
```

- [ ] **Step 5: End-to-end test**

1. Visit `https://sirenwise.com/developer`
2. Click "Buy 1,000 requests"
3. Complete Stripe Checkout with test card
4. Verify API key is displayed on success page
5. Use the key against `https://mcp.sirenwise.com/mcp`
6. Verify Poke still works via tunnel (no changes needed)

- [ ] **Step 6: Verify Poke tunnel unaffected**

```bash
contabo ssh 'curl -s -X POST http://localhost:8001/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d "{\"jsonrpc\":\"2.0\",\"method\":\"tools/call\",\"params\":{\"name\":\"get_daily_context\",\"arguments\":{}},\"id\":999}"'
```

Should return Modi'in data without any auth — Poke tunnel still works.
