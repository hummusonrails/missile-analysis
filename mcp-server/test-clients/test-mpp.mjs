#!/usr/bin/env node
/**
 * Test 3: MPP Pay-per-request via Tempo stablecoins
 *
 * Uses the mppx CLI — keys stored in macOS keychain.
 * Requires a funded mppx account.
 *
 * Usage: node test-mpp.mjs [account-name]
 * Default: "sirenwise-main"
 *
 * Setup:
 *   npx mppx account create --account sirenwise-main
 *   npx mppx account view --account sirenwise-main  (get address)
 *   Fund the address with USDC on Tempo mainnet
 */

import { execSync } from "child_process";

const ACCOUNT = process.argv[2] || "sirenwise-main";
const MCP_URL = "https://mcp.sirenwise.com/mcp";

console.log(`Using mppx account: ${ACCOUNT}`);
console.log("Calling MCP tool with MPP payment...\n");

try {
  const body = JSON.stringify({
    jsonrpc: "2.0",
    method: "tools/call",
    params: {
      name: "get_streak",
      arguments: { city: "Beer Sheva" },
    },
    id: 1,
  });

  const result = execSync(
    `npx mppx "${MCP_URL}" --method POST --account ${ACCOUNT} -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" --data '${body}'`,
    { encoding: "utf-8", timeout: 60000, cwd: import.meta.dirname }
  );

  console.log("✓ MPP response:\n");
  console.log(result);
} catch (err) {
  const stderr = err.stderr || "";
  const stdout = err.stdout || "";
  if (stdout) console.log("Output:", stdout);
  if (stderr) console.error("Error:", stderr);
  if (!stdout && !stderr) console.error("✗ MPP payment failed:", err.message);
}
