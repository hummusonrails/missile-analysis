import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@libsql/client";

async function main() {
  const db = createClient({
    url: process.env.TURSO_DB_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  });

  console.log("Fetching historical alerts from tzevaadom.co.il...");
  const res = await fetch("https://www.tzevaadom.co.il/static/historical/all.json");
  const data: [number, number, string[], number][] = await res.json();
  console.log(`Downloaded ${data.length} historical alerts.`);

  // Get existing IDs to avoid duplicates
  const existingRows = await db.execute("SELECT id FROM alerts");
  const existingIds = new Set(existingRows.rows.map((r) => String(r.id ?? r[0])));
  console.log(`Found ${existingIds.size} existing alerts in DB.`);

  // Filter to last 2 weeks only
  const twoWeeksAgo = Math.floor(Date.now() / 1000) - 14 * 24 * 60 * 60;
  const recentData = data.filter((entry) => entry[3] >= twoWeeksAgo);
  console.log(`${recentData.length} alerts from the last 2 weeks.`);

  // Convert to our format: [group_id, threat, [cities], timestamp_seconds]
  const alerts = recentData
    .filter((entry) => entry.length >= 4 && Array.isArray(entry[2]) && entry[2].length > 0)
    .map((entry) => ({
      id: `${entry[0]}_${entry[3] * 1000}`,
      timestamp: entry[3] * 1000,
      cities: entry[2],
      threat: entry[1],
      created_at: Date.now(),
    }))
    .filter((a) => !existingIds.has(a.id));

  console.log(`${alerts.length} new alerts to import (after deduplication).`);

  // Insert in batches of 50
  const BATCH_SIZE = 50;
  let inserted = 0;

  for (let i = 0; i < alerts.length; i += BATCH_SIZE) {
    const batch = alerts.slice(i, i + BATCH_SIZE);
    await db.batch(
      batch.map((a) => ({
        sql: "INSERT OR IGNORE INTO alerts (id, timestamp, cities, threat, created_at) VALUES (?, ?, ?, ?, ?)",
        args: [a.id, a.timestamp, JSON.stringify(a.cities), a.threat, a.created_at],
      }))
    );
    inserted += batch.length;
    if (inserted % 500 === 0 || inserted === alerts.length) {
      console.log(`  Imported ${inserted}/${alerts.length}`);
    }
  }

  console.log(`\nImport complete. ${inserted} alerts added.`);
  console.log("Run 'npm run ingest' to recompute analytics with the full dataset.");
}

main().catch((err) => {
  console.error("Import failed:", err);
  process.exit(1);
});
