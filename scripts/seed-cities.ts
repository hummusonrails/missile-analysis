import { readFileSync } from "fs";
import { createClient } from "@libsql/client";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const db = createClient({
  url: process.env.TURSO_DB_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

interface CityMapping {
  he: string;
  en: string;
}

interface Region {
  id: string;
  lat: [number, number];
  lng: [number, number];
}

const regions: Region[] = [
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
  { id: "yehuda-vshomron", lat: [31.4, 32.55], lng: [34.95, 35.6] },
];

function assignRegion(lat: number, lng: number): string {
  for (const region of regions) {
    if (
      lat >= region.lat[0] &&
      lat <= region.lat[1] &&
      lng >= region.lng[0] &&
      lng <= region.lng[1]
    ) {
      return region.id;
    }
  }
  return "unknown";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function geocodeCity(cityEn: string): Promise<{ lat: number; lng: number } | null> {
  const query = encodeURIComponent(`${cityEn}, Israel`);
  const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1&countrycodes=il`;

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "missile-analysis-geocoder/1.0 (https://github.com/hummusonrails/missile-analysis)",
      },
    });

    if (!response.ok) {
      console.error(`HTTP ${response.status} for ${cityEn}`);
      return null;
    }

    const results = await response.json() as Array<{ lat: string; lon: string }>;
    if (results.length === 0) {
      return null;
    }

    return {
      lat: parseFloat(results[0].lat),
      lng: parseFloat(results[0].lon),
    };
  } catch (err) {
    console.error(`Error geocoding ${cityEn}:`, err);
    return null;
  }
}

async function main() {
  const mappings: CityMapping[] = JSON.parse(
    readFileSync("data/city-mappings.json", "utf-8")
  );

  console.log(`Seeding ${mappings.length} cities...`);

  let inserted = 0;
  let skipped = 0;

  for (const { he, en } of mappings) {
    // Respect Nominatim's 1 req/sec rate limit
    await sleep(1100);

    const coords = await geocodeCity(en);

    if (!coords) {
      console.warn(`  SKIP (no coords): ${en}`);
      skipped++;
      continue;
    }

    const regionId = assignRegion(coords.lat, coords.lng);

    try {
      await db.execute({
        sql: `INSERT OR REPLACE INTO city_coords (city_name, city_name_en, lat, lng, region_id)
              VALUES (?, ?, ?, ?, ?)`,
        args: [he, en, coords.lat, coords.lng, regionId],
      });
      console.log(`  OK: ${en} (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}) -> ${regionId}`);
      inserted++;
    } catch (err) {
      console.error(`  DB error for ${en}:`, err);
      skipped++;
    }
  }

  console.log(`\nDone. Inserted: ${inserted}, Skipped: ${skipped}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
