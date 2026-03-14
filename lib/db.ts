import { createClient } from "@libsql/client";

// Server-side client (read-write, used by API routes and ingestion)
export function createServerClient() {
  const url = process.env.TURSO_DB_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url || !authToken) {
    throw new Error(`Missing Turso env vars: url=${url ? "set" : "MISSING"}, token=${authToken ? "set" : "MISSING"}`);
  }

  return createClient({ url, authToken });
}
