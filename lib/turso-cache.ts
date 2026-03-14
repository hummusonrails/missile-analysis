import { createClient, type Client, type ResultSet } from "@libsql/client/web";

let client: Client | null = null;

function getClient(): Client {
  if (!client) {
    client = createClient({
      url: process.env.NEXT_PUBLIC_TURSO_DB_URL!,
      authToken: process.env.NEXT_PUBLIC_TURSO_READ_TOKEN!,
    });
  }
  return client;
}

const cache = new Map<string, { data: ResultSet; fetchedAt: number }>();
const CACHE_TTL = 60_000; // 60 seconds

export async function cachedQuery(sql: string, args: unknown[] = []): Promise<ResultSet> {
  const cacheKey = `${sql}|${JSON.stringify(args)}`;
  const cached = cache.get(cacheKey);

  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return cached.data;
  }

  const result = await getClient().execute({ sql, args: args as any });
  cache.set(cacheKey, { data: result, fetchedAt: Date.now() });
  return result;
}

export async function directQuery(sql: string, args: unknown[] = []): Promise<ResultSet> {
  return getClient().execute({ sql, args: args as any });
}
