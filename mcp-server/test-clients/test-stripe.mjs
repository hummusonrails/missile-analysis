#!/usr/bin/env node
/**
 * SirenWise API — Test with Stripe API Key
 *
 * Get a key at https://sirenwise.com/developer ($10 for 1,000 requests)
 *
 * Usage:  node test-stripe.mjs <api-key>
 * Setup:  npm install  (no dependencies needed, uses native fetch)
 */

const API_KEY = process.argv[2];
if (!API_KEY) {
  console.error("Usage: node test-stripe.mjs <api-key>");
  console.error("Get a key at https://sirenwise.com/developer");
  process.exit(1);
}

const MCP_URL = "https://mcp.sirenwise.com/mcp";
const CITY = process.argv[3] || "Tel Aviv";

console.log(`Querying SirenWise for ${CITY}...\n`);

const res = await fetch(MCP_URL, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
    Authorization: `Bearer ${API_KEY}`,
  },
  body: JSON.stringify({
    jsonrpc: "2.0",
    method: "tools/call",
    params: { name: "get_daily_context", arguments: { city: CITY } },
    id: 1,
  }),
});

if (res.status !== 200) {
  console.error(`✗ HTTP ${res.status}:`, await res.text());
  process.exit(1);
}

const text = await res.text();
const dataLine = text.split("\n").find((l) => l.startsWith("data: "));
if (!dataLine) { console.log("Response:", text); process.exit(1); }

const data = JSON.parse(dataLine.slice(6));
if (data.result?.isError) {
  console.error("✗", data.result.content[0].text);
  process.exit(1);
}
console.log("✓ Success\n");
console.log(data.result.content[0].text);
