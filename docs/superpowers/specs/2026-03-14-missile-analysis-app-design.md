# Missile Analysis App — Design Spec

## Overview

A mobile-first, bilingual (EN/HE) web application that visualizes Israel missile alert data on an interactive map and provides selectable analytics dashboards. Designed for both the general Israeli public and researchers/journalists.

The app is architecturally optimized for Vercel's free tier by pre-computing analytics during data ingestion (via GitHub Actions) and serving the frontend as a static shell that reads directly from Turso edge replicas — resulting in essentially one serverless function (the ingest webhook) across the entire application.

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│  GitHub Actions (every 5 min)                           │
│  1. Poll api.tzevaadom.co.il/alerts-history             │
│  2. Deduplicate & store raw alerts in Turso             │
│  3. Compute all 11 analytics views as JSON blobs        │
│  4. Store pre-computed analytics in Turso               │
│  5. POST to /api/ingest webhook (optional sync signal)  │
└────────────────────────────────────────┬────────────────┘
                                         │
                                         ▼
                              ┌─────────────────────┐
                              │   Turso (SQLite)     │
                              │                     │
                              │  tables:            │
                              │  • alerts           │
                              │  • analytics_cache  │
                              │  • city_coords      │
                              └──────────┬──────────┘
                                         │
                              Edge reads (no functions)
                                         │
                                         ▼
               ┌───────────┐   ┌──────────────────────────┐
               │ Cloudflare │──▶│  Next.js App (Vercel)    │
               │ (DNS proxy)│   │                          │
               │ Bot prot.  │   │  Static shell + client   │
               │ DDoS       │   │  • /api/ingest (POST)   │
               └───────────┘   │    (1 serverless fn)     │
                                │  • Everything else:      │
                                │    static/client-side    │
                                └──────────────────────────┘
```

### Data Flow

1. **Ingestion (GitHub Actions):** Cron job runs every 5 minutes. Fetches alerts from the Tzeva Adom API, deduplicates against existing records in Turso, inserts new alerts, then re-computes all analytics views and writes them as JSON blobs to the `analytics_cache` table.

2. **Serving (Next.js + Turso):** The Next.js app is statically generated. On the client side, `@libsql/client` reads from Turso edge replicas using a read-only auth token. No Vercel serverless functions are invoked for data reads.

3. **Protection (Cloudflare):** DNS-proxied for bot protection, DDoS mitigation, and CDN caching. Same setup as best-shower-time. The ingest webhook authenticates via a shared secret header, not IP-based filtering.

## Data Model

### `alerts` table

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | `"{group_id}_{timestamp}"` |
| timestamp | INTEGER NOT NULL | Unix milliseconds |
| cities | TEXT NOT NULL | JSON array of Hebrew city names |
| threat | INTEGER DEFAULT 0 | Threat level |
| is_drill | BOOLEAN DEFAULT FALSE | Whether alert is a drill |
| created_at | INTEGER NOT NULL | Ingestion timestamp |

Indexes: `idx_timestamp (timestamp)`, `idx_threat (threat)`

### `analytics_cache` table

| Column | Type | Description |
|--------|------|-------------|
| key | TEXT PK | Analytics type identifier |
| data | TEXT NOT NULL | Pre-computed JSON blob |
| computed_at | INTEGER NOT NULL | Last computation timestamp |
| params | TEXT | Optional filter params (e.g. region) |

### `city_coords` table

| Column | Type | Description |
|--------|------|-------------|
| city_name | TEXT PK | Hebrew name (matches API) |
| city_name_en | TEXT | English name |
| lat | REAL NOT NULL | Latitude |
| lng | REAL NOT NULL | Longitude |
| region_id | TEXT | Links to best-time-ui region |

Seeded via a one-time geocoding script using the ~800 city mappings from best-shower-time's `cityNames.ts`.

### Analytics Cache Keys

Each key is computed during every ingestion run:

| Key | Content |
|-----|---------|
| `hourly_histogram` | Alert counts by hour (0-23) |
| `day_of_week` | Counts per day, with Shabbat flagged |
| `shabbat_vs_weekday` | Aggregate comparison with percentages |
| `morning_vs_evening` | Split at 06:00/18:00 boundary |
| `monthly_trends` | Alerts per month over time |
| `regional_heatmap` | Alert counts per region |
| `threat_distribution` | Counts by threat level over time |
| `escalation_patterns` | Sequences where frequency > 2x baseline |
| `quiet_vs_active` | Longest gaps and longest sustained periods |
| `multi_city_correlation` | Alerts hitting 3+ regions simultaneously |
| `time_between_alerts` | Distribution histogram of gap durations |
| `geographic_spread` | Avg regions per alert wave over time |

Per-region variants are stored as `regional_{region_id}` for each analytics type when filters are applied.

## UI Design

### App Structure

Three-tab mobile-first layout with a persistent bottom tab bar:

1. **Map View** (default) — Interactive Leaflet map
2. **Analytics View** — Selectable analysis panels
3. **Alert Feed** — Chronological alert list with search

All three views share a single filter state (time range, region). Changing a filter on any tab affects all tabs.

### Visual Design Language

- **Theme:** Dark (navy/slate base), consistent with dashboard reference images
- **Typography:** DM Sans (body), JetBrains Mono (data/stats), Instrument Serif (headings)
- **Colors:**
  - Background: `#0B0E14` (primary), `#12161F` (elevated), `#181D28` (surface)
  - Text: `#E8ECF4` (primary), `#6B7A90` (secondary), `#3D4B5F` (tertiary)
  - Accents: Red `#EF4444` (critical), Amber `#F59E0B` (warning), Green `#10B981` (safe), Blue `#3B82F6` (active/interactive)
