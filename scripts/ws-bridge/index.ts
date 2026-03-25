/**
 * Tzofar WebSocket Bridge
 *
 * Connects to the Tzofar (Tzeva Adom) WebSocket and captures SYSTEM_MESSAGE
 * events — pre-alert warnings and exit notifications. Writes them to the
 * pre_alerts table in Turso.
 *
 * Run: npx tsx scripts/ws-bridge/index.ts
 * Or via npm: npm run ws-bridge
 *
 * Designed to run as a long-lived process (e.g., systemd service on a VPS).
 */

import WebSocket from "ws";
import { createClient } from "@libsql/client";
import { config } from "dotenv";
import { classifySystemMessage, generatePreAlertId } from "./classify";

config({ path: ".env.local" });

// --- Configuration ---

const WS_URL = "wss://ws.tzevaadom.co.il/socket?platform=ANDROID";
const RECONNECT_BASE_MS = 10_000;
const RECONNECT_MAX_MS = 60_000;
const RECONNECT_BACKOFF = 1.5;
const PING_INTERVAL_MS = 60_000;
const PONG_TIMEOUT_MS = 420_000;

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

const db = createDb();

// --- City ID → Region mapping ---

// Tzofar area codes → SirenWise region IDs (from fill-missing-cities.ts)
const AREA_TO_REGION: Record<number, string> = {
  1: "upper-galilee",
  2: "negev",
  3: "shfela",
  4: "lower-galilee",
  5: "jezreel-valley",
  6: "upper-galilee",
  7: "shfela",
  9: "sharon",
  10: "golan-heights",
  11: "yehuda-vshomron",
  12: "negev",
  13: "gaza-envelope",
  14: "yehuda-vshomron",
  15: "jezreel-valley",
  16: "lower-galilee",
  17: "negev",
  18: "tel-aviv-gush-dan",
  19: "haifa-krayot",
  20: "tel-aviv-gush-dan",
  21: "ashkelon-coast",
  22: "haifa-krayot",
  23: "shfela",
  24: "negev",
  25: "jezreel-valley",
  26: "eilat-arava",
  27: "eilat-arava",
  28: "golan-heights",
  29: "yehuda-vshomron",
  32: "jerusalem",
  34: "jezreel-valley",
};

let cityIdToRegion: Map<number, string> | null = null;

const TZOFAR_CITIES_URL = "https://www.tzevaadom.co.il/static/cities.json";

interface TzofarCity {
  id: number;
  he: string;
  en: string;
  area: number;
  lat: number;
  lng: number;
}

async function loadCityIdMapping(): Promise<void> {
  try {
    const res = await fetch(TZOFAR_CITIES_URL);
    const data = await res.json();
    const cities = data.cities as Record<string, TzofarCity>;

    cityIdToRegion = new Map();
    for (const city of Object.values(cities)) {
      const region = AREA_TO_REGION[city.area];
      if (region) {
        cityIdToRegion.set(city.id, region);
      }
    }

    console.log(`[bridge] Loaded ${cityIdToRegion.size} city ID → region mappings`);
  } catch (err) {
    console.error("[bridge] Failed to load city mapping, regions will be empty:", err);
    cityIdToRegion = new Map();
  }
}

// --- WebSocket message types ---

interface SystemMessageData {
  titleHe?: string;
  bodyHe?: string;
  citiesIds?: number[];
}

interface WsMessage {
  type?: string;
  data?: SystemMessageData;
}

// --- Deduplication ---

const recentIds = new Set<string>();
const MAX_RECENT = 500;

function trackId(id: string): boolean {
  if (recentIds.has(id)) return false;
  recentIds.add(id);
  if (recentIds.size > MAX_RECENT) {
    const first = recentIds.values().next().value;
    if (first !== undefined) recentIds.delete(first);
  }
  return true;
}

// --- Process a SYSTEM_MESSAGE ---

