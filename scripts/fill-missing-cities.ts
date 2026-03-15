import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@libsql/client";

// Map Tzofar area IDs to our region IDs
const AREA_TO_REGION: Record<number, string> = {
  1: "upper-galilee",
  2: "negev",
  3: "shfela",
  4: "lower-galilee",
  5: "jezreel-valley",
  6: "upper-galilee", // Confrontation Line = northern border
  7: "shfela", // Lakhish
  9: "sharon",
  10: "golan-heights",
  11: "yehuda-vshomron", // Samaria
  12: "negev", // Dead Sea
  13: "gaza-envelope",
  14: "yehuda-vshomron", // Judea
  15: "jezreel-valley", // Wadi Ara
  16: "lower-galilee", // Center Galilee
  17: "negev", // Western Negev
  18: "tel-aviv-gush-dan", // Dan
  19: "haifa-krayot", // HaMifratz
  20: "tel-aviv-gush-dan", // Yarkon
  21: "ashkelon-coast", // Western Lakhish
  22: "haifa-krayot", // HaCarmel
  23: "shfela",
  24: "negev", // Central Negev
  25: "jezreel-valley", // Beit Sha'an Valley
  26: "eilat-arava",
  27: "eilat-arava", // Arabah
  28: "golan-heights", // Northern Golan
  29: "yehuda-vshomron", // Bika'a (Jordan Valley)
  32: "jerusalem",
  34: "jezreel-valley", // HaAmakim
};

async function main() {
  const db = createClient({
    url: process.env.TURSO_DB_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  });

  // Fetch Tzofar cities database
  console.log("Fetching Tzofar cities database...");
  const res = await fetch("https://www.tzevaadom.co.il/static/cities.json");
  const data = await res.json();
  const tzofarCities = data.cities as Record<string, { he: string; en: string; lat: number; lng: number; area: number }>;

  console.log(`Tzofar has ${Object.keys(tzofarCities).length} cities`);

  // Get all unique city names from alerts
  const alertsResult = await db.execute("SELECT cities FROM alerts");
  const alertCities = new Set<string>();
  for (const row of alertsResult.rows) {
    const cities = JSON.parse(String(row.cities ?? row[0]));
    for (const c of cities) alertCities.add(c);
  }
  console.log(`${alertCities.size} unique cities in alerts`);

  // Get existing city_coords
  const existingResult = await db.execute("SELECT city_name FROM city_coords");
  const existing = new Set(existingResult.rows.map((r) => String(r.city_name ?? r[0])));
  console.log(`${existing.size} cities already in city_coords`);

  // Find cities in alerts that are missing from city_coords but exist in Tzofar
  const toInsert: { name: string; en: string; lat: number; lng: number; region: string }[] = [];
  const toUpdate: { name: string; en: string; lat: number; lng: number; region: string }[] = [];

  for (const cityName of alertCities) {
    const tzofar = tzofarCities[cityName];
    if (!tzofar) continue;

    const region = AREA_TO_REGION[tzofar.area] || "unknown";

    if (!existing.has(cityName)) {
      toInsert.push({ name: cityName, en: tzofar.en, lat: tzofar.lat, lng: tzofar.lng, region });
    }
  }

  // Also update existing cities that have region_id = "unknown"
  const unknownRegionResult = await db.execute("SELECT city_name FROM city_coords WHERE region_id = 'unknown'");
  for (const row of unknownRegionResult.rows) {
    const cityName = String(row.city_name ?? row[0]);
    const tzofar = tzofarCities[cityName];
    if (tzofar) {
      const region = AREA_TO_REGION[tzofar.area] || "unknown";
      if (region !== "unknown") {
        toUpdate.push({ name: cityName, en: tzofar.en, lat: tzofar.lat, lng: tzofar.lng, region });
      }
    }
  }

  console.log(`\nInserting ${toInsert.length} new cities`);
  console.log(`Updating ${toUpdate.length} cities with unknown region`);

  // Insert new cities in batches
  const BATCH = 50;
  for (let i = 0; i < toInsert.length; i += BATCH) {
    const batch = toInsert.slice(i, i + BATCH);
    await db.batch(
      batch.map((c) => ({
        sql: "INSERT OR IGNORE INTO city_coords (city_name, city_name_en, lat, lng, region_id) VALUES (?, ?, ?, ?, ?)",
        args: [c.name, c.en, c.lat, c.lng, c.region],
      }))
    );
    if ((i + BATCH) % 200 === 0 || i + BATCH >= toInsert.length) {
      console.log(`  Inserted ${Math.min(i + BATCH, toInsert.length)}/${toInsert.length}`);
    }
  }

  // Update existing cities with correct regions
  for (const c of toUpdate) {
    await db.execute({
      sql: "UPDATE city_coords SET region_id = ?, lat = ?, lng = ? WHERE city_name = ?",
      args: [c.region, c.lat, c.lng, c.name],
    });
  }

  // Final count
  const finalCount = await db.execute("SELECT COUNT(*) as c FROM city_coords");
  const unknownCount = await db.execute("SELECT COUNT(*) as c FROM city_coords WHERE region_id = 'unknown'");
  console.log(`\nDone. Total cities in DB: ${finalCount.rows[0].c}`);
  console.log(`Cities with unknown region: ${unknownCount.rows[0].c}`);

  // Check coverage
  let covered = 0;
  for (const cityName of alertCities) {
    const coordResult = await db.execute({ sql: "SELECT city_name FROM city_coords WHERE city_name = ?", args: [cityName] });
    if (coordResult.rows.length > 0) covered++;
  }
  console.log(`Alert city coverage: ${covered}/${alertCities.size} (${Math.round(covered / alertCities.size * 100)}%)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
