# Missile Analysis App Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mobile-first, bilingual web app that visualizes Israel missile alert data on an interactive map with selectable analytics dashboards, optimized for Vercel free tier.

**Architecture:** Static Next.js shell with one serverless function (ingest webhook). GitHub Actions polls the Tzeva Adom API every 5 minutes, stores raw alerts and pre-computed analytics in Turso. The client reads directly from Turso edge replicas — no Vercel function invocations for data.

**Tech Stack:** Next.js 16, TypeScript 5, Tailwind CSS 4, Leaflet + react-leaflet, Recharts 3, Turso (libSQL), GitHub Actions, best-time-ui package, Cloudflare

**Spec:** `docs/superpowers/specs/2026-03-14-missile-analysis-app-design.md`

---

## Chunk 1: Project Scaffold & Database

### Task 1: Initialize Next.js Project

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `tailwind.config.ts`
- Create: `app/layout.tsx`
- Create: `app/page.tsx`
- Create: `.gitignore`
- Create: `.env.example`

- [ ] **Step 1: Scaffold Next.js project**

```bash
npx create-next-app@latest . --typescript --tailwind --app --no-src-dir --no-import-alias --skip-install
```

- [ ] **Step 2: Install dependencies**

```bash
npm install leaflet react-leaflet @libsql/client recharts best-time-ui@github:bengreenberg/best-time-ui
npm install -D @types/leaflet
```

- [ ] **Step 3: Create `.env.example`**

```env
NEXT_PUBLIC_TURSO_DB_URL=libsql://your-db.turso.io
NEXT_PUBLIC_TURSO_READ_TOKEN=your-read-only-token
TURSO_DB_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your-read-write-token
INGEST_SECRET=your-shared-secret
```

- [ ] **Step 4: Update `next.config.ts` with security headers**

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: { unoptimized: true },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
```

Note: No `output: "export"` — Vercel automatically statically optimizes pages that don't use server-side features, while still supporting the single `/api/ingest` serverless function. Security headers are set here via `headers()` and will apply on Vercel.

- [ ] **Step 5: Create minimal app/layout.tsx**

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Israel Alert Map",
  description: "Interactive missile alert analysis and visualization",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&family=JetBrains+Mono:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-bg-primary text-text-primary font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 6: Create placeholder app/page.tsx**

```tsx
export default function Home() {
  return (
    <main className="flex items-center justify-center min-h-screen">
      <h1 className="font-serif text-2xl">Israel Alert Map</h1>
    </main>
  );
}
```

- [ ] **Step 7: Configure Tailwind theme**

Update `tailwind.config.ts` with the design system colors, fonts, and custom values:

```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        "bg-primary": "#0B0E14",
        "bg-elevated": "#12161F",
        "bg-surface": "#181D28",
        "bg-surface-hover": "#1E2433",
        "text-primary": "#E8ECF4",
        "text-secondary": "#6B7A90",
        "text-tertiary": "#3D4B5F",
        "accent-blue": "#3B82F6",
        "accent-red": "#EF4444",
        "accent-amber": "#F59E0B",
        "accent-green": "#10B981",
        border: "rgba(255,255,255,0.06)",
        "border-active": "rgba(255,255,255,0.12)",
      },
      fontFamily: {
        sans: ["DM Sans", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
        serif: ["Instrument Serif", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
};

export default config;
```

- [ ] **Step 8: Verify dev server runs**

```bash
npm run dev
```

Expected: App loads at localhost:3000 with "Israel Alert Map" centered on dark background.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js project with Tailwind theme and design tokens"
```

---

### Task 2: Turso Database Schema

**Files:**
- Create: `lib/db.ts`
- Create: `scripts/setup-db.ts`

- [ ] **Step 1: Create `lib/db.ts` — Turso client factory**

```typescript
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
```

- [ ] **Step 2: Create `scripts/setup-db.ts` — schema migration**

```typescript
import { createClient } from "@libsql/client";
import "dotenv/config";

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
  ]);

  console.log("Database schema created successfully.");
  process.exit(0);
}

setupDatabase().catch((err) => {
  console.error("Failed to setup database:", err);
  process.exit(1);
});
```

- [ ] **Step 3: Install dotenv and add setup script to package.json**

```bash
npm install -D dotenv tsx
```

Add to `package.json` scripts:
```json
"db:setup": "tsx scripts/setup-db.ts"
```

- [ ] **Step 4: Create `.env.local` with real Turso credentials and run setup**

```bash
# Create Turso database first:
# turso db create missile-analysis
# turso db tokens create missile-analysis
# turso db tokens create missile-analysis --read-only
# Then populate .env.local with the values

npm run db:setup
```

Expected: "Database schema created successfully."

- [ ] **Step 5: Commit**

```bash
git add lib/db.ts scripts/setup-db.ts package.json
git commit -m "feat: add Turso database schema and setup script"
```

---

### Task 3: City Coordinates Seed Script

**Files:**
- Create: `scripts/seed-cities.ts`
- Create: `lib/types.ts`

- [ ] **Step 1: Create `lib/types.ts` — shared type definitions**

```typescript
export interface Alert {
  id: string;
  timestamp: number;
  cities: string[];
  threat: number;
  created_at: number;
}

export interface CityCoord {
  city_name: string;
  city_name_en: string;
  lat: number;
  lng: number;
  region_id: string;
}

export interface AnalyticsCacheEntry {
  key: string;
  data: string; // JSON blob
  computed_at: number;
  params?: string;
}

export type ThreatLevel = 0 | 1 | 2 | 3;

export type TimeRange = "24h" | "7d" | "30d" | "custom";

export interface FilterState {
  timeRange: TimeRange;
  customStart?: number;
  customEnd?: number;
  regionId: string | null; // null = all regions
}

export interface AnalyticsPanel {
  key: string;
  labelEn: string;
  labelHe: string;
}

export const ANALYTICS_PANELS: AnalyticsPanel[] = [
  { key: "shabbat_vs_weekday", labelEn: "Shabbat vs Weekday", labelHe: "שבת מול ימי חול" },
  { key: "hourly_histogram", labelEn: "Hourly Pattern", labelHe: "דפוס שעתי" },
  { key: "monthly_trends", labelEn: "Monthly Trends", labelHe: "מגמות חודשיות" },
  { key: "escalation_patterns", labelEn: "Escalation", labelHe: "הסלמה" },
  { key: "quiet_vs_active", labelEn: "Quiet Periods", labelHe: "תקופות שקט" },
  { key: "multi_city_correlation", labelEn: "Multi-Region", labelHe: "ריבוי אזורים" },
  { key: "time_between_alerts", labelEn: "Alert Gaps", labelHe: "מרווחים" },
  { key: "geographic_spread", labelEn: "Geo Spread", labelHe: "פיזור גיאוגרפי" },
  { key: "threat_distribution", labelEn: "Threat Levels", labelHe: "רמות איום" },
  { key: "morning_vs_evening", labelEn: "AM vs PM", labelHe: "בוקר מול ערב" },
  { key: "day_of_week", labelEn: "Day of Week", labelHe: "יום בשבוע" },
];
```

- [ ] **Step 2: Extract city mappings from best-shower-time**

```typescript
import { createClient } from "@libsql/client";
import "dotenv/config";

// Import city mappings — adjust path based on how best-shower-time is accessible
// For initial setup, copy the city mapping data inline or import from the package
interface CityMapping {
  he: string;
  en: string;
}

async function geocodeCity(cityName: string): Promise<{ lat: number; lng: number } | null> {
  const encodedCity = encodeURIComponent(`${cityName}, Israel`);
  const url = `https://nominatim.openstreetmap.org/search?q=${encodedCity}&format=json&limit=1&countrycodes=il`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "missile-analysis-seed/1.0" },
    });
    const data = await res.json();
    if (data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
    return null;
  } catch {
    return null;
  }
}

function detectRegion(lat: number, lng: number): string {
  // Simplified region detection using bounding boxes from best-time-ui regions
  // These bounds are from the regions.ts export
  const regions = [
    { id: "western-galilee", lat: [32.8, 33.1], lng: [35.0, 35.3] },
    { id: "upper-galilee", lat: [32.9, 33.35], lng: [35.3, 35.65] },
    { id: "lower-galilee", lat: [32.6, 32.9], lng: [35.15, 35.55] },
    { id: "haifa-krayot", lat: [32.7, 32.85], lng: [34.95, 35.15] },
    { id: "jezreel-valley", lat: [32.4, 32.7], lng: [35.1, 35.55] },
    { id: "golan-heights", lat: [32.7, 33.35], lng: [35.6, 35.95] },
    { id: "sharon", lat: [32.1, 32.45], lng: [34.75, 35.1] },
    { id: "tel-aviv-gush-dan", lat: [31.95, 32.15], lng: [34.7, 34.9] },
    { id: "central", lat: [31.8, 32.1], lng: [34.8, 35.3] },
    { id: "jerusalem", lat: [31.7, 31.85], lng: [35.1, 35.3] },
    { id: "shfela", lat: [31.6, 31.8], lng: [34.7, 35.0] },
    { id: "ashkelon-coast", lat: [31.4, 31.7], lng: [34.4, 34.65] },
    { id: "negev", lat: [30.5, 31.4], lng: [34.3, 35.4] },
    { id: "gaza-envelope", lat: [31.2, 31.5], lng: [34.2, 34.55] },
    { id: "eilat-arava", lat: [29.5, 30.5], lng: [34.8, 35.3] },
  ];

  for (const region of regions) {
    if (
      lat >= region.lat[0] && lat <= region.lat[1] &&
      lng >= region.lng[0] && lng <= region.lng[1]
    ) {
      return region.id;
    }
  }
  return "unknown";
}

async function seedCities() {
  const db = createClient({
    url: process.env.TURSO_DB_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  });

  // City mappings — sourced from best-shower-time/lib/cityNames.ts
  // This should be populated with the full ~800 city list
  // For now, load from a JSON file or import directly
  const cityMappingsModule = await import("../data/city-mappings.json", {
    with: { type: "json" },
  });
  const cityMappings: CityMapping[] = cityMappingsModule.default;

  console.log(`Geocoding ${cityMappings.length} cities...`);

  const failed: string[] = [];
  let inserted = 0;

  for (let i = 0; i < cityMappings.length; i++) {
    const city = cityMappings[i];

    // Rate limit: Nominatim allows 1 req/sec
    if (i > 0) await new Promise((r) => setTimeout(r, 1100));

    // Try English name first (more reliable), then Hebrew
    let coords = await geocodeCity(city.en);
    if (!coords) {
      coords = await geocodeCity(city.he);
    }

    if (!coords) {
      failed.push(`${city.he} (${city.en})`);
      continue;
    }

    const regionId = detectRegion(coords.lat, coords.lng);

    await db.execute({
      sql: `INSERT OR REPLACE INTO city_coords (city_name, city_name_en, lat, lng, region_id) VALUES (?, ?, ?, ?, ?)`,
      args: [city.he, city.en, coords.lat, coords.lng, regionId],
    });

    inserted++;
    if (inserted % 50 === 0) {
      console.log(`  Inserted ${inserted}/${cityMappings.length}...`);
    }
  }

  console.log(`\nDone. Inserted: ${inserted}, Failed: ${failed.length}`);
  if (failed.length > 0) {
    console.log("Failed cities (need manual coordinates):");
    failed.forEach((c) => console.log(`  - ${c}`));
  }

  process.exit(0);
}

