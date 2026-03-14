import { createClient } from "@libsql/client";

function resolveUrl(url: string): string {
  // Turso's libsql:// scheme needs to be converted to https:// for HTTP transport
  return url.replace(/^libsql:\/\//, "https://");
}

// Server-side client (read-write, used by API routes and ingestion)
export function createServerClient() {
  return createClient({
    url: resolveUrl(process.env.TURSO_DB_URL!),
    authToken: process.env.TURSO_AUTH_TOKEN!,
  });
}
