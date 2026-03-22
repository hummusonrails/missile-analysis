// lib/api-keys.ts
import { createHash, randomBytes } from "crypto";

export function generateApiKey(): string {
  return "sw_" + randomBytes(32).toString("base64url");
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function keyPrefix(key: string): string {
  return key.slice(0, 8);
}

export async function storeApiKey(key: string, email: string, sessionId: string, credits: number = 1000) {
  const writeToken = process.env.TURSO_WRITE_TOKEN;
  if (!writeToken) throw new Error("TURSO_WRITE_TOKEN not set");

  const url = process.env.TURSO_DB_URL?.trim().replace("libsql://", "https://");
  if (!url) throw new Error("TURSO_DB_URL not set");

  const resp = await fetch(`${url}/v2/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${writeToken.trim()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      requests: [
        {
          type: "execute",
          stmt: {
            sql: "INSERT INTO api_keys (key_hash, key_prefix, owner_email, credits_remaining, created_at, stripe_session_id) VALUES (?, ?, ?, ?, ?, ?)",
            args: [
              { type: "text", value: hashApiKey(key) },
              { type: "text", value: keyPrefix(key) },
              { type: "text", value: email },
              { type: "integer", value: String(credits) },
              { type: "integer", value: String(Date.now()) },
              { type: "text", value: sessionId },
            ],
          },
        },
      ],
    }),
  });

  if (!resp.ok) throw new Error(`Turso write failed: ${resp.status}`);
}
