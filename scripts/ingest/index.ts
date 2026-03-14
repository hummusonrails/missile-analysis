import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@libsql/client";
import type { Alert } from "../../lib/types";
import { fetchRawAlerts, parseRawAlerts, deduplicateAlerts } from "./fetch-alerts";
import { computeAllAnalytics, computeRegionAnalytics } from "./compute-analytics";

const REGION_IDS = [
  "western-galilee", "upper-galilee", "lower-galilee", "haifa-krayot",
  "jezreel-valley", "golan-heights", "sharon", "tel-aviv-gush-dan",
  "central", "jerusalem", "shfela", "ashkelon-coast", "negev",
  "gaza-envelope", "eilat-arava",
];

const BATCH_SIZE = 50;

async function main() {
  const db = createClient({
    url: process.env.TURSO_DB_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  // Get current system status from analytics_cache
  const statusRow = await db.execute(
    "SELECT data FROM analytics_cache WHERE key = 'system_status'"
  );
  let systemStatus = statusRow.rows.length > 0
    ? JSON.parse(String(statusRow.rows[0].data ?? statusRow.rows[0][0]))
    : { status: "ok", consecutive_failures: 0, last_success: 0 };

  // Fetch and parse alerts
  let rawAlerts: Awaited<ReturnType<typeof fetchRawAlerts>>;
  try {
    rawAlerts = await fetchRawAlerts();
  } catch (err) {
    systemStatus.consecutive_failures += 1;
    systemStatus.status = systemStatus.consecutive_failures >= 3 ? "stale" : "degraded";
    console.error(`API fetch failed (consecutive failures: ${systemStatus.consecutive_failures}):`, err);

    await db.execute({
      sql: "INSERT INTO analytics_cache (key, data, computed_at) VALUES ('system_status', ?, ?) ON CONFLICT(key) DO UPDATE SET data = excluded.data, computed_at = excluded.computed_at",
      args: [JSON.stringify(systemStatus), Date.now()],
    });

    process.exit(1);
  }

  const parsedAlerts = parseRawAlerts(rawAlerts);
  console.log(`Parsed ${parsedAlerts.length} alerts from API.`);

  // Deduplicate against existing alerts
  const existingRows = await db.execute("SELECT id FROM alerts");
  const existingIds = new Set(existingRows.rows.map((r) => String(r.id ?? r[0])));
  console.log(`Found ${existingIds.size} existing alerts in DB.`);

  const newAlerts = deduplicateAlerts(parsedAlerts, existingIds);
  console.log(`Inserting ${newAlerts.length} new alerts.`);

  // Insert in batches
  for (let i = 0; i < newAlerts.length; i += BATCH_SIZE) {
    const batch = newAlerts.slice(i, i + BATCH_SIZE);
    await db.batch(
      batch.map((alert) => ({
        sql: "INSERT OR IGNORE INTO alerts (id, timestamp, cities, threat, created_at) VALUES (?, ?, ?, ?, ?)",
        args: [alert.id, alert.timestamp, JSON.stringify(alert.cities), alert.threat, alert.created_at],
      }))
    );
    console.log(`Inserted batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} alerts).`);
  }

  // Load all alerts for analytics
  const allRows = await db.execute("SELECT id, timestamp, cities, threat, created_at FROM alerts");
  const allAlerts: Alert[] = allRows.rows.map((r) => ({
    id: String(r.id ?? r[0]),
    timestamp: Number(r.timestamp ?? r[1]),
    cities: JSON.parse(String(r.cities ?? r[2])),
    threat: Number(r.threat ?? r[3]),
    created_at: Number(r.created_at ?? r[4]),
  }));
  console.log(`Loaded ${allAlerts.length} total alerts for analytics.`);

  // Load city-region mapping
  const cityRows = await db.execute("SELECT city_name, region_id FROM city_coords");
  const cityRegionMap = new Map<string, string>();
  for (const row of cityRows.rows) {
    cityRegionMap.set(String(row.city_name ?? row[0]), String(row.region_id ?? row[1]));
  }
  console.log(`Loaded ${cityRegionMap.size} city-region mappings.`);

  // Log unknown cities
  const unknownCities = new Set<string>();
  for (const alert of allAlerts) {
    for (const city of alert.cities) {
      if (!cityRegionMap.has(city)) unknownCities.add(city);
    }
  }
  if (unknownCities.size > 0) {
    console.log(`Unknown cities (${unknownCities.size}):`, Array.from(unknownCities).slice(0, 20).join(", "));
  }

  // Compute global analytics
  console.log("Computing global analytics...");
  const globalAnalytics = computeAllAnalytics(allAlerts, cityRegionMap);

  // Compute per-region analytics
  console.log("Computing per-region analytics...");
  const now = Date.now();
  const analyticsEntries: { sql: string; args: (string | number)[] }[] = [];

  for (const [key, data] of Object.entries(globalAnalytics)) {
    analyticsEntries.push({
      sql: "INSERT INTO analytics_cache (key, data, computed_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET data = excluded.data, computed_at = excluded.computed_at",
      args: [key, JSON.stringify(data), now],
    });
  }

  for (const regionId of REGION_IDS) {
    const regionData = computeRegionAnalytics(allAlerts, regionId, cityRegionMap);
    for (const [key, data] of Object.entries(regionData)) {
      analyticsEntries.push({
        sql: "INSERT INTO analytics_cache (key, data, computed_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET data = excluded.data, computed_at = excluded.computed_at",
        args: [`${key}::${regionId}`, JSON.stringify(data), now],
      });
    }
  }

  // Write analytics in batches
  for (let i = 0; i < analyticsEntries.length; i += BATCH_SIZE) {
    await db.batch(analyticsEntries.slice(i, i + BATCH_SIZE));
  }
  console.log(`Wrote ${analyticsEntries.length} analytics cache entries.`);

  // Update system_status to healthy
  await db.execute({
    sql: "INSERT INTO analytics_cache (key, data, computed_at) VALUES ('system_status', ?, ?) ON CONFLICT(key) DO UPDATE SET data = excluded.data, computed_at = excluded.computed_at",
    args: [JSON.stringify({ status: "ok", consecutive_failures: 0, last_success: now }), now],
  });

  console.log("Ingest pipeline complete.");
}

main().catch((err) => {
  console.error("Fatal error in ingest pipeline:", err);
  process.exit(1);
});
