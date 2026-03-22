# SirenWise Payment Test Clients

## Setup

```bash
cd mcp-server/test-clients
npm install
```

## Test 1: Stripe API Key

```bash
node test-stripe.mjs <your-api-key>
```

## Test 2: x402 (Arbitrum USDC)

Requires $0.01 USDC on Arbitrum One.

```bash
node test-x402.mjs <your-evm-private-key>
```

## Test 3: MPP (Tempo)

Requires stablecoins on Tempo mainnet.

```bash
node test-mpp.mjs <your-tempo-private-key>
```
