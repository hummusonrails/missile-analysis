"""x402 payment handler for SirenWise MCP server.

Uses Thirdweb's x402 facilitator REST API directly for payment verification
and settlement on Arbitrum One. Does NOT use the generic x402 Python SDK's
resource server (which doesn't support Thirdweb's API format).

Thirdweb API:
  POST https://api.thirdweb.com/v1/payments/x402/verify
  POST https://api.thirdweb.com/v1/payments/x402/settle
  Auth: x-secret-key header

Network:     Arbitrum One — eip155:42161
Token:       USDC on Arbitrum — 0xaf88d065e77c8cC2239327C5EDb3A432268e5831
Price:       $0.01 per request
"""
from __future__ import annotations

import json
import logging
import os

import httpx

logger = logging.getLogger(__name__)

# Constants
ARBITRUM_NETWORK = "eip155:42161"
ARBITRUM_CHAIN_ID = 42161
USDC_ARBITRUM_ADDRESS = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831"
PRICE_USD = "$0.01"
PRICE_USDC_ATOMIC = "10000"  # 0.01 USDC (6 decimals)
MAX_TIMEOUT_SECONDS = 300

THIRDWEB_API_BASE = "https://api.thirdweb.com"
VERIFY_URL = f"{THIRDWEB_API_BASE}/v1/payments/x402/verify"
SETTLE_URL = f"{THIRDWEB_API_BASE}/v1/payments/x402/settle"


def _get_pay_to_address() -> str:
    addr = os.environ.get("EVM_PAY_TO_ADDRESS", "").strip()
    if not addr:
        raise RuntimeError("EVM_PAY_TO_ADDRESS env var is required")
    return addr


def _get_thirdweb_secret() -> str:
    key = os.environ.get("THIRDWEB_SECRET_KEY", "").strip()
    if not key:
        raise RuntimeError("THIRDWEB_SECRET_KEY env var is required")
    return key


def get_payment_requirements_dict() -> dict:
    """Build the payment requirements dict for 402 responses."""
    return {
        "x402Version": 2,
        "scheme": "exact",
        "network": ARBITRUM_NETWORK,
        "asset": USDC_ARBITRUM_ADDRESS,
        "amount": PRICE_USDC_ATOMIC,
        "payTo": _get_pay_to_address(),
        "maxTimeoutSeconds": MAX_TIMEOUT_SECONDS,
        "extra": {
            "name": "USD Coin",
            "version": "2",
        },
    }


async def verify_and_settle(payment_header: str) -> dict:
    """Verify and settle an x402 payment via Thirdweb's API.

    Args:
        payment_header: Raw value from the X-PAYMENT or PAYMENT-SIGNATURE header

    Returns:
        Settlement result dict from Thirdweb

    Raises:
        ValueError if verification or settlement fails
    """
    secret = _get_thirdweb_secret()
    pay_to = _get_pay_to_address()
    reqs = get_payment_requirements_dict()

    headers = {
        "Content-Type": "application/json",
        "x-secret-key": secret,
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        # Step 1: Verify the payment
        verify_body = {
            "x402Version": 2,
            "paymentPayload": payment_header,
            "paymentRequirements": reqs,
        }
        logger.info("Calling Thirdweb verify API...")
        verify_resp = await client.post(VERIFY_URL, json=verify_body, headers=headers)

        if verify_resp.status_code != 200:
            error_text = verify_resp.text
            logger.warning("x402 verify failed (%d): %s", verify_resp.status_code, error_text)
            raise ValueError("Payment verification failed")

        verify_result = verify_resp.json()
        is_valid = verify_result.get("isValid", False)
        if not is_valid:
            reason = verify_result.get("invalidReason", "unknown")
            logger.warning("x402 payment invalid: %s", reason)
            raise ValueError("Payment verification failed")

        logger.info("x402 payment verified successfully")

        # Step 2: Settle the payment
        settle_body = {
            "x402Version": 2,
            "paymentPayload": payment_header,
            "paymentRequirements": reqs,
        }
        logger.info("Calling Thirdweb settle API...")
        settle_resp = await client.post(SETTLE_URL, json=settle_body, headers=headers)

        if settle_resp.status_code != 200:
            error_text = settle_resp.text
            logger.warning("x402 settle failed (%d): %s", settle_resp.status_code, error_text)
            raise ValueError("Payment settlement failed")

        settle_result = settle_resp.json()
        tx_hash = settle_result.get("txHash", settle_result.get("transactionHash", ""))
        logger.info("x402 payment settled: tx=%s", tx_hash)

        return settle_result


def reset_singletons() -> None:
    """No-op — kept for test compatibility."""
    pass