seedCities().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
```

Write a small extraction script as `scripts/extract-cities.ts`:

```typescript
import { readFileSync, writeFileSync, mkdirSync } from "fs";

mkdirSync("data", { recursive: true });

const source = readFileSync(
  "/Users/bengreenberg/Dev/personal/best-shower-time/lib/cityNames.ts",
  "utf-8"
);

const mapMatch = source.match(/export const cityNames[^{]*(\{[\s\S]*?\n\});/);
if (!mapMatch) {
  console.error("Could not find cityNames export");
  process.exit(1);
}

const entries: { he: string; en: string }[] = [];
const pairRegex = /"([^"]+)":\s*"([^"]+)"/g;
let match;
while ((match = pairRegex.exec(mapMatch[1])) !== null) {
  entries.push({ he: match[1], en: match[2] });
}

writeFileSync("data/city-mappings.json", JSON.stringify(entries, null, 2));
console.log(`Extracted ${entries.length} city mappings`);
```

Add to `package.json` scripts:
```json
"cities:extract": "tsx scripts/extract-cities.ts",
"cities:seed": "tsx scripts/seed-cities.ts"
```

Run extraction:
```bash
npm run cities:extract
```

Expected: Creates `data/city-mappings.json` with ~800 entries.

- [ ] **Step 3: Create `scripts/seed-cities.ts`**

This script reads the extracted city mappings, geocodes them, assigns regions, and inserts into Turso. Since Nominatim may be unreliable for Hebrew names, we try English first, then Hebrew, and flag failures.

- [ ] **Step 4: Run seed**

```bash
npm run cities:seed
```

Expected: Geocodes ~800 cities (takes ~15 min due to 1 req/sec rate limit), inserts into Turso.

- [ ] **Step 5: Commit**

```bash
git add lib/types.ts scripts/seed-cities.ts scripts/extract-cities.ts data/ package.json
git commit -m "feat: add city coordinate seed script and type definitions"
```

---

## Chunk 2: Ingestion Pipeline

### Task 4: Alert Fetcher & Deduplicator

**Files:**
- Create: `scripts/ingest/fetch-alerts.ts`
- Create: `scripts/ingest/index.ts`

- [ ] **Step 1: Write test for alert fetching and deduplication**

Create `scripts/ingest/__tests__/fetch-alerts.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { parseRawAlerts, deduplicateAlerts } from "../fetch-alerts";

describe("parseRawAlerts", () => {
  it("converts upstream format to Alert[]", () => {
    const raw = [
      {
        id: 123,
        alerts: [
          { time: 1710000000, cities: ["אשקלון", "שדרות"], threat: 2, isDrill: false },
        ],
      },
    ];

    const result = parseRawAlerts(raw);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("123_1710000000000");
    expect(result[0].timestamp).toBe(1710000000000); // converted to ms
    expect(result[0].cities).toEqual(["אשקלון", "שדרות"]);
    expect(result[0].threat).toBe(2);
  });

  it("filters out drills", () => {
    const raw = [
      {
        id: 1,
        alerts: [
          { time: 1710000000, cities: ["תל אביב"], threat: 1, isDrill: true },
          { time: 1710000001, cities: ["חיפה"], threat: 1, isDrill: false },
        ],
      },
    ];

    const result = parseRawAlerts(raw);
    expect(result).toHaveLength(1);
    expect(result[0].cities).toEqual(["חיפה"]);
  });

  it("skips alerts missing required fields", () => {
    const raw = [
      {
        id: 1,
        alerts: [
          { time: 1710000000, threat: 1, isDrill: false }, // missing cities
          { cities: ["חיפה"], threat: 1, isDrill: false }, // missing time
        ],
      },
    ];

    const result = parseRawAlerts(raw);
    expect(result).toHaveLength(0);
  });
});

describe("deduplicateAlerts", () => {
  it("returns only alerts not in existing IDs set", () => {
    const alerts = [
      { id: "1_1000", timestamp: 1000, cities: ["a"], threat: 1, created_at: 0 },
      { id: "2_2000", timestamp: 2000, cities: ["b"], threat: 2, created_at: 0 },
    ];
    const existingIds = new Set(["1_1000"]);

    const result = deduplicateAlerts(alerts, existingIds);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("2_2000");
  });
});
```

- [ ] **Step 2: Install vitest, create config, and run test to verify it fails**

```bash
npm install -D vitest
```

Create `vitest.config.ts`:
```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
  },
});
```

Add to `package.json` scripts:
```json
"test": "vitest run",
"test:watch": "vitest"
```

```bash
npm test -- scripts/ingest/__tests__/fetch-alerts.test.ts
```

Expected: FAIL — modules don't exist yet.

- [ ] **Step 3: Implement `scripts/ingest/fetch-alerts.ts`**

```typescript
import type { Alert } from "../../lib/types";

interface RawAlert {
  time?: number;
  cities?: string[];
  threat?: number;
  isDrill?: boolean;
}

interface RawGroup {
  id?: number;
  alerts?: RawAlert[];
}

export function parseRawAlerts(raw: RawGroup[]): Alert[] {
  const alerts: Alert[] = [];
  const now = Date.now();

  for (const group of raw) {
    if (!group.id || !Array.isArray(group.alerts)) continue;

    for (const alert of group.alerts) {
      if (!alert.time || !Array.isArray(alert.cities) || alert.cities.length === 0) continue;
      if (alert.isDrill) continue;

      alerts.push({
        id: `${group.id}_${alert.time * 1000}`,
        timestamp: alert.time * 1000,
        cities: alert.cities,
        threat: alert.threat ?? 0,
        created_at: now,
      });
    }
  }

  return alerts;
}

export function deduplicateAlerts(alerts: Alert[], existingIds: Set<string>): Alert[] {
  return alerts.filter((a) => !existingIds.has(a.id));
}

const API_URL = "https://api.tzevaadom.co.il/alerts-history";

