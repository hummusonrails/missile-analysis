#!/usr/bin/env node
/**
 * SirenWise API — Test with MPP (Tempo stablecoins)
 *
 * Pay per request via the Machine Payments Protocol (Stripe + Tempo).
 * Uses the mppx CLI with keys stored in your macOS keychain.
 *
 * Setup:
 *   npm install
 *   npx mppx account create --account <name>
 *   npx mppx account fund --account <name>     (testnet tokens)
 *
 * Usage:  node test-mpp.mjs <account-name> [city]
 */

import { execSync } from "child_process";

const ACCOUNT = process.argv[2];
if (!ACCOUNT) {
  console.error("Usage: node test-mpp.mjs <account-name> [city]");
  console.error("\nSetup:");
  console.error("  npx mppx account create --account my-app");
  console.error("  npx mppx account fund --account my-app");
  process.exit(1);
}

const MCP_URL = "https://mcp.sirenwise.com/mcp";
const CITY = process.argv[3] || "Beer Sheva";

console.log(`Using mppx account: ${ACCOUNT}`);
console.log(`Querying SirenWise for ${CITY} (paying via Tempo)...\n`);

try {
  const body = JSON.stringify({
    jsonrpc: "2.0",
    method: "tools/call",
    params: { name: "get_streak", arguments: { city: CITY } },
    id: 1,
  });

  const result = execSync(
    `npx mppx "${MCP_URL}" --method POST --account ${ACCOUNT} -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" --data '${body}'`,
    { encoding: "utf-8", timeout: 60000, cwd: import.meta.dirname }
  );

  console.log("✓ MPP payment successful\n");
  console.log(result);
} catch (err) {
  const output = err.stdout || err.stderr || err.message;
  console.error("✗ Payment failed:", output);
  process.exit(1);
}
