#!/usr/bin/env node
/**
 * SirenWise API — Test with x402 (USDC on Arbitrum)
 *
 * Pay per request. No API key needed — just a wallet with USDC on Arbitrum One.
 * Each request costs $0.01 USDC.
 *
 * Usage:  node test-x402.mjs <evm-private-key> [city]
 * Setup:  npm install
 */

import { wrapFetchWithPayment, x402Client } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";

const PRIVATE_KEY = process.argv[2];
if (!PRIVATE_KEY) {
  console.error("Usage: node test-x402.mjs <evm-private-key> [city]");
  console.error("Requires $0.01 USDC on Arbitrum One.");
  process.exit(1);
}

const MCP_URL = "https://mcp.sirenwise.com/mcp";
const CITY = process.argv[3] || "Jerusalem";

const signer = privateKeyToAccount(PRIVATE_KEY);
console.log(`Wallet: ${signer.address}`);
console.log(`Querying SirenWise for ${CITY} (paying $0.01 USDC on Arbitrum)...\n`);

const client = new x402Client();
registerExactEvmScheme(client, { signer });
const paidFetch = wrapFetchWithPayment(fetch, client);

try {
  const res = await paidFetch(MCP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "tools/call",
      params: { name: "get_daily_context", arguments: { city: CITY } },
      id: 1,
    }),
  });

  const text = await res.text();
  const dataLine = text.split("\n").find((l) => l.startsWith("data: "));
  if (!dataLine) { console.log("Response:", text); process.exit(1); }

  const data = JSON.parse(dataLine.slice(6));
  if (data.result?.isError) {
    console.error("✗", data.result.content[0].text);
    process.exit(1);
  }
  console.log("✓ x402 payment successful\n");
  console.log(data.result.content[0].text);
} catch (err) {
  console.error("✗ Payment failed:", err.message);
  process.exit(1);
}