export async function fetchRawAlerts(): Promise<RawGroup[]> {
  const res = await fetch(API_URL, {
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`API returned ${res.status}: ${res.statusText}`);
  }

  const data = await res.json();

  if (!Array.isArray(data)) {
    throw new Error("API response is not an array");
  }

  return data;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- scripts/ingest/__tests__/fetch-alerts.test.ts
```

Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/ingest/ package.json vitest.config.ts
git commit -m "feat: add alert fetcher with parsing, deduplication, and tests"
```

---

### Task 5: Analytics Computation Engine

**Files:**
- Create: `scripts/ingest/compute-analytics.ts`
- Create: `scripts/ingest/__tests__/compute-analytics.test.ts`

- [ ] **Step 1: Write tests for core analytics computations**

```typescript
import { describe, it, expect } from "vitest";
import {
  computeHourlyHistogram,
  computeShabbatVsWeekday,
  computeMorningVsEvening,
  computeDayOfWeek,
} from "../compute-analytics";
import type { Alert } from "../../../lib/types";

function makeAlert(overrides: Partial<Alert> & { timestamp: number }): Alert {
  return {
    id: `test_${overrides.timestamp}`,
    cities: ["test"],
    threat: 1,
    created_at: Date.now(),
    ...overrides,
  };
}

describe("computeHourlyHistogram", () => {
  it("counts alerts by hour 0-23", () => {
    // Create alerts at specific hours
    const alerts = [
      makeAlert({ timestamp: new Date("2024-01-15T08:00:00Z").getTime() }),
      makeAlert({ timestamp: new Date("2024-01-15T08:30:00Z").getTime() }),
      makeAlert({ timestamp: new Date("2024-01-15T21:00:00Z").getTime() }),
    ];

    const result = computeHourlyHistogram(alerts);
    expect(result.hours).toHaveLength(24);
    // Note: exact hour depends on Israel timezone (UTC+2/3)
    const total = result.hours.reduce((sum: number, h: { count: number }) => sum + h.count, 0);
    expect(total).toBe(3);
  });
});

describe("computeShabbatVsWeekday", () => {
  it("separates Shabbat (Fri evening - Sat evening) from weekdays", () => {
    const alerts = [
      // Friday 20:00 Israel time = Shabbat
      makeAlert({ timestamp: new Date("2024-01-19T18:00:00Z").getTime() }),
      // Monday 10:00 Israel time = Weekday
      makeAlert({ timestamp: new Date("2024-01-15T08:00:00Z").getTime() }),
      makeAlert({ timestamp: new Date("2024-01-16T08:00:00Z").getTime() }),
    ];

    const result = computeShabbatVsWeekday(alerts);
    expect(result.shabbatCount).toBeGreaterThanOrEqual(1);
    expect(result.weekdayCount).toBeGreaterThanOrEqual(1);
    expect(result.multiplier).toBeGreaterThan(0);
  });
});

describe("computeMorningVsEvening", () => {
  it("splits at 06:00/18:00 Israel time", () => {
    const alerts = [
      makeAlert({ timestamp: new Date("2024-01-15T05:00:00Z").getTime() }), // 7am Israel
      makeAlert({ timestamp: new Date("2024-01-15T19:00:00Z").getTime() }), // 9pm Israel
    ];

    const result = computeMorningVsEvening(alerts);
    expect(result.morningCount + result.eveningCount).toBe(2);
    expect(result.eveningPercent).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- scripts/ingest/__tests__/compute-analytics.test.ts
```

Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `scripts/ingest/compute-analytics.ts`**

```typescript
import type { Alert } from "../../lib/types";

// Israel timezone for date calculations
const ISRAEL_TZ = "Asia/Jerusalem";

function toIsraelDate(timestamp: number): Date {
  return new Date(new Date(timestamp).toLocaleString("en-US", { timeZone: ISRAEL_TZ }));
}

function getIsraelHour(timestamp: number): number {
  return toIsraelDate(timestamp).getHours();
}

function getIsraelDay(timestamp: number): number {
  return toIsraelDate(timestamp).getDay(); // 0=Sun, 5=Fri, 6=Sat
}

function isShabbat(timestamp: number): boolean {
  const d = toIsraelDate(timestamp);
  const day = d.getDay();
  const hour = d.getHours();
  // Shabbat: Friday 18:00 to Saturday 21:00 (approximate)
  if (day === 5 && hour >= 18) return true;
  if (day === 6 && hour <= 21) return true;
  return false;
}

export function computeHourlyHistogram(alerts: Alert[]) {
  const hours = Array.from({ length: 24 }, (_, i) => ({ hour: i, count: 0 }));
  for (const alert of alerts) {
    const h = getIsraelHour(alert.timestamp);
    hours[h].count++;
  }
  const peakHour = hours.reduce((max, h) => (h.count > max.count ? h : max), hours[0]);
  const quietestHour = hours.reduce((min, h) => (h.count < min.count ? h : min), hours[0]);
  return { hours, peakHour: peakHour.hour, quietestHour: quietestHour.hour };
}

export function computeShabbatVsWeekday(alerts: Alert[]) {
  let shabbatCount = 0;
  let weekdayCount = 0;
  for (const alert of alerts) {
    if (isShabbat(alert.timestamp)) shabbatCount++;
    else weekdayCount++;
  }
  // Normalize: Shabbat is ~27 hours/week, weekdays ~141 hours/week
  const shabbatRate = shabbatCount / 27;
  const weekdayRate = weekdayCount > 0 ? weekdayCount / 141 : 0;
  const multiplier = weekdayRate > 0 ? Math.round((shabbatRate / weekdayRate) * 10) / 10 : 0;
  const shabbatPercent = alerts.length > 0 ? Math.round((shabbatCount / alerts.length) * 100) : 0;

  return { shabbatCount, weekdayCount, multiplier, shabbatPercent };
}

export function computeMorningVsEvening(alerts: Alert[]) {
  let morningCount = 0; // 06:00-17:59
  let eveningCount = 0; // 18:00-05:59
  let peakHour = 0;
  let quietestHour = 0;

  const hourCounts = new Array(24).fill(0);
  for (const alert of alerts) {
    const h = getIsraelHour(alert.timestamp);
    hourCounts[h]++;
    if (h >= 6 && h < 18) morningCount++;
    else eveningCount++;
  }

  peakHour = hourCounts.indexOf(Math.max(...hourCounts));
  quietestHour = hourCounts.indexOf(Math.min(...hourCounts));
  const eveningPercent = alerts.length > 0 ? Math.round((eveningCount / alerts.length) * 100) : 0;

  return { morningCount, eveningCount, eveningPercent, peakHour, quietestHour };
}

export function computeDayOfWeek(alerts: Alert[]) {
  const days = Array.from({ length: 7 }, (_, i) => ({ day: i, count: 0 }));
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  for (const alert of alerts) {
    const d = getIsraelDay(alert.timestamp);
    days[d].count++;
  }

  const busiest = days.reduce((max, d) => (d.count > max.count ? d : max), days[0]);
  return {
    days: days.map((d) => ({ ...d, name: dayNames[d.day] })),
    busiestDay: dayNames[busiest.day],
    busiestCount: busiest.count,
  };
}

export function computeMonthlyTrends(alerts: Alert[]) {
  const months: Record<string, number> = {};
  for (const alert of alerts) {
    const d = toIsraelDate(alert.timestamp);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    months[key] = (months[key] || 0) + 1;
  }

  const sorted = Object.entries(months)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, count]) => ({ month, count }));

  const len = sorted.length;
  const delta =
    len >= 2
      ? Math.round(((sorted[len - 1].count - sorted[len - 2].count) / sorted[len - 2].count) * 100)
      : 0;

  return { months: sorted, monthOverMonthDelta: delta };
}

export function computeRegionalHeatmap(alerts: Alert[], cityRegionMap: Map<string, string>) {
  const regionCounts: Record<string, number> = {};
  for (const alert of alerts) {
    const regions = new Set<string>();
    for (const city of alert.cities) {
      const region = cityRegionMap.get(city);
      if (region) regions.add(region);
    }
    for (const region of regions) {
      regionCounts[region] = (regionCounts[region] || 0) + 1;
    }
  }
  return { regions: regionCounts };
}

export function computeThreatDistribution(alerts: Alert[]) {
  const counts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
  for (const alert of alerts) {
    counts[alert.threat] = (counts[alert.threat] || 0) + 1;
  }
  const mostCommon = Object.entries(counts).reduce((max, [level, count]) =>
    count > max[1] ? [level, count] : max, ["0", 0]
  );
  return { counts, mostCommonLevel: Number(mostCommon[0]) };
}

export function computeEscalationPatterns(alerts: Alert[]) {
  if (alerts.length === 0) return { currentRate: 0, baseline: 0, multiplier: 0, escalations: [] };

  // Sort by timestamp
  const sorted = [...alerts].sort((a, b) => a.timestamp - b.timestamp);
  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
  const recentAlerts = sorted.filter((a) => a.timestamp >= thirtyDaysAgo);

  // Compute 30-day rolling hourly average
  const totalHours = Math.max(1, (now - thirtyDaysAgo) / (60 * 60 * 1000));
  const baseline = recentAlerts.length / totalHours;

  // Current rate: last 1 hour
  const oneHourAgo = now - 60 * 60 * 1000;
  const currentRate = sorted.filter((a) => a.timestamp >= oneHourAgo).length;

  const multiplier = baseline > 0 ? Math.round((currentRate / baseline) * 10) / 10 : 0;

  // Find escalation periods (hourly rate > 2x baseline)
  const escalations: { start: number; end: number; rate: number }[] = [];
  const hourBuckets: Record<number, number> = {};
  for (const alert of recentAlerts) {
    const hourKey = Math.floor(alert.timestamp / (60 * 60 * 1000));
    hourBuckets[hourKey] = (hourBuckets[hourKey] || 0) + 1;
  }

  let escStart: number | null = null;
  for (const [hourStr, count] of Object.entries(hourBuckets).sort(([a], [b]) => Number(a) - Number(b))) {
    const hour = Number(hourStr);
    if (count > baseline * 2) {
      if (escStart === null) escStart = hour * 60 * 60 * 1000;
    } else if (escStart !== null) {
      escalations.push({ start: escStart, end: hour * 60 * 60 * 1000, rate: count });
      escStart = null;
    }
  }

  return { currentRate, baseline: Math.round(baseline * 10) / 10, multiplier, escalations };
}

export function computeQuietVsActive(alerts: Alert[]) {
  if (alerts.length < 2) return { longestQuiet: 0, longestActive: 0, quietPeriods: [], activePeriods: [] };

  const sorted = [...alerts].sort((a, b) => a.timestamp - b.timestamp);
  const gaps: number[] = [];

  for (let i = 1; i < sorted.length; i++) {
    gaps.push(sorted[i].timestamp - sorted[i - 1].timestamp);
  }

  const longestQuietMs = Math.max(...gaps);
  const longestQuietHours = Math.round(longestQuietMs / (60 * 60 * 1000));

  // Active period: consecutive alerts within 30 min of each other
  let activeStart = sorted[0].timestamp;
  let longestActiveMs = 0;
  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i].timestamp - sorted[i - 1].timestamp;
    if (gap > 30 * 60 * 1000) {
      const duration = sorted[i - 1].timestamp - activeStart;
      if (duration > longestActiveMs) longestActiveMs = duration;
      activeStart = sorted[i].timestamp;
    }
  }
  const lastDuration = sorted[sorted.length - 1].timestamp - activeStart;
  if (lastDuration > longestActiveMs) longestActiveMs = lastDuration;

  const longestActiveHours = Math.round(longestActiveMs / (60 * 60 * 1000));

  return { longestQuietHours, longestActiveHours };
}

export function computeMultiCityCorrelation(
  alerts: Alert[],
  cityRegionMap: Map<string, string>
) {
  // Group alerts by group_id (extracted from composite id) within 5-minute windows
  const groups: Record<string, Set<string>> = {};
  for (const alert of alerts) {
    const groupId = alert.id.split("_")[0];
    if (!groups[groupId]) groups[groupId] = new Set();
    for (const city of alert.cities) {
      const region = cityRegionMap.get(city);
      if (region) groups[groupId].add(region);
    }
  }

  const multiRegionEvents = Object.entries(groups).filter(([, regions]) => regions.size >= 3);
  const avgRegions =
    multiRegionEvents.length > 0
      ? Math.round(
          (multiRegionEvents.reduce((sum, [, r]) => sum + r.size, 0) / multiRegionEvents.length) * 10
        ) / 10
      : 0;

  // Co-occurrence matrix
  const coOccurrence: Record<string, Record<string, number>> = {};
  for (const [, regions] of multiRegionEvents) {
    const arr = Array.from(regions);
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        if (!coOccurrence[arr[i]]) coOccurrence[arr[i]] = {};
        coOccurrence[arr[i]][arr[j]] = (coOccurrence[arr[i]][arr[j]] || 0) + 1;
      }
    }
  }

  return { multiRegionCount: multiRegionEvents.length, avgRegions, coOccurrence };
}

export function computeTimeBetweenAlerts(alerts: Alert[]) {
  if (alerts.length < 2) return { medianGapMinutes: 0, distribution: [] };

  const sorted = [...alerts].sort((a, b) => a.timestamp - b.timestamp);
  const gaps: number[] = [];

  for (let i = 1; i < sorted.length; i++) {
    gaps.push(Math.round((sorted[i].timestamp - sorted[i - 1].timestamp) / 60000)); // minutes
  }

  gaps.sort((a, b) => a - b);
  const median = gaps[Math.floor(gaps.length / 2)];

  // Distribution buckets: <5m, 5-15m, 15-30m, 30m-1h, 1-2h, 2-6h, 6-12h, 12-24h, >24h
  const buckets = [
    { label: "<5m", max: 5, count: 0 },
    { label: "5-15m", max: 15, count: 0 },
    { label: "15-30m", max: 30, count: 0 },
    { label: "30m-1h", max: 60, count: 0 },
    { label: "1-2h", max: 120, count: 0 },
    { label: "2-6h", max: 360, count: 0 },
    { label: "6-12h", max: 720, count: 0 },
    { label: "12-24h", max: 1440, count: 0 },
    { label: ">24h", max: Infinity, count: 0 },
  ];

  for (const gap of gaps) {
    const bucket = buckets.find((b) => gap < b.max);
    if (bucket) bucket.count++;
  }

  return { medianGapMinutes: median, distribution: buckets };
}

export function computeGeographicSpread(alerts: Alert[], cityRegionMap: Map<string, string>) {
  // Group by group_id and count distinct regions per group
  const groups: Record<string, Set<string>> = {};
  for (const alert of alerts) {
    const groupId = alert.id.split("_")[0];
    if (!groups[groupId]) groups[groupId] = new Set();
    for (const city of alert.cities) {
      const region = cityRegionMap.get(city);
      if (region) groups[groupId].add(region);
    }
  }

  const spreads = Object.values(groups).map((r) => r.size);
  const avgSpread =
    spreads.length > 0 ? Math.round((spreads.reduce((a, b) => a + b, 0) / spreads.length) * 10) / 10 : 0;

  return { avgRegionsPerGroup: avgSpread, totalGroups: spreads.length };
}

// Master computation function — runs all analytics and returns cache entries
export function computeAllAnalytics(
  alerts: Alert[],
  cityRegionMap: Map<string, string>
): Record<string, object> {
  return {
    hourly_histogram: computeHourlyHistogram(alerts),
    day_of_week: computeDayOfWeek(alerts),
    shabbat_vs_weekday: computeShabbatVsWeekday(alerts),
    morning_vs_evening: computeMorningVsEvening(alerts),
    monthly_trends: computeMonthlyTrends(alerts),
    regional_heatmap: computeRegionalHeatmap(alerts, cityRegionMap),
    threat_distribution: computeThreatDistribution(alerts),
    escalation_patterns: computeEscalationPatterns(alerts),
    quiet_vs_active: computeQuietVsActive(alerts),
    multi_city_correlation: computeMultiCityCorrelation(alerts, cityRegionMap),
    time_between_alerts: computeTimeBetweenAlerts(alerts),
    geographic_spread: computeGeographicSpread(alerts, cityRegionMap),
  };
}

// Compute analytics for a specific region
export function computeRegionAnalytics(
  alerts: Alert[],
  regionId: string,
  cityRegionMap: Map<string, string>
): Record<string, object> {
  // Filter alerts to only those that include cities in this region
  const regionAlerts = alerts.filter((a) =>
    a.cities.some((city) => cityRegionMap.get(city) === regionId)
  );

  // Compute all analytics except regional_heatmap (which is inherently per-region)
  const all = computeAllAnalytics(regionAlerts, cityRegionMap);
  delete (all as Record<string, unknown>).regional_heatmap;
  return all;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- scripts/ingest/__tests__/compute-analytics.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/ingest/compute-analytics.ts scripts/ingest/__tests__/
git commit -m "feat: add analytics computation engine with 12 analytics types"
```

---

### Task 6: Ingestion Pipeline Runner

**Files:**
- Create: `scripts/ingest/index.ts`
- Create: `.github/workflows/ingest.yml`

- [ ] **Step 1: Create `scripts/ingest/index.ts` — main pipeline**

```typescript
import { createClient } from "@libsql/client";
import { fetchRawAlerts, parseRawAlerts, deduplicateAlerts } from "./fetch-alerts";
import { computeAllAnalytics, computeRegionAnalytics } from "./compute-analytics";
import type { Alert } from "../../lib/types";
import "dotenv/config";

const REGIONS = [
  "western-galilee", "upper-galilee", "lower-galilee", "haifa-krayot",
  "jezreel-valley", "golan-heights", "sharon", "tel-aviv-gush-dan",
  "central", "jerusalem", "shfela", "ashkelon-coast", "negev",
  "gaza-envelope", "eilat-arava",
];

async function main() {
  const db = createClient({
    url: process.env.TURSO_DB_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  });

  console.log("[ingest] Fetching alerts from API...");

  let rawGroups;
  try {
    rawGroups = await fetchRawAlerts();
  } catch (err) {
    console.error("[ingest] API fetch failed:", err);

    // Track consecutive failures
    const statusRow = await db.execute({
      sql: "SELECT data FROM analytics_cache WHERE key = 'system_status'",
      args: [],
    });

    const current = statusRow.rows.length > 0
      ? JSON.parse(statusRow.rows[0].data as string)
      : { status: "ok", consecutive_failures: 0, last_success: 0 };

    current.consecutive_failures += 1;
    current.status = current.consecutive_failures >= 3 ? "stale" : "degraded";

    await db.execute({
      sql: "INSERT OR REPLACE INTO analytics_cache (key, data, computed_at) VALUES ('system_status', ?, ?)",
      args: [JSON.stringify(current), Date.now()],
    });

    process.exit(1);
  }

  // Parse and validate
  const parsed = parseRawAlerts(rawGroups);
  console.log(`[ingest] Parsed ${parsed.length} alerts from API`);

  // Get existing IDs for deduplication
  const existingRows = await db.execute({
    sql: "SELECT id FROM alerts",
    args: [],
  });
  const existingIds = new Set(existingRows.rows.map((r) => r.id as string));

  const newAlerts = deduplicateAlerts(parsed, existingIds);
  console.log(`[ingest] ${newAlerts.length} new alerts to insert`);

  // Insert new alerts
  if (newAlerts.length > 0) {
    const batchSize = 50;
    for (let i = 0; i < newAlerts.length; i += batchSize) {
      const batch = newAlerts.slice(i, i + batchSize);
      await db.batch(
        batch.map((a) => ({
          sql: "INSERT OR IGNORE INTO alerts (id, timestamp, cities, threat, created_at) VALUES (?, ?, ?, ?, ?)",
          args: [a.id, a.timestamp, JSON.stringify(a.cities), a.threat, a.created_at],
        }))
      );
    }
    console.log(`[ingest] Inserted ${newAlerts.length} alerts`);
  }

  // Load all alerts for analytics computation
  console.log("[ingest] Computing analytics...");
  const allRows = await db.execute({
    sql: "SELECT id, timestamp, cities, threat, created_at FROM alerts ORDER BY timestamp DESC",
    args: [],
  });

  const allAlerts: Alert[] = allRows.rows.map((r) => ({
    id: r.id as string,
    timestamp: r.timestamp as number,
    cities: JSON.parse(r.cities as string),
    threat: r.threat as number,
    created_at: r.created_at as number,
  }));

  // Load city-region mapping
  const cityRows = await db.execute({
    sql: "SELECT city_name, region_id FROM city_coords",
    args: [],
  });
  const cityRegionMap = new Map<string, string>();
  for (const row of cityRows.rows) {
    cityRegionMap.set(row.city_name as string, row.region_id as string);
  }

  // Log unknown cities
  const knownCities = new Set(cityRegionMap.keys());
  const unknownCities = new Set<string>();
  for (const alert of allAlerts) {
    for (const city of alert.cities) {
      if (!knownCities.has(city)) unknownCities.add(city);
    }
  }
  if (unknownCities.size > 0) {
    console.log(`[ingest] Unknown cities (${unknownCities.size}): ${Array.from(unknownCities).slice(0, 10).join(", ")}${unknownCities.size > 10 ? "..." : ""}`);
  }

  // Compute global analytics
  const globalAnalytics = computeAllAnalytics(allAlerts, cityRegionMap);
  const now = Date.now();

  const analyticsEntries: { sql: string; args: (string | number)[] }[] = [];

  for (const [key, data] of Object.entries(globalAnalytics)) {
    analyticsEntries.push({
      sql: "INSERT OR REPLACE INTO analytics_cache (key, data, computed_at) VALUES (?, ?, ?)",
      args: [key, JSON.stringify(data), now],
    });
  }

  // Compute per-region analytics
  for (const regionId of REGIONS) {
    const regionAnalytics = computeRegionAnalytics(allAlerts, regionId, cityRegionMap);
    for (const [key, data] of Object.entries(regionAnalytics)) {
      analyticsEntries.push({
        sql: "INSERT OR REPLACE INTO analytics_cache (key, data, computed_at) VALUES (?, ?, ?)",
        args: [`${key}::${regionId}`, JSON.stringify(data), now],
      });
    }
  }

  // Write all analytics in batches
  const analyticsBatchSize = 50;
  for (let i = 0; i < analyticsEntries.length; i += analyticsBatchSize) {
    await db.batch(analyticsEntries.slice(i, i + analyticsBatchSize));
  }

  console.log(`[ingest] Wrote ${analyticsEntries.length} analytics cache entries`);

  // Update system_status to healthy
  await db.execute({
    sql: "INSERT OR REPLACE INTO analytics_cache (key, data, computed_at) VALUES ('system_status', ?, ?)",
    args: [JSON.stringify({ status: "ok", consecutive_failures: 0, last_success: now }), now],
  });

  console.log("[ingest] Done.");
}

main().catch((err) => {
  console.error("[ingest] Fatal error:", err);
  process.exit(1);
});
```

- [ ] **Step 2: Add ingest script to package.json**

```json
"ingest": "tsx scripts/ingest/index.ts"
```

- [ ] **Step 3: Test locally**

```bash
npm run ingest
```

Expected: Fetches alerts, inserts new ones, computes analytics, outputs log lines.

- [ ] **Step 4: Create `.github/workflows/ingest.yml`**

```yaml
name: Ingest Alerts

on:
  schedule:
    - cron: "*/5 * * * *"
  workflow_dispatch: # Manual trigger for testing

concurrency:
  group: ingest
  cancel-in-progress: false

jobs:
  ingest:
    runs-on: ubuntu-latest
    timeout-minutes: 4

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - run: npm ci

      - run: npm run ingest
        env:
          TURSO_DB_URL: ${{ secrets.TURSO_DB_URL }}
          TURSO_AUTH_TOKEN: ${{ secrets.TURSO_AUTH_TOKEN }}
```

- [ ] **Step 5: Commit**

```bash
git add scripts/ingest/index.ts .github/workflows/ingest.yml package.json
git commit -m "feat: add ingestion pipeline with GitHub Actions cron workflow"
```

---

## Chunk 3: Frontend Core

### Task 7: Client-Side Turso Cache & Data Hooks

**Files:**
- Create: `lib/turso-cache.ts`
- Create: `lib/hooks/use-alerts.ts`
- Create: `lib/hooks/use-analytics.ts`
- Create: `lib/hooks/use-city-coords.ts`

- [ ] **Step 1: Create `lib/turso-cache.ts`**

```typescript
import { createClient, type Client, type ResultSet } from "@libsql/client";

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

// For paginated queries that should not be cached
export async function directQuery(sql: string, args: unknown[] = []): Promise<ResultSet> {
  return getClient().execute({ sql, args: args as any });
}
```

- [ ] **Step 2: Create `lib/hooks/use-analytics.ts`**

```typescript
"use client";

import { useState, useEffect } from "react";
import { cachedQuery } from "../turso-cache";

export function useAnalytics<T = unknown>(key: string, regionId: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const effectiveKey = regionId ? `${key}::${regionId}` : key;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    cachedQuery("SELECT data, computed_at FROM analytics_cache WHERE key = ?", [effectiveKey])
      .then((result) => {
        if (cancelled) return;
        if (result.rows.length > 0) {
          setData(JSON.parse(result.rows[0].data as string));
        } else {
          setData(null);
        }
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err);
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [effectiveKey]);

  return { data, loading, error };
}
```

- [ ] **Step 3: Create `lib/hooks/use-alerts.ts`**

```typescript
"use client";

import { useState, useEffect, useCallback } from "react";
import { cachedQuery, directQuery } from "../turso-cache";
import type { Alert, FilterState } from "../types";

function buildWhereClause(filter: FilterState): { sql: string; args: unknown[] } {
  const conditions: string[] = [];
  const args: unknown[] = [];
  const now = Date.now();

  switch (filter.timeRange) {
    case "24h":
      conditions.push("timestamp > ?");
      args.push(now - 24 * 60 * 60 * 1000);
      break;
    case "7d":
      conditions.push("timestamp > ?");
      args.push(now - 7 * 24 * 60 * 60 * 1000);
      break;
    case "30d":
      conditions.push("timestamp > ?");
      args.push(now - 30 * 24 * 60 * 60 * 1000);
      break;
    case "custom":
      if (filter.customStart) {
        conditions.push("timestamp > ?");
        args.push(filter.customStart);
      }
      if (filter.customEnd) {
        conditions.push("timestamp < ?");
        args.push(filter.customEnd);
      }
      break;
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  return { sql: where, args };
}

export function useAlerts(filter: FilterState) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const { sql: where, args } = buildWhereClause(filter);
    cachedQuery(
      `SELECT id, timestamp, cities, threat, created_at FROM alerts ${where} ORDER BY timestamp DESC LIMIT 500`,
      args
    ).then((result) => {
      if (cancelled) return;
      setAlerts(
        result.rows.map((r) => ({
          id: r.id as string,
          timestamp: r.timestamp as number,
          cities: JSON.parse(r.cities as string),
          threat: r.threat as number,
          created_at: r.created_at as number,
        }))
      );
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [filter.timeRange, filter.customStart, filter.customEnd, filter.regionId]);

  return { alerts, loading };
}

Note: Region filtering is done client-side after fetch — the `alerts` table stores cities as a JSON array, so SQL-level region filtering would require joining with `city_coords`. The consuming component filters the returned alerts using `cityCoords.get(city)?.region_id === filter.regionId`.

// Paginated feed loading
export function useAlertFeed(filter: FilterState) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);

    const cursor = alerts.length > 0 ? alerts[alerts.length - 1].timestamp : Date.now();
    const { sql: where, args } = buildWhereClause(filter);
    const cursorCondition = where ? ` AND timestamp < ?` : `WHERE timestamp < ?`;

    const result = await directQuery(
      `SELECT id, timestamp, cities, threat, created_at FROM alerts ${where}${cursorCondition} ORDER BY timestamp DESC LIMIT 50`,
      [...args, cursor]
    );

    const newAlerts = result.rows.map((r) => ({
      id: r.id as string,
      timestamp: r.timestamp as number,
      cities: JSON.parse(r.cities as string),
      threat: r.threat as number,
      created_at: r.created_at as number,
    }));

    setAlerts((prev) => [...prev, ...newAlerts]);
    setHasMore(newAlerts.length === 50);
    setLoading(false);
  }, [alerts, loading, hasMore, filter]);

  // Reset on filter change
  useEffect(() => {
    setAlerts([]);
    setHasMore(true);
  }, [filter.timeRange, filter.customStart, filter.customEnd, filter.regionId]);

  return { alerts, loading, hasMore, loadMore };
}
```

- [ ] **Step 4: Create `lib/hooks/use-city-coords.ts`**

```typescript
"use client";

import { useState, useEffect } from "react";
import { cachedQuery } from "../turso-cache";
import type { CityCoord } from "../types";

export function useCityCoords() {
  const [coords, setCoords] = useState<Map<string, CityCoord>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cachedQuery("SELECT city_name, city_name_en, lat, lng, region_id FROM city_coords").then(
      (result) => {
        const map = new Map<string, CityCoord>();
        for (const row of result.rows) {
          map.set(row.city_name as string, {
            city_name: row.city_name as string,
            city_name_en: row.city_name_en as string,
            lat: row.lat as number,
            lng: row.lng as number,
            region_id: row.region_id as string,
          });
        }
        setCoords(map);
        setLoading(false);
      }
    );
  }, []);

  return { coords, loading };
}
```

- [ ] **Step 5: Commit**

```bash
git add lib/turso-cache.ts lib/hooks/
git commit -m "feat: add Turso cache wrapper and data hooks for alerts, analytics, and cities"
```

---

### Task 8: App Shell with Tab Navigation and Filter State

**Files:**
- Create: `components/AppShell.tsx`
- Create: `components/TabBar.tsx`
- Create: `components/FilterChips.tsx`
- Create: `lib/hooks/use-filter-state.ts`
- Modify: `app/page.tsx`

- [ ] **Step 1: Create `lib/hooks/use-filter-state.ts`**

```typescript
"use client";

import { useState, useCallback } from "react";
import type { FilterState, TimeRange } from "../types";

export function useFilterState() {
  const [filter, setFilter] = useState<FilterState>({
    timeRange: "24h",
    regionId: null,
  });

  const setTimeRange = useCallback((range: TimeRange) => {
    setFilter((prev) => ({ ...prev, timeRange: range, customStart: undefined, customEnd: undefined }));
  }, []);

  const setCustomRange = useCallback((start: number, end: number) => {
    setFilter((prev) => ({ ...prev, timeRange: "custom" as TimeRange, customStart: start, customEnd: end }));
  }, []);

  const setRegion = useCallback((regionId: string | null) => {
    setFilter((prev) => ({ ...prev, regionId }));
  }, []);

  return { filter, setTimeRange, setCustomRange, setRegion };
}
```

- [ ] **Step 2: Create `components/TabBar.tsx`**

```tsx
"use client";

type Tab = "map" | "analytics" | "feed";

interface TabBarProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

const tabs: { id: Tab; label: string; icon: JSX.Element }[] = [
  {
    id: "map",
    label: "Map",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
        <path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
      </svg>
    ),
  },
  {
    id: "analytics",
    label: "Analytics",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
        <path d="M3 13h4v8H3zM10 9h4v12h-4zM17 5h4v16h-4z" />
      </svg>
    ),
  },
  {
    id: "feed",
    label: "Feed",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
        <path d="M4 6h16M4 10h16M4 14h10M4 18h7" />
      </svg>
    ),
  },
];

export function TabBar({ activeTab, onTabChange }: TabBarProps) {
  return (
    <nav className="h-[72px] bg-bg-elevated border-t border-border flex items-center justify-around px-4 pb-2 flex-shrink-0">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`flex flex-col items-center gap-1 text-[10px] font-medium uppercase tracking-wider transition-colors ${
            activeTab === tab.id
              ? "text-accent-blue [&_svg]:drop-shadow-[0_0_6px_theme(colors.accent-blue)]"
              : "text-text-tertiary"
          }`}
        >
          {tab.icon}
          <span>{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
```

- [ ] **Step 3: Create `components/FilterChips.tsx`**

```tsx
"use client";

import type { TimeRange } from "../lib/types";

interface FilterChipsProps {
  activeRange: TimeRange;
  onRangeChange: (range: TimeRange) => void;
  regionId: string | null;
  onRegionChange: (regionId: string | null) => void;
}

const timeRanges: { id: TimeRange; label: string }[] = [
  { id: "24h", label: "Last 24h" },
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "custom", label: "Custom" },
];

export function FilterChips({ activeRange, onRangeChange, regionId, onRegionChange }: FilterChipsProps) {
  return (
    <div className="flex gap-1.5 px-4 overflow-x-auto scrollbar-hide flex-shrink-0 py-3">
      {timeRanges.map((range) => (
        <button
          key={range.id}
          onClick={() => onRangeChange(range.id)}
          className={`px-3.5 py-1.5 rounded-lg text-[11px] font-medium whitespace-nowrap border transition-all ${
            activeRange === range.id
              ? "bg-accent-blue/15 text-accent-blue border-accent-blue/25"
              : "bg-bg-surface text-text-secondary border-border"
          }`}
        >
          {range.label}
        </button>
      ))}
      <button
        onClick={() => onRegionChange(regionId ? null : "tel-aviv-gush-dan")}
        className="px-3.5 py-1.5 rounded-lg text-[11px] font-medium whitespace-nowrap bg-bg-surface text-text-secondary border border-border"
      >
        {regionId ? `${regionId} ✕` : "All Regions ↓"}
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Create `components/AppShell.tsx`**

```tsx
"use client";

import { useState } from "react";
import { TabBar } from "./TabBar";
import { FilterChips } from "./FilterChips";
import { useFilterState } from "../lib/hooks/use-filter-state";

type Tab = "map" | "analytics" | "feed";

export function AppShell() {
  const [activeTab, setActiveTab] = useState<Tab>("map");
  const { filter, setTimeRange, setCustomRange, setRegion } = useFilterState();

  return (
    <div className="h-dvh flex flex-col bg-bg-primary">
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-accent-red rounded-full shadow-[0_0_8px_theme(colors.accent-red/40)] animate-pulse" />
          <h1 className="font-serif text-[17px] tracking-tight text-text-primary">Alert Map</h1>
        </div>
        <button className="text-[11px] text-text-tertiary font-medium px-2 py-1 rounded-md border border-border">
          EN · עב
        </button>
      </header>

      {/* Filters */}
      <FilterChips
        activeRange={filter.timeRange}
        onRangeChange={setTimeRange}
        regionId={filter.regionId}
        onRegionChange={setRegion}
      />

      {/* Content area */}
      <main className="flex-1 overflow-hidden">
        {activeTab === "map" && (
          <div className="h-full flex items-center justify-center text-text-tertiary">
            Map View (Task 9)
          </div>
        )}
        {activeTab === "analytics" && (
          <div className="h-full flex items-center justify-center text-text-tertiary">
            Analytics View (Task 11)
          </div>
        )}
        {activeTab === "feed" && (
          <div className="h-full flex items-center justify-center text-text-tertiary">
            Feed View (Task 12)
          </div>
        )}
      </main>

      {/* Tab bar */}
      <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}
```

- [ ] **Step 5: Update `app/page.tsx`**

```tsx
import { AppShell } from "../components/AppShell";

export default function Home() {
  return <AppShell />;
}
```

- [ ] **Step 6: Verify app runs with shell navigation**

```bash
npm run dev
```

Expected: Dark app with header, filter chips, placeholder content, and working tab bar.

- [ ] **Step 7: Commit**

```bash
git add components/ lib/hooks/use-filter-state.ts app/page.tsx
git commit -m "feat: add app shell with tab navigation, filter chips, and shared filter state"
```

---

## Chunk 4: Map View

### Task 9: Leaflet Map with Alert Markers

**Files:**
- Create: `components/map/AlertMap.tsx`
- Create: `components/map/AlertMarker.tsx`
- Create: `components/map/MapStats.tsx`
- Create: `components/map/BottomSheet.tsx`
- Modify: `components/AppShell.tsx`

- [ ] **Step 1: Install leaflet.markercluster**

```bash
npm install leaflet.markercluster
npm install -D @types/leaflet.markercluster
```

- [ ] **Step 2: Create `components/map/AlertMap.tsx`**

Note: Leaflet requires dynamic import in Next.js (no SSR). Use `next/dynamic`.

```tsx
"use client";

import dynamic from "next/dynamic";
import type { Alert, CityCoord, FilterState } from "../../lib/types";

// Dynamic import to avoid SSR issues with Leaflet
const MapContainer = dynamic(
  () => import("react-leaflet").then((mod) => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((mod) => mod.TileLayer),
  { ssr: false }
);

interface AlertMapProps {
  alerts: Alert[];
  cityCoords: Map<string, CityCoord>;
  filter: FilterState;
  onAlertSelect: (alert: Alert) => void;
}

export function AlertMap({ alerts, cityCoords, filter, onAlertSelect }: AlertMapProps) {
  // Map alerts to coordinates
  const markers = alerts.flatMap((alert) =>
    alert.cities
      .map((city) => {
        const coord = cityCoords.get(city);
        if (!coord) return null;
        return { alert, coord, city };
      })
      .filter(Boolean)
  );

  return (
    <div className="h-full w-full relative">
      <MapContainer
        center={[31.5, 34.8]}
        zoom={7}
        className="h-full w-full"
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        {/* Markers rendered via AlertMarker component — implemented in next step */}
      </MapContainer>
    </div>
  );
}
```

- [ ] **Step 3: Create `components/map/AlertMarker.tsx`**

```tsx
"use client";

import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet.markercluster";
import type { Alert, CityCoord } from "../../lib/types";

interface AlertMarkersProps {
  alerts: Alert[];
  cityCoords: Map<string, CityCoord>;
  onAlertSelect: (alert: Alert) => void;
}

function getMarkerColor(alert: Alert): string {
  const age = Date.now() - alert.timestamp;
  const hourMs = 60 * 60 * 1000;
  if (age < hourMs) return "#EF4444"; // red — critical
  if (age < 6 * hourMs) return "#F59E0B"; // amber — warning
  return "#3D4B5F"; // gray — old
}

function getMarkerSize(alert: Alert): number {
  const age = Date.now() - alert.timestamp;
  const hourMs = 60 * 60 * 1000;
  if (age < hourMs) return 10;
  if (age < 6 * hourMs) return 8;
  return 6;
}

export function AlertMarkers({ alerts, cityCoords, onAlertSelect }: AlertMarkersProps) {
  const map = useMap();

  useEffect(() => {
    const clusterGroup = L.markerClusterGroup({
      maxClusterRadius: 40,
      iconCreateFunction: (cluster) => {
        const count = cluster.getChildCount();
        return L.divIcon({
          html: `<div style="
            width: 32px; height: 32px; border-radius: 50%;
            background: rgba(239,68,68,0.15);
            border: 1px solid rgba(239,68,68,0.3);
            display: flex; align-items: center; justify-content: center;
            font-family: 'JetBrains Mono', monospace; font-size: 11px;
            font-weight: 600; color: #EF4444;
            backdrop-filter: blur(8px);
          ">${count}</div>`,
          className: "",
          iconSize: L.point(32, 32),
        });
      },
    });

    // Deduplicate: one marker per city per alert
    const seen = new Set<string>();
    for (const alert of alerts) {
      for (const city of alert.cities) {
        const coord = cityCoords.get(city);
        if (!coord) continue;
        const key = `${alert.id}_${city}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const color = getMarkerColor(alert);
        const size = getMarkerSize(alert);

        const marker = L.circleMarker([coord.lat, coord.lng], {
          radius: size,
          fillColor: color,
          fillOpacity: 0.9,
          stroke: false,
        });

        marker.on("click", () => onAlertSelect(alert));
        clusterGroup.addLayer(marker);
      }
    }

    map.addLayer(clusterGroup);

    return () => {
      map.removeLayer(clusterGroup);
    };
  }, [alerts, cityCoords, map, onAlertSelect]);

  return null;
}
```

- [ ] **Step 4: Create `components/map/MapStats.tsx`**

```tsx
interface MapStatsProps {
  alertCount: number;
  regionCount: number;
  lastAlertMinutes: number | null;
}

export function MapStats({ alertCount, regionCount, lastAlertMinutes }: MapStatsProps) {
  const formatTime = (min: number | null) => {
    if (min === null) return "—";
    if (min < 60) return `${min}m`;
    if (min < 1440) return `${Math.floor(min / 60)}h`;
    return `${Math.floor(min / 1440)}d`;
  };

  return (
    <div className="flex gap-2 px-4 py-2 flex-shrink-0">
      {[
        { value: alertCount.toLocaleString(), label: "Today", color: "text-accent-red" },
        { value: regionCount.toString(), label: "Regions", color: "text-accent-amber" },
        { value: formatTime(lastAlertMinutes), label: "Last Alert", color: "text-accent-green" },
      ].map((stat) => (
        <div key={stat.label} className="flex-1 bg-bg-surface border border-border rounded-xl p-3 text-center">
          <div className={`font-mono text-[22px] font-bold tracking-tight leading-none ${stat.color}`}>
            {stat.value}
          </div>
          <div className="text-[9px] text-text-tertiary uppercase tracking-widest font-medium mt-1.5">
            {stat.label}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Create `components/map/BottomSheet.tsx`**

```tsx
"use client";

import type { Alert, CityCoord } from "../../lib/types";

interface BottomSheetProps {
  alert: Alert | null;
  cityCoords: Map<string, CityCoord>;
  onClose: () => void;
  onShowInFeed: (alert: Alert) => void;
}

const threatLabels: Record<number, { label: string; color: string }> = {
  0: { label: "Unknown", color: "text-text-tertiary" },
  1: { label: "Low", color: "text-accent-green" },
  2: { label: "Medium", color: "text-accent-amber" },
  3: { label: "High", color: "text-accent-red" },
};

export function BottomSheet({ alert, cityCoords, onClose, onShowInFeed }: BottomSheetProps) {
  if (!alert) return null;

  const threat = threatLabels[alert.threat] ?? threatLabels[0];
  const regionIds = new Set(
    alert.cities
      .map((c) => cityCoords.get(c)?.region_id)
      .filter(Boolean)
  );
  const timeAgo = Math.round((Date.now() - alert.timestamp) / 60000);

  return (
    <div className="absolute bottom-0 left-0 right-0 z-[1000] bg-bg-surface/95 backdrop-blur-xl border-t border-border-active rounded-t-2xl p-4 animate-slide-up">
      <div className="flex justify-between items-start mb-3">
        <span className={`font-mono text-sm font-medium ${threat.color}`}>
          {timeAgo < 60 ? `${timeAgo}m ago` : `${Math.floor(timeAgo / 60)}h ago`}
        </span>
        <button onClick={onClose} className="text-text-tertiary text-sm p-1">✕</button>
      </div>
      <div className="text-text-primary font-medium text-[15px] mb-1">
        {alert.cities.join(", ")}
      </div>
      <div className="flex items-center gap-1.5 text-[11px] text-text-tertiary mb-3">
        <span>{Array.from(regionIds).join(", ")}</span>
        <span className="w-1 h-1 bg-text-tertiary rounded-full" />
        <span>{alert.cities.length} cities</span>
        <span className="w-1 h-1 bg-text-tertiary rounded-full" />
        <span className={threat.color}>Threat {alert.threat}</span>
      </div>
      <button
        onClick={() => onShowInFeed(alert)}
        className="text-accent-blue text-[12px] font-medium"
      >
        Show in Feed →
      </button>
    </div>
  );
}
```

- [ ] **Step 6: Wire Map View into AppShell**

Update `components/AppShell.tsx` to replace the map placeholder with the actual `AlertMap`, `MapStats`, and `BottomSheet` components, passing the data from hooks.

- [ ] **Step 7: Add Leaflet CSS import**

In `app/globals.css`:
```css
@import "leaflet/dist/leaflet.css";
@import "leaflet.markercluster/dist/MarkerCluster.css";
@import "leaflet.markercluster/dist/MarkerCluster.Default.css";
```

- [ ] **Step 8: Verify map renders with markers**

```bash
npm run dev
```

Expected: Dark map centered on Israel, with alert markers (if data has been ingested), filter chips, stats strip, and bottom sheet on marker tap.

- [ ] **Step 9: Commit**

```bash
git add components/map/ components/AppShell.tsx app/globals.css
git commit -m "feat: add interactive Leaflet map with clustered markers, stats strip, and bottom sheet"
```

---

## Chunk 5: Analytics & Feed Views

### Task 10: Analytics Panel Components

**Files:**
- Create: `components/analytics/AnalyticsView.tsx`
- Create: `components/analytics/AnalyticsCard.tsx`
- Create: `components/analytics/charts/BarChart.tsx`
- Create: `components/analytics/charts/DonutChart.tsx`
- Create: `components/analytics/charts/SparkLine.tsx`
- Create: `components/analytics/panels/ShabbatPanel.tsx`
- Create: `components/analytics/panels/HourlyPanel.tsx`
- Create: `components/analytics/panels/MonthlyPanel.tsx`
- Create: `components/analytics/panels/EscalationPanel.tsx`
- Create: `components/analytics/panels/QuietPeriodsPanel.tsx`
- Create: `components/analytics/panels/MultiRegionPanel.tsx`
- Create: `components/analytics/panels/AlertGapsPanel.tsx`
- Create: `components/analytics/panels/GeoSpreadPanel.tsx`
- Create: `components/analytics/panels/ThreatPanel.tsx`
- Create: `components/analytics/panels/AmPmPanel.tsx`
- Create: `components/analytics/panels/DayOfWeekPanel.tsx`

- [ ] **Step 1: Create `components/analytics/AnalyticsCard.tsx` — reusable card wrapper**

```tsx
interface AnalyticsCardProps {
  title: string;
  badge?: { label: string; type: "up" | "down" | "neutral" };
  children: React.ReactNode;
}

export function AnalyticsCard({ title, badge, children }: AnalyticsCardProps) {
  const badgeColors = {
    up: "bg-accent-red/10 text-accent-red",
    down: "bg-accent-green/10 text-accent-green",
    neutral: "bg-bg-elevated text-text-secondary",
  };

  return (
    <div className="bg-bg-surface border border-border rounded-[14px] overflow-hidden mb-2.5">
      <div className="flex justify-between items-start p-4 pb-0">
        <h3 className="text-[13px] font-medium text-text-primary">{title}</h3>
        {badge && (
          <span className={`text-[9px] font-mono font-medium px-2 py-0.5 rounded-md ${badgeColors[badge.type]}`}>
            {badge.label}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Create shared chart components**

Create five chart wrapper components. Each wraps Recharts with dark theme styling and is <50 lines:

`components/analytics/charts/MiniBarChart.tsx` — wraps `BarChart` + `Bar` from Recharts. Props: `data: {name: string, value: number}[]`, `highlightIndices?: number[]`, `color?: string`, `highlightColor?: string`. Used by: Hourly, DayOfWeek, AlertGaps, Escalation, MultiRegion panels.

`components/analytics/charts/DonutChart.tsx` — wraps `PieChart` + `Pie` with `innerRadius={40}`. Props: `data: {name: string, value: number, fill: string}[]`. Used by: Threat panel.

`components/analytics/charts/SparkLine.tsx` — wraps `LineChart` + `Line` with no axes. Props: `data: {value: number}[]`, `color?: string`. Used by: Monthly panel.

`components/analytics/charts/ComparisonBar.tsx` — two horizontal bars showing AM vs PM split. Props: `leftValue: number`, `rightValue: number`, `leftLabel: string`, `rightLabel: string`. Pure CSS, no Recharts. Used by: AmPm panel.

`components/analytics/charts/StatRow.tsx` — labeled stat row with metric name and value. Props: `label: string`, `sublabel?: string`, `value: string`, `color?: string`. Used by: QuietPeriods, GeoSpread panels.

- [ ] **Step 3: Create individual panel components**

Each panel follows the same pattern:
1. Call `useAnalytics(key, regionId)` to fetch pre-computed data
2. Render inside `AnalyticsCard` with hero stat, chart, and insight box
3. Handle loading state with a skeleton shimmer

Example — `components/analytics/panels/ShabbatPanel.tsx`:

```tsx
"use client";

import { useAnalytics } from "../../../lib/hooks/use-analytics";
import { AnalyticsCard } from "../AnalyticsCard";

interface ShabbatData {
  shabbatCount: number;
  weekdayCount: number;
  multiplier: number;
  shabbatPercent: number;
}

export function ShabbatPanel({ regionId }: { regionId: string | null }) {
  const { data, loading } = useAnalytics<ShabbatData>("shabbat_vs_weekday", regionId);

  if (loading || !data) {
    return <div className="h-48 bg-bg-surface rounded-[14px] animate-pulse mb-2.5" />;
  }

  return (
    <AnalyticsCard
      title="Shabbat vs Weekday"
      badge={{ label: `${data.multiplier}x`, type: data.multiplier > 1 ? "up" : "down" }}
    >
      <div className="flex gap-2 px-4 py-3">
        <div className="flex-1 text-center">
          <div className="text-[9px] uppercase tracking-widest text-text-tertiary font-medium mb-1.5">Shabbat avg</div>
          <div className="font-mono text-2xl font-bold text-accent-amber tracking-tight">{data.shabbatCount}</div>
        </div>
        <div className="w-px bg-border my-1" />
        <div className="flex-1 text-center">
          <div className="text-[9px] uppercase tracking-widest text-text-tertiary font-medium mb-1.5">Weekday avg</div>
          <div className="font-mono text-2xl font-bold text-accent-blue tracking-tight">{data.weekdayCount}</div>
        </div>
      </div>
      <div className="mx-4 mb-3.5 p-3 bg-accent-blue/5 border border-accent-blue/10 rounded-[10px] text-[12px] text-text-secondary leading-relaxed">
        Alerts spike <strong className="text-accent-blue font-semibold">{data.multiplier}x on Shabbat</strong> compared to weekday averages.
        Shabbat accounts for {data.shabbatPercent}% of all alerts.
      </div>
    </AnalyticsCard>
  );
}
```

Create the remaining 10 panel components. Each follows the same pattern as ShabbatPanel but with its own data interface and chart. Here are the data interfaces and chart types for each:

```typescript
// HourlyPanel — useAnalytics<HourlyData>("hourly_histogram")
interface HourlyData { hours: { hour: number; count: number }[]; peakHour: number; quietestHour: number; }
// Chart: Recharts BarChart with 24 bars, highlight peakHour bar

// MonthlyPanel — useAnalytics<MonthlyData>("monthly_trends")
interface MonthlyData { months: { month: string; count: number }[]; monthOverMonthDelta: number; }
// Chart: Recharts LineChart sparkline, badge shows delta %

// EscalationPanel — useAnalytics<EscalationData>("escalation_patterns")
interface EscalationData { currentRate: number; baseline: number; multiplier: number; escalations: { start: number; end: number; rate: number }[]; }
// Hero: multiplier + "above baseline", Chart: Recharts BarChart step-style

// QuietPeriodsPanel — useAnalytics<QuietData>("quiet_vs_active")
interface QuietData { longestQuietHours: number; longestActiveHours: number; }
// Hero: longestQuietHours + "hours", two sparkline rows for quiet vs active

// MultiRegionPanel — useAnalytics<MultiRegionData>("multi_city_correlation")
interface MultiRegionData { multiRegionCount: number; avgRegions: number; coOccurrence: Record<string, Record<string, number>>; }
// Hero: avgRegions, Chart: Recharts BarChart grouped by region pair frequency

// AlertGapsPanel — useAnalytics<GapData>("time_between_alerts")
interface GapData { medianGapMinutes: number; distribution: { label: string; max: number; count: number }[]; }
// Hero: medianGapMinutes + "min median", Chart: Recharts BarChart histogram

// GeoSpreadPanel — useAnalytics<SpreadData>("geographic_spread")
interface SpreadData { avgRegionsPerGroup: number; totalGroups: number; }
// Hero: avgRegionsPerGroup, Chart: Recharts AreaChart over time (if data available)

// ThreatPanel — useAnalytics<ThreatData>("threat_distribution")
interface ThreatData { counts: Record<number, number>; mostCommonLevel: number; }
// Hero: "Level {mostCommonLevel}", Chart: Recharts PieChart donut

// AmPmPanel — useAnalytics<AmPmData>("morning_vs_evening")
interface AmPmData { morningCount: number; eveningCount: number; eveningPercent: number; peakHour: number; quietestHour: number; }
// Hero: eveningPercent + "% evening", Chart: split comparison bar

// DayOfWeekPanel — useAnalytics<DayData>("day_of_week")
interface DayData { days: { day: number; name: string; count: number }[]; busiestDay: string; busiestCount: number; }
// Chart: Recharts BarChart with 7 bars, highlight busiest
```

Each panel component should be ~40-60 lines, following the ShabbatPanel structure: loading skeleton, `AnalyticsCard` wrapper, hero stat, chart, insight box.

- [ ] **Step 4: Create `components/analytics/AnalyticsView.tsx`**

```tsx
"use client";

import { useState } from "react";
import { ANALYTICS_PANELS } from "../../lib/types";
import { ShabbatPanel } from "./panels/ShabbatPanel";
import { HourlyPanel } from "./panels/HourlyPanel";
import { MonthlyPanel } from "./panels/MonthlyPanel";
import { EscalationPanel } from "./panels/EscalationPanel";
import { QuietPeriodsPanel } from "./panels/QuietPeriodsPanel";
import { MultiRegionPanel } from "./panels/MultiRegionPanel";
import { AlertGapsPanel } from "./panels/AlertGapsPanel";
import { GeoSpreadPanel } from "./panels/GeoSpreadPanel";
import { ThreatPanel } from "./panels/ThreatPanel";
import { AmPmPanel } from "./panels/AmPmPanel";
import { DayOfWeekPanel } from "./panels/DayOfWeekPanel";

const panelComponents: Record<string, React.ComponentType<{ regionId: string | null }>> = {
  shabbat_vs_weekday: ShabbatPanel,
  hourly_histogram: HourlyPanel,
  monthly_trends: MonthlyPanel,
  escalation_patterns: EscalationPanel,
  quiet_vs_active: QuietPeriodsPanel,
  multi_city_correlation: MultiRegionPanel,
  time_between_alerts: AlertGapsPanel,
  geographic_spread: GeoSpreadPanel,
  threat_distribution: ThreatPanel,
  morning_vs_evening: AmPmPanel,
  day_of_week: DayOfWeekPanel,
};

interface AnalyticsViewProps {
  regionId: string | null;
}

export function AnalyticsView({ regionId }: AnalyticsViewProps) {
  const [activePanels, setActivePanels] = useState<Set<string>>(
    new Set(["shabbat_vs_weekday", "hourly_histogram"])
  );

  const togglePanel = (key: string) => {
    setActivePanels((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="h-full flex flex-col">
      {/* Panel selector chips */}
      <div className="flex gap-1.5 px-4 py-3 overflow-x-auto scrollbar-hide flex-shrink-0">
        {ANALYTICS_PANELS.map((panel) => (
          <button
            key={panel.key}
            onClick={() => togglePanel(panel.key)}
            className={`px-2.5 py-1.5 rounded-lg text-[10px] font-medium whitespace-nowrap border transition-all ${
              activePanels.has(panel.key)
                ? "bg-accent-blue/15 text-accent-blue border-accent-blue/25"
                : "bg-bg-surface text-text-secondary border-border"
            }`}
          >
            {panel.labelEn}
          </button>
        ))}
      </div>

      {/* Active panels */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 scrollbar-hide">
        {regionId && (
          <div className="text-[10px] text-accent-blue font-mono mb-2">
            Filtered: {regionId}
          </div>
        )}
        {ANALYTICS_PANELS.filter((p) => activePanels.has(p.key)).map((panel) => {
          const Component = panelComponents[panel.key];
          return Component ? <Component key={panel.key} regionId={regionId} /> : null;
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Wire AnalyticsView into AppShell**

Update the analytics tab placeholder in `AppShell.tsx`:
```tsx
{activeTab === "analytics" && <AnalyticsView regionId={filter.regionId} />}
```

- [ ] **Step 6: Verify analytics panels render**

```bash
npm run dev
```

Expected: Analytics tab shows chip selectors and cards with data from Turso (or loading skeletons if no data yet).

- [ ] **Step 7: Commit**

```bash
git add components/analytics/
git commit -m "feat: add analytics view with 11 selectable analysis panels"
```

---

### Task 11: Alert Feed View

**Files:**
- Create: `components/feed/FeedView.tsx`
- Create: `components/feed/FeedItem.tsx`
- Create: `components/feed/FeedSearch.tsx`
- Modify: `components/AppShell.tsx`

- [ ] **Step 1: Create `components/feed/FeedItem.tsx`**

```tsx
import type { Alert, CityCoord } from "../../lib/types";

interface FeedItemProps {
  alert: Alert;
  cityCoords: Map<string, CityCoord>;
  onTap: (alert: Alert) => void;
}

function getRecency(timestamp: number): { label: string; color: string; borderClass: string } {
  const minutes = Math.round((Date.now() - timestamp) / 60000);
  if (minutes < 60) return { label: `${minutes}m ago`, color: "text-accent-red", borderClass: "border-l-accent-red shadow-[inset_0_0_8px_theme(colors.accent-red/20)]" };
  if (minutes < 360) return { label: `${Math.floor(minutes / 60)}h ago`, color: "text-accent-amber", borderClass: "border-l-accent-amber" };
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return { label: `${hours}h ago`, color: "text-text-tertiary", borderClass: "border-l-text-tertiary" };
  return { label: `${Math.floor(hours / 24)}d ago`, color: "text-text-tertiary", borderClass: "border-l-text-tertiary" };
}

export function FeedItem({ alert, cityCoords, onTap }: FeedItemProps) {
  const recency = getRecency(alert.timestamp);
  const regions = new Set(
    alert.cities.map((c) => cityCoords.get(c)?.region_id).filter(Boolean)
  );

  return (
    <button
      onClick={() => onTap(alert)}
      className={`w-full text-left bg-bg-surface border border-border rounded-xl p-3.5 border-l-[3px] ${recency.borderClass} transition-colors active:bg-bg-surface-hover`}
    >
      <div className="flex justify-between items-center mb-2">
        <span className={`font-mono text-[11px] font-medium ${recency.color}`}>{recency.label}</span>
        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-bg-elevated text-text-secondary border border-border">
          Threat {alert.threat}
        </span>
      </div>
      <div className="text-[14px] font-medium text-text-primary mb-1 leading-snug">
        {alert.cities.join(", ")}
      </div>
      <div className="flex items-center gap-1.5 text-[11px] text-text-tertiary">
        <span>{Array.from(regions).join(", ") || "Unknown"}</span>
        <span className="w-0.5 h-0.5 bg-text-tertiary rounded-full" />
        <span>{alert.cities.length} cities</span>
      </div>
    </button>
  );
}
```

- [ ] **Step 2: Create `components/feed/FeedSearch.tsx`**

```tsx
"use client";

interface FeedSearchProps {
  value: string;
  onChange: (value: string) => void;
}

export function FeedSearch({ value, onChange }: FeedSearchProps) {
  return (
    <div className="px-4 pb-2.5">
      <div className="flex items-center gap-2 bg-bg-surface border border-border rounded-[10px] px-3.5 py-2.5">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-tertiary flex-shrink-0">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search cities or regions..."
          className="bg-transparent text-[13px] text-text-primary placeholder:text-text-tertiary outline-none w-full"
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create `components/feed/FeedView.tsx`**

```tsx
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { FeedItem } from "./FeedItem";
import { FeedSearch } from "./FeedSearch";
import { useAlertFeed } from "../../lib/hooks/use-alerts";
import { useCityCoords } from "../../lib/hooks/use-city-coords";
import type { Alert, FilterState } from "../../lib/types";

interface FeedViewProps {
  filter: FilterState;
  onAlertTap: (alert: Alert) => void;
}

export function FeedView({ filter, onAlertTap }: FeedViewProps) {
  const [search, setSearch] = useState("");
  const { alerts, loading, hasMore, loadMore } = useAlertFeed(filter);
  const { coords } = useCityCoords();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load initial page
  useEffect(() => {
    loadMore();
  }, [filter.timeRange, filter.regionId]);

  // Infinite scroll
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || loading || !hasMore) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 200) {
      loadMore();
    }
  }, [loading, hasMore, loadMore]);

  // Filter by search (client-side, bilingual)
  const filtered = search
    ? alerts.filter((a) => {
        const q = search.toLowerCase();
        // Match Hebrew city names
        if (a.cities.some((c) => c.includes(search))) return true;
        // Match English city names
        if (a.cities.some((c) => coords.get(c)?.city_name_en?.toLowerCase().includes(q))) return true;
        // Match region
        if (a.cities.some((c) => coords.get(c)?.region_id?.includes(q))) return true;
        return false;
      })
    : alerts;

  // Filter by region if set
  const regionFiltered = filter.regionId
    ? filtered.filter((a) => a.cities.some((c) => coords.get(c)?.region_id === filter.regionId))
    : filtered;

  return (
    <div className="h-full flex flex-col">
      <FeedSearch value={search} onChange={setSearch} />
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 pb-4 flex flex-col gap-1.5 scrollbar-hide"
      >
        {regionFiltered.map((alert) => (
          <FeedItem key={alert.id} alert={alert} cityCoords={coords} onTap={onAlertTap} />
        ))}
        {loading && (
          <div className="py-4 text-center text-text-tertiary text-[12px]">Loading...</div>
        )}
        {!hasMore && regionFiltered.length > 0 && (
          <div className="py-4 text-center text-text-tertiary text-[12px]">End of alerts</div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Wire FeedView into AppShell with cross-tab navigation**

Update `AppShell.tsx` to:
- Replace feed placeholder with `<FeedView filter={filter} onAlertTap={handleShowOnMap} />`
- Implement `handleShowOnMap` which sets active tab to "map" and centers map on the alert

- [ ] **Step 5: Verify feed renders with infinite scroll**

```bash
npm run dev
```

Expected: Feed tab shows alert cards with search, infinite scroll loads more, tapping an item switches to map.

- [ ] **Step 6: Commit**

```bash
git add components/feed/ components/AppShell.tsx
git commit -m "feat: add alert feed with search, infinite scroll, and cross-tab navigation"
```

---

## Chunk 6: Bilingual Support, Ingest Webhook, and Polish

### Task 12: Bilingual (EN/HE) Support

**Files:**
- Create: `lib/i18n.ts`
- Create: `components/LanguageToggle.tsx`
- Modify: `components/AppShell.tsx`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Create `lib/i18n.ts` with app-specific translations**

```typescript
import { mergeTranslations } from "best-time-ui";

export const appTranslations = mergeTranslations({
  en: {
    "app.title": "Alert Map",
    "tab.map": "Map",
    "tab.analytics": "Analytics",
    "tab.feed": "Feed",
    "filter.24h": "Last 24h",
    "filter.7d": "7 days",
    "filter.30d": "30 days",
    "filter.custom": "Custom",
    "filter.allRegions": "All Regions",
    "stats.today": "Today",
    "stats.regions": "Regions",
    "stats.lastAlert": "Last Alert",
    "feed.search": "Search cities or regions...",
    "feed.loading": "Loading...",
    "feed.end": "End of alerts",
    "status.stale": "Data may be stale",
    "sheet.showInFeed": "Show in Feed →",
  },
  he: {
    "app.title": "מפת התרעות",
    "tab.map": "מפה",
    "tab.analytics": "ניתוח",
    "tab.feed": "עדכונים",
    "filter.24h": "24 שעות",
    "filter.7d": "7 ימים",
    "filter.30d": "30 ימים",
    "filter.custom": "מותאם",
    "filter.allRegions": "כל האזורים",
    "stats.today": "היום",
    "stats.regions": "אזורים",
    "stats.lastAlert": "התרעה אחרונה",
    "feed.search": "חיפוש ערים או אזורים...",
    "feed.loading": "טוען...",
    "feed.end": "סוף ההתרעות",
    "status.stale": "הנתונים עשויים להיות לא עדכניים",
    "sheet.showInFeed": "← הצג בעדכונים",
  },
});
```

- [ ] **Step 2: Wrap app in `I18nProvider` in `app/layout.tsx`**

Wrap children with the `I18nProvider` from `best-time-ui`, passing `appTranslations`.

- [ ] **Step 3: Create `components/LanguageToggle.tsx`**

```tsx
"use client";

import { useLanguage } from "best-time-ui";

export function LanguageToggle() {
  const { lang, setLang } = useLanguage();

  const toggle = () => {
    const next = lang === "en" ? "he" : "en";
    setLang(next);
    document.documentElement.dir = next === "he" ? "rtl" : "ltr";
    document.documentElement.lang = next;
  };

  return (
    <button
      onClick={toggle}
      className="text-[11px] text-text-tertiary font-medium px-2 py-1 rounded-md border border-border transition-colors hover:border-border-active"
    >
      {lang === "en" ? "EN · עב" : "עב · EN"}
    </button>
  );
}
```

Replace the hardcoded language button in `AppShell.tsx` header with this `LanguageToggle` component.

- [ ] **Step 4: Replace hardcoded strings across all components with `useTranslation` calls**

Update these components to use `const { t } = useTranslation();` and replace strings:
- `TabBar`: tab labels (`t("tab.map")`, `t("tab.analytics")`, `t("tab.feed")`)
- `FilterChips`: chip labels (`t("filter.24h")`, etc.)
- `MapStats`: stat labels (`t("stats.today")`, etc.)
- `FeedSearch`: placeholder (`t("feed.search")`)
- `BottomSheet`: "Show in Feed" (`t("sheet.showInFeed")`)
- `StatusBanner`: stale message (`t("status.stale")`)
- Analytics panel insight text: add insight keys to `appTranslations` (e.g., `"insight.shabbat"`) with both EN/HE versions, and use `t()` in each panel component

- [ ] **Step 5: Add RTL support**

The `LanguageToggle` component already sets `document.documentElement.dir`. Ensure Tailwind classes use logical properties where needed (e.g., `ps-4` instead of `pl-4` for RTL-sensitive padding). The feed item left border should become right border in RTL — use `border-s-[3px]` instead of `border-l-[3px]`.

- [ ] **Step 5: Verify bilingual toggle works**

```bash
npm run dev
```

Expected: Clicking EN/עב toggles all text and layout direction.

- [ ] **Step 6: Commit**

```bash
git add lib/i18n.ts components/ app/layout.tsx
git commit -m "feat: add bilingual EN/HE support with RTL layout"
```

---

### Task 13: System Status Indicator

**Files:**
- Create: `components/StatusBanner.tsx`
- Modify: `components/AppShell.tsx`

- [ ] **Step 1: Create `components/StatusBanner.tsx`**

```tsx
"use client";

import { useAnalytics } from "../lib/hooks/use-analytics";

interface SystemStatus {
  status: string;
  consecutive_failures: number;
  last_success: number;
}

export function StatusBanner() {
  const { data } = useAnalytics<SystemStatus>("system_status", null);

  if (!data || data.status === "ok") return null;

  const minutesAgo = Math.round((Date.now() - data.last_success) / 60000);

  return (
    <div className="mx-4 mb-2 px-3 py-2 bg-accent-amber/10 border border-accent-amber/20 rounded-lg text-[11px] text-accent-amber">
      Data may be stale — last updated {minutesAgo}m ago
    </div>
  );
}
```

- [ ] **Step 2: Add StatusBanner to AppShell above content area**

- [ ] **Step 3: Commit**

```bash
git add components/StatusBanner.tsx components/AppShell.tsx
git commit -m "feat: add system status banner for stale data detection"
```

---

### Task 14: Vercel Deployment Configuration

**Files:**
- Create: `vercel.json`
- Create: `app/api/ingest/route.ts`
- Modify: `next.config.ts`

- [ ] **Step 1: Create `app/api/ingest/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-ingest-secret");

  if (secret !== process.env.INGEST_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // This endpoint is a sync signal from GitHub Actions.
  // The actual ingestion happens in the GH Action directly against Turso.
  // This route can be used for cache busting or triggering ISR revalidation if needed.

  return NextResponse.json({ ok: true, timestamp: Date.now() });
}
```

- [ ] **Step 2: Create `vercel.json`**

```json
{
  "framework": "nextjs",
  "regions": ["iad1"]
}
```

Note: Security headers are defined in `next.config.ts` via `headers()` — no need to duplicate in `vercel.json`.

- [ ] **Step 3: Add `.superpowers/` to `.gitignore`**

- [ ] **Step 4: Commit**

```bash
git add vercel.json app/api/ingest/route.ts next.config.ts .gitignore
git commit -m "feat: add Vercel deployment config and ingest webhook endpoint"
```

---

### Task 15: Final Integration Test

- [ ] **Step 1: Run ingestion locally to populate data**

```bash
npm run ingest
```

- [ ] **Step 2: Run dev server and test all three views**

```bash
npm run dev
```

Verify:
- Map shows markers at correct locations
- Filters change map markers, stats, analytics, and feed
- Analytics panels display correct data with charts
- Feed shows alerts with search and infinite scroll
- Tapping feed item navigates to map
- Language toggle switches EN/HE with RTL
- Status banner appears when data is stale

- [ ] **Step 3: Run all tests**

```bash
npm test
```

Expected: All tests pass.

- [ ] **Step 4: Build for production**

```bash
npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve integration issues from end-to-end testing"
```
