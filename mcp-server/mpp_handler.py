"""MPP (Machine Payments Protocol) integration for SirenWise MCP server.

Uses pympp's MCP extension for Tempo stablecoin payments.
Payment challenges and credentials flow via JSON-RPC _meta fields.
"""
import os
import logging

from mpp.extensions.mcp import (
    verify_or_challenge,
    MCPChallenge,
    MCPCredential,
    MCPReceipt,
    PaymentRequiredError,
    META_CREDENTIAL,
    META_RECEIPT,
    CODE_PAYMENT_REQUIRED,
)
from mpp.methods.tempo import ChargeIntent

logger = logging.getLogger(__name__)

# Tempo mainnet
TEMPO_CHAIN_ID = 4217
TEMPO_RPC = "https://rpc.tempo.xyz"

# Price per tool call in cents (USD)
PRICE_CENTS = 1  # $0.01

_charge_intent = None


def _get_charge_intent() -> ChargeIntent:
    """Get or create the Tempo charge intent (lazy init)."""
    global _charge_intent
    if _charge_intent is not None:
        return _charge_intent
    _charge_intent = ChargeIntent(
        chain_id=TEMPO_CHAIN_ID,
        rpc_url=TEMPO_RPC,
    )
    return _charge_intent


def get_mpp_secret_key() -> str:
    """Get MPP secret key for challenge signing."""
    key = os.environ.get("MPP_SECRET_KEY", "")
    if not key:
        raise ValueError("MPP_SECRET_KEY not configured")
    return key


def get_recipient() -> str:
    """Get the Tempo wallet address for receiving payments."""
    addr = os.environ.get("TEMPO_PAY_TO_ADDRESS", "")
    if not addr:
        raise ValueError("TEMPO_PAY_TO_ADDRESS not configured")
    return addr


async def check_mpp_payment(meta: dict | None, tool_name: str):
    """Check for MPP payment in request _meta.

    Returns (credential, receipt) tuple if payment is valid.
    Raises PaymentRequiredError if no payment or invalid.

    Args:
        meta: The _meta dict from the JSON-RPC request (may be None)
        tool_name: Name of the tool being called (for description)
    """
    intent = _get_charge_intent()
    result = await verify_or_challenge(
        meta=meta,
        intent=intent,
        request={
            "amount": str(PRICE_CENTS),
            "currency": "usd",
            "recipient": get_recipient(),
        },
        realm="mcp.sirenwise.com",
        secret_key=get_mpp_secret_key(),
        method="tempo",
        description=f"SirenWise API: {tool_name} ($0.01)",
    )

    if isinstance(result, MCPChallenge):
        raise PaymentRequiredError(result)

    # result is (credential, receipt) tuple
    return result
