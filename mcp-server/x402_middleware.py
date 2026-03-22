"""ASGI middleware that returns HTTP 402 with x402 payment requirements.

The @x402/fetch client needs an actual HTTP 402 response (not a JSON-RPC
error wrapped in a 200). This middleware intercepts external requests to
/mcp that lack a valid Bearer token or x402 payment header, and returns
a proper 402 with the PAYMENT-REQUIRED header that x402 clients understand.

Localhost requests (Poke tunnel) pass through untouched.
Requests with a valid Bearer API key pass through untouched.
Requests with a valid X-PAYMENT header get verified and pass through.
"""
import base64
import json
import logging
import os

logger = logging.getLogger(__name__)


class X402PaymentMiddleware:
    """ASGI middleware for x402 HTTP-level payment gating."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)

        # Only intercept POST to /mcp
        path = scope.get("path", "")
        method = scope.get("method", "")
        if method != "POST" or not path.rstrip("/").endswith("/mcp"):
            return await self.app(scope, receive, send)

        # Check if this is an external request (via Caddy)
        headers = dict(scope.get("headers", []))
        # Headers in ASGI are bytes
        caddy_secret = None
        auth_header = None
        x_payment = None
        for key, val in headers.items():
            key_str = key.decode("latin-1").lower() if isinstance(key, bytes) else key.lower()
            val_str = val.decode("latin-1") if isinstance(val, bytes) else val
            if key_str == "x-caddy-secret":
                caddy_secret = val_str
            elif key_str == "authorization":
                auth_header = val_str
            elif key_str in ("x-payment", "payment-signature"):
                x_payment = val_str

        expected_secret = os.environ.get("CADDY_INTERNAL_SECRET", "")

        # Localhost (no Caddy secret) → pass through
        if not expected_secret or not caddy_secret:
            return await self.app(scope, receive, send)

        # Wrong secret → reject
        if caddy_secret != expected_secret:
            return await self._send_401(send)

        # Has Bearer token → let payments.py handle validation
        if auth_header and auth_header.startswith("Bearer "):
            return await self.app(scope, receive, send)

        # Has x402 payment header → let payments.py verify it
        if x_payment:
            return await self.app(scope, receive, send)

        # No auth, no payment → return HTTP 402 with x402 payment requirements
        return await self._send_402(send)

    async def _send_402(self, send):
        """Send HTTP 402 with both x402 and MPP payment headers."""
        try:
            import x402_handler
            single_req = x402_handler.get_payment_requirements_dict()

            # x402: Full PaymentRequired object (what @x402/fetch reads)
            payment_required = {
                "x402Version": 2,
                "accepts": [single_req],
            }
            pr_json = json.dumps(payment_required)
            pr_b64 = base64.b64encode(pr_json.encode()).decode()

            # MPP: WWW-Authenticate challenge (what mppx reads)
            # Format: Payment id="...",realm="...",method="tempo",intent="charge",
            #         expires="...",request="base64(json)"
            import secrets
            import time
            from datetime import datetime, timezone, timedelta

            challenge_id = secrets.token_urlsafe(16)
            expires = (datetime.now(timezone.utc) + timedelta(minutes=5)).strftime("%Y-%m-%dT%H:%M:%SZ")

            # Tempo mainnet USDC address and chain ID
            TEMPO_USDC = "0x20C000000000000000000000b9537d11c60E8b50"
            TEMPO_CHAIN_ID = 4217
            tempo_recipient = os.environ.get("TEMPO_PAY_TO_ADDRESS", single_req["payTo"])

            mpp_request = {
                "amount": "10000",  # 0.01 USDC in base units (6 decimals)
                "currency": TEMPO_USDC,
                "recipient": tempo_recipient,
                "methodDetails": {
                    "chainId": TEMPO_CHAIN_ID,
                },
            }
            mpp_request_b64 = base64.b64encode(json.dumps(mpp_request).encode()).decode()

            www_auth = (
                f'Payment id="{challenge_id}",'
                f'realm="mcp.sirenwise.com",'
                f'method="tempo",'
                f'intent="charge",'
                f'expires="{expires}",'
                f'request="{mpp_request_b64}"'
            )

            headers = [
                (b"content-type", b"application/json"),
                (b"payment-required", pr_b64.encode()),
                (b"www-authenticate", www_auth.encode()),
                (b"cache-control", b"no-store"),
            ]

            # Body includes both x402 and MPP info
            body = json.dumps({
                "x402Version": 2,
                "accepts": [single_req],
                "type": "https://paymentauth.org/problems/payment-required",
                "title": "Payment Required",
                "status": 402,
                "detail": "Payment is required. $0.01 per request via USDC on Arbitrum (x402) or Tempo stablecoins (MPP).",
            }).encode()

        except Exception as exc:
            logger.warning("Failed to build payment requirements: %s", exc)
            headers = [(b"content-type", b"application/json")]
            body = json.dumps({"error": "Payment required but payment system unavailable"}).encode()

        await send({
            "type": "http.response.start",
            "status": 402,
            "headers": headers,
        })
        await send({
            "type": "http.response.body",
            "body": body,
        })

    async def _send_401(self, send):
        """Send HTTP 401 Unauthorized."""
        await send({
            "type": "http.response.start",
            "status": 401,
            "headers": [(b"content-type", b"application/json")],
        })
        await send({
            "type": "http.response.body",
            "body": b'{"error":"Unauthorized"}',
        })
