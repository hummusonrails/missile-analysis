/**
 * Pre-Alert Polling Ingestion
 *
 * Connects to the Tzofar WebSocket for a brief window, captures any
 * SYSTEM_MESSAGE events (pre-alerts), and writes them to Turso.
 * Designed to run as a GitHub Actions cron job every 5 minutes.
 *
 * The WebSocket connection stays open for LISTEN_DURATION_MS to catch
 * any buffered or live system messages, then cleanly disconnects.
 */

import WebSocket from "ws";
import { createClient } from "@libsql/client";
import { config } from "dotenv";
import { classifySystemMessage, generatePreAlertId } from "./ws-bridge/classify";

config({ path: ".env.local" });

// --- Configuration ---

const WS_URL = "wss://ws.tzevaadom.co.il/socket?platform=ANDROID";
const LISTEN_DURATION_MS = 15_000; // Listen for 15 seconds
const CONNECT_TIMEOUT_MS = 10_000; // Give up connecting after 10 seconds

// Tzofar area codes → SirenWise region IDs
const AREA_TO_REGION: Record<number, string> = {
  1: "upper-galilee", 2: "negev", 3: "shfela", 4: "lower-galilee",
  5: "jezreel-valley", 6: "upper-galilee", 7: "shfela", 9: "sharon",
  10: "golan-heights", 11: "yehuda-vshomron", 12: "negev", 13: "gaza-envelope",
  14: "yehuda-vshomron", 15: "jezreel-valley", 16: "lower-galilee",
  17: "negev", 18: "tel-aviv-gush-dan", 19: "haifa-krayot",
  20: "tel-aviv-gush-dan", 21: "ashkelon-coast", 22: "haifa-krayot",
  23: "shfela", 24: "negev", 25: "jezreel-valley", 26: "eilat-arava",
  27: "eilat-arava", 28: "golan-heights", 29: "yehuda-vshomron",
  32: "jerusalem", 34: "jezreel-valley",
};

// --- Database ---

function createDb() {
  const url = process.env.TURSO_DB_URL?.trim().replace(/^libsql:\/\//, "https://");
  const authToken = process.env.TURSO_AUTH_TOKEN?.trim();
  if (!url || !authToken) {
    console.error("Missing TURSO_DB_URL or TURSO_AUTH_TOKEN");
    process.exit(1);
  }
  return createClient({ url, authToken });
}

// --- City ID → Region mapping ---

interface TzofarCity {
  id: number;
  he: string;
  en: string;
  area: number;
}

async function loadCityIdMapping(): Promise<Map<number, string>> {
  try {
    const res = await fetch("https://www.tzevaadom.co.il/static/cities.json");
    const data = await res.json();
    const cities = data.cities as Record<string, TzofarCity>;
    const mapping = new Map<number, string>();
    for (const city of Object.values(cities)) {
      const region = AREA_TO_REGION[city.area];
      if (region) mapping.set(city.id, region);
    }
    console.log(`Loaded ${mapping.size} city ID → region mappings`);
    return mapping;
  } catch (err) {
    console.error("Failed to load city mapping:", err);
    return new Map();
  }
}

// --- Message types ---

interface SystemMessageData {
  titleHe?: string;
  bodyHe?: string;
  citiesIds?: number[];
}

interface WsMessage {
  type?: string;
  data?: SystemMessageData;
}

// --- Main ---

function randomHex(length: number): string {
  const chars = "0123456789abcdef";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * 16)];
  }
  return result;
}

async function main(): Promise<void> {
  console.log("Pre-alert polling ingestion starting");

  const db = createDb();
  const cityIdToRegion = await loadCityIdMapping();

  // Load existing recent IDs for deduplication
  const recentResult = await db.execute({
    sql: "SELECT id FROM pre_alerts WHERE timestamp > ? ORDER BY timestamp DESC LIMIT 100",
    args: [Date.now() - 60 * 60_000], // last hour
  });
  const existingIds = new Set(recentResult.rows.map((r) => String(r.id)));
  console.log(`${existingIds.size} existing pre-alerts in last hour`);

  // Collect messages
  const collected: { data: SystemMessageData; receivedAt: number }[] = [];

  await new Promise<void>((resolve, reject) => {
    const connectTimer = setTimeout(() => {
      console.log("Connection timeout — no WebSocket connection established");
      resolve();
    }, CONNECT_TIMEOUT_MS);

    const ws = new WebSocket(WS_URL, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
        Referer: "https://www.tzevaadom.co.il",
        Origin: "https://www.tzevaadom.co.il",
        tzofar: randomHex(32),
      },
    });

    let listenTimer: ReturnType<typeof setTimeout> | null = null;

    ws.on("open", () => {
      clearTimeout(connectTimer);
      console.log("Connected — listening for system messages");

      listenTimer = setTimeout(() => {
        console.log(`Listen window complete (${LISTEN_DURATION_MS / 1000}s)`);
        ws.close(1000, "polling complete");
      }, LISTEN_DURATION_MS);
    });

    ws.on("message", (raw) => {
      const text = raw.toString().trim();
      if (!text || text.length < 2) return;

      let msg: WsMessage;
      try {
        msg = JSON.parse(text);
      } catch {
        return; // skip non-JSON frames
      }

      if (msg.type === "SYSTEM_MESSAGE" && msg.data) {
        collected.push({ data: msg.data, receivedAt: Date.now() });
        console.log(`Captured system message: "${msg.data.titleHe}"`);
      }
    });

    ws.on("close", () => {
      if (listenTimer) clearTimeout(listenTimer);
      clearTimeout(connectTimer);
      resolve();
    });

    ws.on("error", (err) => {
      if (listenTimer) clearTimeout(listenTimer);
      clearTimeout(connectTimer);
      console.error("WebSocket error:", err.message);
      resolve(); // don't fail the job, just log
    });
  });

  // Process collected messages
  console.log(`\nCollected ${collected.length} system messages`);
  let stored = 0;

  for (const { data, receivedAt } of collected) {
    const titleHe = data.titleHe ?? "";
    const bodyHe = data.bodyHe ?? "";
    const cityIds = data.citiesIds ?? [];

    if (!titleHe && !bodyHe) continue;

    const classification = classifySystemMessage(titleHe, bodyHe);
    if (!classification) {
      console.log(`Unclassified: "${titleHe}" — skipping`);
      continue;
    }

    const id = generatePreAlertId(receivedAt, titleHe, bodyHe);
    if (existingIds.has(id)) {
      console.log(`Duplicate: ${id} — skipping`);
      continue;
    }

    // Resolve regions
    const regions: string[] = [];
    for (const cid of cityIds) {
      const region = cityIdToRegion.get(cid);
      if (region) regions.push(region);
    }

    console.log(`Storing ${classification.type}: "${titleHe}" — ${[...new Set(regions)].length} regions`);

    await db.execute({
      sql: `INSERT OR IGNORE INTO pre_alerts (id, timestamp, title_he, body_he, city_ids, regions, alert_type, raw_data, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id, receivedAt, titleHe, bodyHe,
        JSON.stringify(cityIds),
        JSON.stringify([...new Set(regions)]),
        classification.type,
        JSON.stringify(data),
        receivedAt,
      ],
    });
    stored++;
  }

  console.log(`\nDone. Stored ${stored} new pre-alerts.`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
