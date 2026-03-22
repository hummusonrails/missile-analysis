#!/usr/bin/env node
/**
 * Test 2: x402 Pay-per-request with USDC on Arbitrum
 * Usage: node test-x402.mjs <evm-private-key>
 * Example: node test-x402.mjs 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
 *
 * Requires USDC on Arbitrum One in the wallet ($0.01 per request).
 */

import { wrapFetchWithPayment, x402Client } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";

const PRIVATE_KEY = process.argv[2];
if (!PRIVATE_KEY) {
  console.error("Usage: node test-x402.mjs <evm-private-key>");
  console.error("Needs $0.01 USDC on Arbitrum One in the wallet.");
  process.exit(1);
}

const MCP_URL = "https://mcp.sirenwise.com/mcp";

// Set up x402 client with your wallet
const signer = privateKeyToAccount(PRIVATE_KEY);
console.log(`Wallet: ${signer.address}`);

const client = new x402Client();
registerExactEvmScheme(client, { signer });

const paidFetch = wrapFetchWithPayment(fetch, client);

console.log("Calling MCP tool with x402 payment...\n");

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
      params: {
        name: "get_daily_context",
        arguments: { city: "Jerusalem" },
      },
      id: 1,
    }),
  });

  const text = await res.text();
  const dataLine = text.split("\n").find((l) => l.startsWith("data: "));
  if (dataLine) {
    const data = JSON.parse(dataLine.slice(6));
    if (data.result?.content?.[0]?.text) {
      console.log("✓ x402 payment successful!\n");
      console.log(data.result.content[0].text);
    } else if (data.result?.isError) {
      console.error("✗ Error:", data.result.content[0].text);
    }
  } else {
    console.log("Raw response:", text);
  }
} catch (err) {
  console.error("✗ x402 payment failed:", err.message);
}
