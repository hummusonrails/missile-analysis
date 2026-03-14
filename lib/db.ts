import { createClient } from "@libsql/client";

// Server-side client (read-write, used by ingestion)
export function createServerClient() {
  return createClient({
    url: process.env.TURSO_DB_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  });
}

// Client-side client (read-only, used by browser)
export function createBrowserClient() {
  return createClient({
    url: process.env.NEXT_PUBLIC_TURSO_DB_URL!,
    authToken: process.env.NEXT_PUBLIC_TURSO_READ_TOKEN!,
  });
}
