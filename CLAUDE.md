# CLAUDE.md — SirenWise

## What is this project?

**SirenWise** (sirenwise.com) is a mobile-first, bilingual (EN/HE) web application that visualizes Israel missile alert data on an interactive map with selectable analytics dashboards. It's designed for both the general Israeli public and researchers/journalists.

The app fetches real-time alert data from the Pikud HaOref (Home Front Command) API via Tzeva Adom, stores it in a Turso database, and presents it through three views: an interactive map, analytics panels, and a chronological alert feed.

## Architecture

```
GitHub Actions (every 5 min)
  → Polls api.tzevaadom.co.il/alerts-history
  → Deduplicates & stores in Turso
  → Computes analytics cache (188 entries across 16 regions)

Next.js App (Vercel)
  → Static pages + 4 API routes
  → /api/alerts, /api/analytics, /api/cities, /api/ingest
  → API routes query Turso via @libsql/client/http
  → Client fetches from API routes (not Turso directly)

Cloudflare → DNS proxy (bot protection, DDoS, SSL)
Porkbun → Domain registrar (sirenwise.com)
```

## Key decisions & lessons learned

### Turso on Vercel
- Use `@libsql/client/http` for serverless functions, NOT `@libsql/client` (which tries to load native SQLite bindings)
- Convert `libsql://` URLs to `https://` — the HTTP transport doesn't understand the `libsql://` scheme
- Always `.trim()` env var values — Vercel's CLI can introduce trailing newlines when piped via `echo`
- Client-side Turso access doesn't work reliably — use API routes as a thin proxy instead

### Data pipeline
- The Tzeva Adom API only returns ~28 hours of history
- Historical data (back to 2021) is available at `https://www.tzevaadom.co.il/static/historical/all.json` as a static JSON file
- Format: `[group_id, threat_level, [cities], unix_timestamp_seconds]`
- Use `scripts/import-historical.ts` to backfill — currently set to last 2 weeks
- Threat levels: 0=Rockets, 2=Infiltration, 3=Earthquake, 5=Hostile Aircraft, 7=Non-conventional Missile, 8=General Alert

### City geocoding
- 1,440 cities mapped with coordinates and region IDs — **100% alert coverage**
- Initial seed used Nominatim (got ~994), then filled remaining 446 from Tzofar's official database at `https://www.tzevaadom.co.il/static/cities.json` which has lat/lng/area for every city in Pikud HaOref's system
- Use `scripts/fill-missing-cities.ts` to fill gaps — maps Tzofar area codes to our region IDs
- 16 regions: the original 15 from best-time-ui plus Yehuda v'Shomron (Judea & Samaria)
- The Tzofar cities JSON also provides English names, area codes (mapped to regions), and countdown times

### Analytics
- Analytics are computed client-side from filtered alerts (not pre-computed server-side) so they respond to time range and region filters
- Shabbat detection: Friday 18:00 through Saturday 21:00 Israel time
- Day-of-week comparisons must be normalized by actual count of each weekday in the range
- Shabbat multiplier uses per-day averages (not raw counts or per-hour rates)
- Time-between-alerts uses **event groups** (group_id), not individual alerts — otherwise simultaneous multi-city alerts create artificial 0-minute gaps
- Quiet/active periods also use event-level timestamps (30-min threshold for "active barrage")
- All times use `Asia/Jerusalem` timezone via `toLocaleString`
- Each analytics card has an (i) info icon opening a methodology modal with data science explanations in EN/HE
- 11 analytics panels: Shabbat, Hourly, AM/PM, Day of Week, Alert Types, Time Between Alerts, Quiet/Active, Monthly Trends, Escalation, Multi-Region, Geographic Spread

