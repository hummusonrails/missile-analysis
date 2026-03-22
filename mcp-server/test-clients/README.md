# SirenWise API — Test Clients

Three ready-to-run test scripts for each payment method.

## Setup

```bash
npm install
```

## 1. Stripe API Key

Get a key at [sirenwise.com/developer](https://sirenwise.com/developer) ($10 for 1,000 requests).

```bash
node test-stripe.mjs <your-api-key> [city]
```

## 2. x402 — USDC on Arbitrum

Pay per request with USDC on Arbitrum One. $0.01 per call. No API key needed.

```bash
node test-x402.mjs <evm-private-key> [city]
```

Requires `$0.01` USDC on Arbitrum in your wallet.

## 3. MPP — Tempo Stablecoins

Pay per request via the Machine Payments Protocol (Stripe + Tempo).

```bash
# First time setup
npx mppx account create --account my-app
npx mppx account fund --account my-app

# Test
node test-mpp.mjs <account-name> [city]
```

## Examples

```bash
node test-stripe.mjs sw_abc123 "Haifa"
node test-x402.mjs 0xabc123... "Tel Aviv"
node test-mpp.mjs my-app "Jerusalem"
```

City is optional — defaults vary per script. Pass any Israeli city name in English.
