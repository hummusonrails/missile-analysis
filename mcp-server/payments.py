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


def sanitize_error(message: str, is_ext: bool) -> str:
    """Sanitize error messages for external requests."""
    if not is_ext:
        return message  # Localhost gets detailed errors
    # Map specific errors to generic ones
    if "rate limit" in message.lower():
        return "Rate limit exceeded"
    if ("authentication" in message.lower() or "unauthorized" in message.lower()
            or "api key" in message.lower() or "invalid" in message.lower()):
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

    # No valid auth
    raise ValueError("Authentication required. Get an API key at https://sirenwise.com/developer")
