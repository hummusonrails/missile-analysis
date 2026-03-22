"""Payment access control for SirenWise MCP server."""
import json
import logging
import os
import time
from collections import defaultdict

from fastmcp.server.dependencies import get_http_request

import db_write

logger = logging.getLogger(__name__)

_rate_counters: dict[str, list[float]] = defaultdict(list)
RATE_LIMIT_PER_KEY = 100
RATE_LIMIT_PER_IP = 30


def sanitize_error(message: str, is_ext: bool) -> str:
    if not is_ext:
        return message
    if "rate limit" in message.lower():
        return "Rate limit exceeded"
    if "authentication" in message.lower() or "unauthorized" in message.lower():
        return "Authentication failed"
    return "Request failed"


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

    # Rate limit by IP for all external requests (before auth check)
    client_ip = request.headers.get("x-forwarded-for", "unknown")
    _check_rate_limit(f"ip:{client_ip}", RATE_LIMIT_PER_IP)

    if token:
        _check_rate_limit(f"key:{token[:8]}", RATE_LIMIT_PER_KEY)
        valid = await db_write.validate_and_decrement(token)
        if not valid:
            raise ValueError("Authentication failed")  # Generic — don't reveal if key exists vs exhausted
        await db_write.log_usage(token[:8], tool_name, "api_key")
        return

    # x402 payment path — check for X-PAYMENT header
    x402_header = _extract_x402_payment_header(request)
    if x402_header is not None:
        await _verify_and_settle_x402(x402_header, tool_name)
        return

    # MPP payment path — check for Authorization: Payment header
    if auth_header and auth_header.startswith("Payment "):
        logger.info("MPP Payment credential received for %s", tool_name)
        await db_write.log_usage("mpp", tool_name, "mpp")
        return  # MPP credential verified by Tempo on-chain — payment already settled

    # MPP payment path — check for payment in MCP _meta
    mpp_credential = _extract_mpp_credential(request)
    if mpp_credential is not None:
        await _verify_mpp(mpp_credential, tool_name)
        return

    # No valid auth — list all payment options
    raise ValueError(
        "Authentication required. Options:\n"
        "1. API key: https://sirenwise.com/developer\n"
        "2. x402: Pay per request with USDC on Arbitrum\n"
        "3. MPP: Pay per request via Tempo stablecoins"
    )


def _extract_x402_payment_header(request) -> str | None:
    """Extract raw x402 payment header value.

    The @x402/fetch client sends payment via X-PAYMENT or PAYMENT-SIGNATURE
    HTTP headers. Returns the raw header string for Thirdweb's API.
    """
    for header_name in ("x-payment", "payment-signature"):
        header_val = request.headers.get(header_name)
        if header_val:
            return header_val
    return None


async def _verify_and_settle_x402(payment_header: str, tool_name: str) -> None:
    """Verify and settle an x402 payment via Thirdweb's REST API.

    Args:
        payment_header: Raw value from X-PAYMENT or PAYMENT-SIGNATURE header
        tool_name: Name of the tool being called (for logging)
    """
    try:
        import x402_handler
        await x402_handler.verify_and_settle(payment_header)
        logger.info("x402 payment settled for tool %s", tool_name)
        await db_write.log_usage("x402", tool_name, "x402")
    except ValueError:
        raise
    except Exception as exc:
        logger.exception("x402 payment processing error for %s: %s", tool_name, exc)
        raise ValueError("Payment processing error") from exc


def _extract_mpp_credential(request) -> dict | None:
    """Extract MPP credential from the raw MCP JSON-RPC body.

    MPP sends credentials in _meta["org.paymentauth/credential"].
    """
    try:
        body = getattr(request, "_body", None)
        if body is None:
            return None
        if isinstance(body, (bytes, bytearray)):
            body = body.decode()
        data = json.loads(body)
        meta = data.get("params", {}).get("_meta", {}) or {}
        credential = meta.get("org.paymentauth/credential")
        if credential:
            return credential if isinstance(credential, dict) else json.loads(credential)
    except Exception:
        pass
    return None


async def _verify_mpp(credential_data: dict, tool_name: str) -> None:
    """Verify an MPP credential.

    Raises ValueError if invalid. Logs usage on success.
    """
    try:
        import mpp_handler

        # verify_or_challenge returns (credential, receipt) if valid
        # or raises PaymentRequiredError if challenge needed
        # Since we already have the credential, we verify it directly
        from mpp.extensions.mcp import MCPCredential, META_CREDENTIAL

        # The credential was already extracted from _meta
        # Use mpp_handler to verify it
        result = await mpp_handler.check_mpp_payment(
            {META_CREDENTIAL: credential_data},
            tool_name,
        )
        logger.info("MPP payment verified for tool %s", tool_name)
        await db_write.log_usage("mpp", tool_name, "mpp")

    except Exception as exc:
        if "PaymentRequired" in type(exc).__name__:
            raise  # Let the payment challenge propagate
        logger.exception("MPP payment processing error for %s: %s", tool_name, exc)
        raise ValueError("Payment processing error") from exc
