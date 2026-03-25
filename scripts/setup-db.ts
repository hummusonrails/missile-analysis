import { createClient } from "@libsql/client";
import { config } from "dotenv";
config({ path: ".env.local" });

async function setupDatabase() {
  const db = createClient({
    url: process.env.TURSO_DB_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  });

  await db.batch([
    {
      sql: `CREATE TABLE IF NOT EXISTS alerts (
        id TEXT PRIMARY KEY,
        timestamp INTEGER NOT NULL,
        cities TEXT NOT NULL,
        threat INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL
      )`,
      args: [],
    },
    {
      sql: `CREATE INDEX IF NOT EXISTS idx_timestamp ON alerts(timestamp)`,
      args: [],
    },
    {
      sql: `CREATE INDEX IF NOT EXISTS idx_threat ON alerts(threat)`,
      args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS analytics_cache (
        key TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        computed_at INTEGER NOT NULL,
        params TEXT
      )`,
      args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS city_coords (
        city_name TEXT PRIMARY KEY,
        city_name_en TEXT,
        lat REAL NOT NULL,
        lng REAL NOT NULL,
        region_id TEXT
      )`,
      args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS pre_alerts (
        id TEXT PRIMARY KEY,
        timestamp INTEGER NOT NULL,
        title_he TEXT NOT NULL,
        body_he TEXT NOT NULL,
        city_ids TEXT,
        regions TEXT,
        alert_type TEXT NOT NULL,
        raw_data TEXT,
        created_at INTEGER NOT NULL
      )`,
      args: [],
    },
    {
      sql: `CREATE INDEX IF NOT EXISTS idx_pre_alerts_timestamp ON pre_alerts(timestamp)`,
      args: [],
    },
    {
      sql: `CREATE INDEX IF NOT EXISTS idx_pre_alerts_type ON pre_alerts(alert_type)`,
      args: [],
    },
  ]);

  console.log("Database schema created successfully.");
  process.exit(0);
}

setupDatabase().catch((err) => {
  console.error("Failed to setup database:", err);
  process.exit(1);
});
