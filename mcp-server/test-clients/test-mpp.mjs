#!/usr/bin/env node
/**
 * Test 3: MPP Pay-per-request via Tempo stablecoins
 * Usage: node test-mpp.mjs <tempo-private-key>
 *
 * Requires stablecoins on Tempo mainnet in the wallet ($0.01 per request).
 */

import { Mppx, tempo } from "mppx/client";

const PRIVATE_KEY = process.argv[2];
if (!PRIVATE_KEY) {
  console.error("Usage: node test-mpp.mjs <tempo-private-key>");
  console.error("Needs stablecoins on Tempo mainnet in the wallet.");
  process.exit(1);
}

const MCP_URL = "https://mcp.sirenwise.com/mcp";

console.log("Calling MCP tool with MPP payment...\n");

try {
  const mppxClient = Mppx.create({
    methods: [
      tempo({
        privateKey: PRIVATE_KEY,
        chainId: 4217,
        rpcUrl: "https://rpc.tempo.xyz",
      }),
    ],
  });

  const res = await mppxClient.fetch(MCP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "get_streak",
        arguments: { city: "Beer Sheva" },
      },
      id: 1,
    }),
  });

  const text = await res.text();
  const dataLine = text.split("\n").find((l) => l.startsWith("data: "));
  if (dataLine) {
    const data = JSON.parse(dataLine.slice(6));
    if (data.result?.content?.[0]?.text) {
      console.log("✓ MPP payment successful!\n");
      console.log(data.result.content[0].text);
    } else if (data.result?.isError) {
      console.error("✗ Error:", data.result.content[0].text);
    }
  } else {
    console.log("Raw response:", text);
  }
} catch (err) {
  console.error("✗ MPP payment failed:", err.message);
}