- **Borders:** `rgba(255,255,255,0.06)` subtle, `rgba(255,255,255,0.12)` active
- **Effects:** Glow on critical markers, ripple animations, glassmorphic tooltips, backdrop blur

### Map View

- **Tiles:** CartoDB Dark Matter (free, dark theme)
- **Markers:** Color-coded by recency — red (critical/recent), amber (warning), muted gray (old). Opacity fades with age. Glow effect on recent markers with ripple animation.
- **Clustering:** `leaflet.markercluster` — cluster circles show count, colored by most severe alert in group. Tap to zoom into individual markers.
- **Interaction:** Tap marker → bottom sheet (not tooltip) showing city names, timestamp, threat level, region, and "Show in Feed" link. Pinch-to-zoom on mobile, controls on desktop.
- **Filters:** Horizontal scrolling chip row — Last 24h, 7 days, 30 days, Custom (date range picker bottom sheet), Region dropdown (auto-zooms to region bounds).
- **Stats strip:** Three compact cards below filters — alert count (red), regions hit (amber), time since last alert (green). Monospace numerals.
- **Region labels:** Subtle, low-opacity text labels on the map for orientation.

### Analytics View

- **Panel selector:** Horizontal chip row at top. Users toggle panels on/off. Multiple panels can be active simultaneously (scrollable stack).
- **Card structure:** Each panel is a card with: header (title + trend badge), hero stat (large monospace number + unit), chart/visualization, insight text box.
- **Filter awareness:** All panels respect the active filters. A "filter active" indicator shows when viewing a filtered slice vs the full dataset.
- **Animations:** Cards appear/disappear with smooth height transitions.

#### Panel Specifications

| Panel | Hero Stat | Chart | Insight |
|-------|-----------|-------|---------|
| Shabbat vs Weekday | Multiplier (e.g. 2.3x) | 7-bar day-of-week, Fri/Sat highlighted amber | Comparison with percentage breakdown |
| Hourly Pattern | Peak hour | 24-bar histogram | Quietest/busiest windows |
| Monthly Trends | Month-over-month delta | 12-month line sparkline | Seasonal patterns |
| Escalation Patterns | Current rate vs baseline | Step chart showing ramp-ups | Active escalation detection |
| Quiet Periods | Longest gap | Timeline visualization | Longest quiet vs active streaks |
| Multi-Region Correlation | Avg regions per wave | Grouped bar chart | Which regions get hit together |
| Time Between Alerts | Median gap | Distribution histogram | Statistical spread |
| Geographic Spread | Regions per event | Stacked area chart | Concentration vs dispersion |
| Threat Distribution | Most common level | Donut chart | Threat level shifts |
| Morning vs Evening | Evening % share | Split bar (AM/PM) | Peak and quietest hours |
| Day-of-Week | Busiest day | 7-bar chart | Weekday patterns beyond Shabbat |

### Alert Feed View

- **Search:** Text input at top for filtering by city name or region
- **Items:** Cards with left border colored by severity (red glow for critical, amber for warning, gray for older). Shows: relative timestamp, threat level badge, city list, region name, city count.
- **Interaction:** Tapping a feed item switches to Map View and centers on that alert's location.
- **Pagination:** Infinite scroll loading older alerts from Turso.

### Bilingual Support (EN/HE)

- Uses best-time-ui's `LanguageProvider` and translation system
- Language toggle in the Map View header
- RTL layout support for Hebrew
- City names displayed in the selected language (using cityNames.ts mappings)
- Analytics insights rendered in both languages

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 16 (App Router, static export + 1 API route) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 |
| Map | Leaflet + react-leaflet + CartoDB Dark Matter tiles |
| Clustering | leaflet.markercluster |
| Charts | Recharts 3 |
| Database | Turso (libSQL) |
| Client DB access | @libsql/client (read-only token) |
| Ingestion | GitHub Actions (cron every 5 min) |
| Data source | api.tzevaadom.co.il/alerts-history |
| Shared components | best-time-ui package (regions, city mappings, i18n, types) |
| CDN/Protection | Cloudflare (DNS proxy, bot protection, DDoS) |
| Deployment | Vercel (free tier) |

## Vercel Billing Optimization

| Strategy | Mechanism | Impact |
|----------|-----------|--------|
| Pre-computed analytics | GitHub Actions computes during ingestion | Zero function invocations for analytics |
| Single API route | Only `/api/ingest` is a serverless function | ~288 invocations/day from cron only |
| Client-side Turso reads | `@libsql/client` with read-only token in browser | Bypasses Vercel functions for data |
| Static shell | All pages statically generated | No SSR function invocations |
| Client caching | 60-second in-memory cache of Turso queries | ~80% fewer Turso reads per session |
| CDN offloading | Map tiles from CartoDB, fonts from Google Fonts | Vercel bandwidth minimal |
| Incremental builds | Rebuild only on code changes, not data changes | Minimal build minutes |

**Estimated monthly cost at 10k MAU:** All services within free tiers (Vercel, Turso, GitHub Actions).

**Security:** Read-only Turso token for client-side access (SELECT only on alerts and analytics tables). Ingest webhook authenticated via shared secret header between GitHub Actions and the Vercel function. Cloudflare provides bot protection and DDoS mitigation.

## Not In Scope (YAGNI)

- Authentication — public app
- Real-time websockets — 5-min polling sufficient for historical analysis
- PWA/service worker — can add later
- SSR — static shell with client-side data fetching
- Push notifications — not needed for analysis tool
