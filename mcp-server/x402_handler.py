"""x402 payment handler for SirenWise MCP server.

Sets up the x402ResourceServer with the Thirdweb facilitator for Arbitrum One,
and builds the USDC payment requirements used by payments.py.

The resource server is created lazily on first use so that the module can be
imported without an immediate network call to the facilitator.

Network:     Arbitrum One — eip155:42161
Token:       USDC on Arbitrum — 0xaf88d065e77c8cC2239327C5EDb3A432268e5831
Price:       $0.01 per request (10_000 USDC atomic units, 6 decimals)
Facilitator: Thirdweb — https://x402.thirdweb.com
"""
from __future__ import annotations

import logging
import os

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

ARBITRUM_NETWORK = "eip155:42161"
USDC_ARBITRUM_ADDRESS = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831"

# $0.01 expressed in USDC atomic units (6 decimals)
PRICE_USDC_ATOMIC = "10000"  # 0.01 USDC

# Thirdweb x402 facilitator base URL (verify/settle endpoints live under this root)
THIRDWEB_FACILITATOR_URL = "https://x402.thirdweb.com"

# Maximum seconds a signed payment authorisation is considered valid
MAX_TIMEOUT_SECONDS = 300

# ---------------------------------------------------------------------------
# Lazy-initialised singletons
# ---------------------------------------------------------------------------

_resource_server = None
_payment_requirements = None


def _get_pay_to_address() -> str:
    """Return the pay-to wallet address from env, raising if not set."""
    addr = os.environ.get("EVM_PAY_TO_ADDRESS", "").strip()
    if not addr:
        raise RuntimeError(
            "EVM_PAY_TO_ADDRESS env var is required for x402 payments. "
            "Set it to an Arbitrum One wallet address."
        )
    return addr


async def get_resource_server():
    """Return (or create) the singleton x402ResourceServer instance.

    Calls initialize() which contacts the Thirdweb facilitator's /supported
    endpoint to discover supported schemes and networks. This is required
    for verify_payment/settle_payment to work correctly.
    """
    global _resource_server

    if _resource_server is not None:
        return _resource_server

    from x402.server import x402ResourceServer
    from x402.http.facilitator_client import HTTPFacilitatorClient, FacilitatorConfig
    from x402.http.facilitator_client_base import AuthHeaders, AuthProvider
    from x402.mechanisms.evm.exact import ExactEvmServerScheme

    thirdweb_secret = os.environ.get("THIRDWEB_SECRET_KEY", "").strip()

    if thirdweb_secret:
        class _ThirdwebAuthProvider(AuthProvider):
            def get_auth_headers(self) -> AuthHeaders:
                auth = {"Authorization": f"Bearer {thirdweb_secret}"}
                return AuthHeaders(verify=auth, settle=auth, supported=auth)

        config = FacilitatorConfig(
            url=THIRDWEB_FACILITATOR_URL,
            auth_provider=_ThirdwebAuthProvider(),
        )
    else:
        logger.warning(
            "THIRDWEB_SECRET_KEY not set — x402 verify/settle requests to Thirdweb "
            "will be unauthenticated and may be rejected."
        )
        config = FacilitatorConfig(url=THIRDWEB_FACILITATOR_URL)

    facilitator = HTTPFacilitatorClient(config)

    server = x402ResourceServer(facilitator)
    server.register(ARBITRUM_NETWORK, ExactEvmServerScheme())

    # initialize() calls the facilitator's /supported endpoint to populate
    # _supported_responses, which verify_payment/settle_payment need.
    await server.initialize()

    _resource_server = server
    logger.info(
        "x402ResourceServer initialized (Thirdweb facilitator, %s)", ARBITRUM_NETWORK
    )
    return _resource_server


def get_payment_requirements():
    """Return (or build) the singleton PaymentRequirements for this server.

    We construct requirements directly rather than via build_payment_requirements()
    because that method requires the facilitator to have responded to /supported
    with a matching SupportedKind for eip155:42161 — something we cannot guarantee
    at startup without a blocking network call.

    The extra fields (name, version) are EIP-712 domain parameters for USDC on
    Arbitrum One, required by clients to construct the transfer authorisation
    signature.
    """
    global _payment_requirements

    if _payment_requirements is not None:
        return _payment_requirements

    from x402.schemas.payments import PaymentRequirements

    pay_to = _get_pay_to_address()

    _payment_requirements = PaymentRequirements(
        scheme="exact",
        network=ARBITRUM_NETWORK,
        asset=USDC_ARBITRUM_ADDRESS,
        amount=PRICE_USDC_ATOMIC,
        pay_to=pay_to,
        max_timeout_seconds=MAX_TIMEOUT_SECONDS,
        extra={
            # EIP-712 domain parameters for USDC on Arbitrum One
            "name": "USD Coin",
            "version": "2",
        },
    )

    logger.info(
        "x402 payment requirements built: %s USDC atomic units on %s, pay_to=%s",
        PRICE_USDC_ATOMIC,
        ARBITRUM_NETWORK,
        pay_to,
    )
    return _payment_requirements


def reset_singletons() -> None:
    """Reset cached singletons — used in tests to reinitialise with different env vars."""
    global _resource_server, _payment_requirements
    _resource_server = None
    _payment_requirements = None
