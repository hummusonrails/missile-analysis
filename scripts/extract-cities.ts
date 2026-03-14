import { readFileSync, writeFileSync, mkdirSync } from "fs";

mkdirSync("data", { recursive: true });

const source = readFileSync(
  "/Users/bengreenberg/Dev/personal/best-shower-time/lib/cityNames.ts",
  "utf-8"
);

// Parse and extract Hebrew->English city name mappings
const entries: { he: string; en: string }[] = [];
const pairRegex = /"([^"]+)":\s*"([^"]+)"/g;
let match;

// Find the cityNames object in the source
const mapMatch = source.match(/const cityNames[^{]*(\{[\s\S]*?\n\});/);
if (mapMatch) {
  while ((match = pairRegex.exec(mapMatch[1])) !== null) {
    entries.push({ he: match[1], en: match[2] });
  }
}

writeFileSync("data/city-mappings.json", JSON.stringify(entries, null, 2));
console.log(`Extracted ${entries.length} city mappings`);
