import { createClient } from "@libsql/client/http";

// Server-side client using HTTP transport (works on Vercel serverless)
export function createServerClient() {
  const url = process.env.TURSO_DB_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url || !authToken) {
    throw new Error(`Missing Turso env vars: url=${url ? "set" : "MISSING"}, token=${authToken ? "set" : "MISSING"}`);
  }

  // @libsql/client/http expects https:// not libsql://
  const httpUrl = url.replace(/^libsql:\/\//, "https://");

  return createClient({ url: httpUrl, authToken });
}
