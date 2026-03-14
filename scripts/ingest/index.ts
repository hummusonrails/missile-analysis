import "dotenv/config";
import { createClient } from "@libsql/client";
import type { Alert } from "../../lib/types";
import { fetchRawAlerts, parseRawAlerts, deduplicateAlerts } from "./fetch-alerts";
import { computeAllAnalytics, computeRegionAnalytics } from "./compute-analytics";

const REGION_IDS = [
  "western-galilee",
  "upper-galilee",
  "lower-galilee",
  "haifa-krayot",
  "jezreel-valley",
  "golan-heights",
  "sharon",
  "tel-aviv-gush-dan",
  "central",
  "jerusalem",
  "shfela",
  "ashkelon-coast",
  "negev",
  "gaza-envelope",
  "eilat-arava",
];

const BATCH_SIZE = 50;

async function main() {
  const db = createClient({
    url: process.env.TURSO_DB_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  // Get consecutive failure count from system_status
  const statusRow = await db.execute(
    "SELECT value FROM system_status WHERE key = 'consecutive_failures'"
  );
  let consecutiveFailures = statusRow.rows.length > 0
    ? Number(statusRow.rows[0][0] ?? 0)
    : 0;

  // Step 1 & 2: Fetch and parse alerts
  let rawAlerts: Awaited<ReturnType<typeof fetchRawAlerts>>;
  try {
    rawAlerts = await fetchRawAlerts();
  } catch (err) {
    consecutiveFailures++;
    console.error(`API fetch failed (consecutive failures: ${consecutiveFailures}):`, err);

    await db.execute({
      sql: "INSERT INTO system_status (key, value) VALUES ('consecutive_failures', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      args: [String(consecutiveFailures)],
    });

    if (consecutiveFailures >= 3) {
      await db.execute({
        sql: "INSERT INTO system_status (key, value) VALUES ('health', 'stale') ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        args: [],
      });
      console.log("System status set to stale after 3 consecutive failures.");
    }

    process.exit(1);
  }

  // Reset consecutive failures on success
  consecutiveFailures = 0;
  await db.execute({
    sql: "INSERT INTO system_status (key, value) VALUES ('consecutive_failures', '0') ON CONFLICT(key) DO UPDATE SET value = '0'",
    args: [],
  });

  const parsedAlerts = parseRawAlerts(rawAlerts);
  console.log(`Parsed ${parsedAlerts.length} alerts from API.`);

  // Step 3: Get existing alert IDs for deduplication
  const existingRows = await db.execute("SELECT id FROM alerts");
  const existingIds = new Set(existingRows.rows.map((r) => String(r[0])));
  console.log(`Found ${existingIds.size} existing alerts in DB.`);

  // Step 4: Deduplicate and insert new alerts in batches of 50
  const newAlerts = deduplicateAlerts(parsedAlerts, existingIds);
  console.log(`Inserting ${newAlerts.length} new alerts.`);

  for (let i = 0; i < newAlerts.length; i += BATCH_SIZE) {
    const batch = newAlerts.slice(i, i + BATCH_SIZE);
    for (const alert of batch) {
      await db.execute({
        sql: "INSERT INTO alerts (id, timestamp, cities, threat, created_at) VALUES (?, ?, ?, ?, ?)",
        args: [
          alert.id,
          alert.timestamp,
          JSON.stringify(alert.cities),
          alert.threat,
          alert.created_at,
        ],
      });
    }
    console.log(`Inserted batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} alerts).`);
  }

  // Step 5: Load all alerts from Turso for analytics computation
  const allRows = await db.execute("SELECT id, timestamp, cities, threat, created_at FROM alerts");
  const allAlerts: Alert[] = allRows.rows.map((r) => ({
    id: String(r[0]),
    timestamp: Number(r[1]),
    cities: JSON.parse(String(r[2])),
    threat: Number(r[3]),
    created_at: Number(r[4]),
  }));
  console.log(`Loaded ${allAlerts.length} total alerts for analytics.`);

  // Step 6: Load city-region mapping from city_coords
  const cityRows = await db.execute("SELECT city_name, region_id FROM city_coords");
  const cityRegionMap = new Map<string, string>();
  for (const row of cityRows.rows) {
    cityRegionMap.set(String(row[0]), String(row[1]));
  }
  console.log(`Loaded ${cityRegionMap.size} city-region mappings.`);

  // Step 7: Log unknown cities
  const unknownCities = new Set<string>();
  for (const alert of allAlerts) {
    for (const city of alert.cities) {
      if (!cityRegionMap.has(city)) {
        unknownCities.add(city);
      }
    }
  }
  if (unknownCities.size > 0) {
    console.log(`Unknown cities (${unknownCities.size}):`, Array.from(unknownCities).sort());
  }

  // Step 8: Compute global analytics
  console.log("Computing global analytics...");
  const globalAnalytics = computeAllAnalytics(allAlerts, cityRegionMap);

  // Step 9: Compute per-region analytics for all 15 regions
  console.log("Computing per-region analytics...");
  const regionAnalyticsMap: Record<string, Record<string, object>> = {};
  for (const regionId of REGION_IDS) {
    regionAnalyticsMap[regionId] = computeRegionAnalytics(allAlerts, regionId, cityRegionMap);
  }

  // Step 10: Store all analytics as JSON blobs in analytics_cache
  const now = Date.now();

  // Store global analytics
  for (const [key, data] of Object.entries(globalAnalytics)) {
    await db.execute({
      sql: "INSERT INTO analytics_cache (key, data, computed_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET data = excluded.data, computed_at = excluded.computed_at",
      args: [key, JSON.stringify(data), now],
    });
  }

  // Store per-region analytics
  for (const regionId of REGION_IDS) {
    const regionData = regionAnalyticsMap[regionId];
    for (const [key, data] of Object.entries(regionData)) {
      const cacheKey = `${key}::${regionId}`;
      await db.execute({
        sql: "INSERT INTO analytics_cache (key, data, computed_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET data = excluded.data, computed_at = excluded.computed_at",
        args: [cacheKey, JSON.stringify(data), now],
      });
    }
  }

  console.log("Analytics stored in cache.");

  // Step 11: Update system_status to healthy
  await db.execute({
    sql: "INSERT INTO system_status (key, value) VALUES ('health', 'healthy') ON CONFLICT(key) DO UPDATE SET value = 'healthy'",
    args: [],
  });
  await db.execute({
    sql: "INSERT INTO system_status (key, value) VALUES ('last_ingest', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    args: [String(now)],
  });

  console.log("Ingest pipeline complete. System status: healthy.");
}

main().catch((err) => {
  console.error("Fatal error in ingest pipeline:", err);
  process.exit(1);
});
