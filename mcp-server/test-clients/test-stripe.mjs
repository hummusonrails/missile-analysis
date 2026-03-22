#!/usr/bin/env node
/**
 * Test 1: Stripe API Key
 * Usage: node test-stripe.mjs <api-key>
 * Example: node test-stripe.mjs sw_your_api_key_here
 */

const API_KEY = process.argv[2];
if (!API_KEY) {
  console.error("Usage: node test-stripe.mjs <api-key>");
  process.exit(1);
}

const MCP_URL = "https://mcp.sirenwise.com/mcp";

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
    params: {
      name: "get_daily_context",
      arguments: { city: "Tel Aviv" },
    },
    id: 1,
  }),
});

const text = await res.text();
// Parse SSE format
const dataLine = text.split("\n").find((l) => l.startsWith("data: "));
if (dataLine) {
  const data = JSON.parse(dataLine.slice(6));
  if (data.result?.content?.[0]?.text) {
    console.log("✓ Stripe API key works!\n");
    console.log(data.result.content[0].text);
  } else if (data.result?.isError) {
    console.error("✗ Error:", data.result.content[0].text);
  }
} else {
  console.log("Raw response:", text);
}