### Accessibility
- Text contrast meets WCAG AA: secondary (#8B9BB5, ~5.5:1) and tertiary (#637085, ~4.5:1) on dark bg (#0B0E14)
- Borders at 10%/18% opacity for visibility
- All interactive elements have sufficient touch targets for mobile

### CSP (Content Security Policy)
- GoatCounter needs BOTH `gc.zgo.at` in `script-src` AND `*.goatcounter.com` in `connect-src`
- The script loads from `gc.zgo.at` but sends beacons to `sirenwise.goatcounter.com`
- Map tiles need `*.basemaps.cartocdn.com` in `connect-src`
- Turso needs `*.turso.io` in `connect-src`

## Tech stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 |
| Map | Leaflet + react-leaflet + CartoDB Dark Matter tiles |
| Clustering | leaflet.markercluster |
| Charts | Recharts 3 |
| Database | Turso (libSQL) — `missile-analysis` on `aws-us-east-1` |
| Client DB access | API routes using `@libsql/client/http` |
| Ingestion | GitHub Actions cron (every 5 min) |
| Data source | api.tzevaadom.co.il/alerts-history |
| CDN/Protection | Cloudflare (DNS proxy, nameservers: amit/molly) |
| Domain | Porkbun (sirenwise.com) |
| Deployment | Vercel (missile-analysis-rust.vercel.app) |
| Analytics | GoatCounter (sirenwise.goatcounter.com) |
| Monitoring | best-time-analytics dashboard (shared with sister sites) |

## Project structure

```
app/
  layout.tsx          — Root layout with SEO meta, fonts, I18nProvider, GoatCounter
  page.tsx            — Renders AppShell
  icon.svg            — SVG favicon
  apple-icon.tsx      — Dynamic apple touch icon
  api/
    alerts/route.ts   — GET alerts with time/cursor filtering
    analytics/route.ts — GET pre-computed analytics by key
    cities/route.ts   — GET city coordinates
    ingest/route.ts   — POST webhook (sync signal from GitHub Actions)

components/
  AppShell.tsx        — Main shell: header, filters, tabs, content routing
  TabBar.tsx          — Bottom navigation (Map/Analytics/Feed)
  FilterChips.tsx     — Time range chips + region dropdown + custom date picker
  Footer.tsx          — Persistent footer with sister sites + coffee link
  StatusBanner.tsx    — Stale data warning
  LanguageToggle.tsx  — EN/HE toggle
  map/
    AlertMap.tsx      — Leaflet MapContainer (dynamic import, SSR disabled)
    AlertMarkers.tsx  — Clustered circle markers with recency coloring
    MapStats.tsx      — Stats strip (alert count, regions, last alert)
    BottomSheet.tsx   — Alert detail sheet on marker tap
  analytics/
    AnalyticsView.tsx — Panel orchestrator with all 11 analytics inline
    AnalyticsCard.tsx — Reusable card wrapper with methodology info icon
    MethodologyModal.tsx — Modal explaining data science methodology per panel
    charts/           — MiniBarChart, DonutChart, SparkLine, ComparisonBar, StatRow
    panels/           — Individual panel components (now mostly unused — inlined in AnalyticsView)
  feed/
    FeedView.tsx      — Scrollable alert feed with search + infinite scroll
    FeedItem.tsx      — Individual alert card
    FeedSearch.tsx    — Search input

lib/
  db.ts              — Server-side Turso client factory (@libsql/client/http)
  types.ts           — Shared types (Alert, CityCoord, FilterState, etc.)
  i18n.tsx           — I18nProvider, useI18n hook, EN/HE translations
  methodology.ts     — Data science methodology explanations per panel (EN/HE)
  turso-cache.ts     — Client-side fetch layer with 60s TTL cache
  hooks/
    use-alerts.ts     — useAlerts (map) + useAlertFeed (infinite scroll)
    use-analytics.ts  — useAnalytics (pre-computed data from cache)
    use-city-coords.ts — useCityCoords
    use-filter-state.ts — Shared filter state (time range + region)
    use-client-analytics.ts — Client-side analytics computation from filtered alerts

scripts/
  setup-db.ts        — Creates Turso tables (alerts, analytics_cache, city_coords)
  extract-cities.ts  — Extracts city name mappings from best-shower-time
  seed-cities.ts     — Geocodes cities via Nominatim, inserts into Turso (initial seed)
  fill-missing-cities.ts — Fills gaps using Tzofar's official city database with coordinates
  import-historical.ts — Imports last 2 weeks from tzevaadom.co.il/static/historical/all.json
  render-og.ts       — Renders OG image from HTML template via Puppeteer
  og-template.html   — OG image HTML template
  ingest/
    index.ts         — Main ingestion pipeline (fetch, dedupe, store, compute analytics)
    fetch-alerts.ts  — API fetching + parsing + deduplication
    compute-analytics.ts — 12 analytics computation functions
    __tests__/       — Vitest tests for fetch-alerts and compute-analytics

.github/workflows/
  ingest.yml         — Cron every 5 min, runs npm run ingest

data/
  city-mappings.json — 1,363 Hebrew/English city name pairs

public/
  og-image.png       — Static OG image (phone mockup + branding)
  app-screenshot.png — App screenshot used in OG image
  manifest.json      — PWA manifest
```

## Environment variables

All in `.env.local` (gitignored):

| Variable | Purpose |
|----------|---------|
| `TURSO_DB_URL` | Server-side Turso URL (libsql://) |
| `TURSO_AUTH_TOKEN` | Server-side read-write token |
| `NEXT_PUBLIC_TURSO_DB_URL` | (unused — was for client-side, now uses API routes) |
| `NEXT_PUBLIC_TURSO_READ_TOKEN` | (unused) |
| `INGEST_SECRET` | Shared secret for /api/ingest webhook |
| `PORKBUN_API_KEY` | Porkbun public API key |
| `PORKBUN_SECRET_KEY` | Porkbun secret API key |
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token |

GitHub Actions secrets: `TURSO_DB_URL`, `TURSO_AUTH_TOKEN`

## npm scripts

| Script | Purpose |
|--------|---------|
| `dev` | Next.js dev server |
| `build` | Production build |
| `test` | Vitest (8 tests) |
| `ingest` | Run ingestion pipeline |
| `db:setup` | Create Turso tables |
| `cities:extract` | Extract city names from best-shower-time |
| `cities:seed` | Geocode and seed city coordinates |

## Sister projects

- **Best Shower Time** (bestshowertime.com) — Is it safe to shower?
- **Best Walking Time** (bestwalkingtime.com) — Is it safe to walk?
- **Best Sleeping Time** (bestsleepingtime.com) — Is it safe to sleep?
- **best-time-ui** — Shared React component library
- **best-time-analytics** — Combined GoatCounter analytics dashboard (includes SirenWise)

## Domain & infrastructure

- **Domain:** sirenwise.com (Porkbun)
- **DNS:** Cloudflare (amit.ns.cloudflare.com, molly.ns.cloudflare.com)
- **DNS records:** A → 76.76.21.21 (proxied), CNAME www → cname.vercel-dns.com (proxied)
- **Hosting:** Vercel (missile-analysis-rust.vercel.app)
- **Database:** Turso (missile-analysis-hummusonrails.aws-us-east-1.turso.io)
- **Analytics:** GoatCounter (sirenwise.goatcounter.com)