async function handleSystemMessage(data: SystemMessageData): Promise<void> {
  const titleHe = data.titleHe ?? "";
  const bodyHe = data.bodyHe ?? "";
  const cityIds = data.citiesIds ?? [];

  if (!titleHe && !bodyHe) return;

  const classification = classifySystemMessage(titleHe, bodyHe);
  if (!classification) {
    console.log(`[bridge] Unclassified system message: "${titleHe}" — skipping`);
    return;
  }

  const now = Date.now();
  const id = generatePreAlertId(now, titleHe, bodyHe);

  if (!trackId(id)) {
    console.log(`[bridge] Duplicate pre-alert ${id} — skipping`);
    return;
  }

  // Resolve regions from city IDs (empty array until mapping is populated)
  const regions: string[] = [];
  if (cityIdToRegion) {
    for (const cid of cityIds) {
      const region = cityIdToRegion.get(cid);
      if (region) regions.push(region);
    }
  }

  console.log(
    `[bridge] ${classification.type} (${classification.confidence}): "${titleHe}" — ${cityIds.length} cities, ${regions.length} regions`
  );

  await db.execute({
    sql: `INSERT OR IGNORE INTO pre_alerts (id, timestamp, title_he, body_he, city_ids, regions, alert_type, raw_data, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      now,
      titleHe,
      bodyHe,
      JSON.stringify(cityIds),
      JSON.stringify([...new Set(regions)]),
      classification.type,
      JSON.stringify(data),
      now,
    ],
  });

  console.log(`[bridge] Stored pre-alert ${id}`);
}

// --- WebSocket connection ---

let ws: WebSocket | null = null;
let reconnectDelay = RECONNECT_BASE_MS;
let pingTimer: ReturnType<typeof setInterval> | null = null;
let pongTimer: ReturnType<typeof setTimeout> | null = null;

function randomHex(length: number): string {
  const chars = "0123456789abcdef";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * 16)];
  }
  return result;
}

function connect(): void {
  console.log(`[bridge] Connecting to ${WS_URL}`);

  ws = new WebSocket(WS_URL, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
      Referer: "https://www.tzevaadom.co.il",
      Origin: "https://www.tzevaadom.co.il",
      tzofar: randomHex(32),
    },
  });

  ws.on("open", () => {
    console.log("[bridge] Connected");
    reconnectDelay = RECONNECT_BASE_MS;

    // Start ping interval
    pingTimer = setInterval(() => {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.ping();
        pongTimer = setTimeout(() => {
          console.log("[bridge] Pong timeout — closing");
          ws?.terminate();
        }, PONG_TIMEOUT_MS);
      }
    }, PING_INTERVAL_MS);
  });

  ws.on("pong", () => {
    if (pongTimer) {
      clearTimeout(pongTimer);
      pongTimer = null;
    }
  });

  ws.on("message", async (raw) => {
    const text = raw.toString().trim();
    if (!text || text.length < 2) return; // skip empty keepalive frames

    let msg: WsMessage;
    try {
      msg = JSON.parse(text);
    } catch {
      // Not JSON — likely a ping/pong text frame, skip silently
      return;
    }

    try {
      if (msg.type === "SYSTEM_MESSAGE" && msg.data) {
        await handleSystemMessage(msg.data);
      }
      // We intentionally skip ALERT messages — those are captured by the existing
      // REST-based ingestion pipeline.
    } catch (err) {
      console.error("[bridge] Failed to process message:", err);
    }
  });

  ws.on("close", (code, reason) => {
    console.log(`[bridge] Disconnected: ${code} ${reason.toString()}`);
    cleanup();
    scheduleReconnect();
  });

  ws.on("error", (err) => {
    console.error("[bridge] WebSocket error:", err.message);
    cleanup();
    scheduleReconnect();
  });
}

function cleanup(): void {
  if (pingTimer) {
    clearInterval(pingTimer);
    pingTimer = null;
  }
  if (pongTimer) {
    clearTimeout(pongTimer);
    pongTimer = null;
  }
  ws = null;
}

function scheduleReconnect(): void {
  console.log(`[bridge] Reconnecting in ${Math.round(reconnectDelay / 1000)}s`);
  setTimeout(() => {
    reconnectDelay = Math.min(reconnectDelay * RECONNECT_BACKOFF, RECONNECT_MAX_MS);
    connect();
  }, reconnectDelay);
}

// --- Graceful shutdown ---

function shutdown(signal: string): void {
  console.log(`[bridge] ${signal} received — shutting down`);
  if (ws) {
    ws.close(1000, "shutdown");
    ws = null;
  }
  cleanup();
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

// --- Main ---

async function main(): Promise<void> {
  console.log("[bridge] Tzofar WebSocket Bridge starting");
  await loadCityIdMapping();
  connect();
}

main().catch((err) => {
  console.error("[bridge] Fatal error:", err);
  process.exit(1);
});
