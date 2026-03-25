# Pre-Alert Warning Integration Design

**Date:** 2026-03-25
**Status:** Draft

## Problem

SirenWise currently only tracks rocket siren activations (Tzeva Adom alerts). Israel's Home Front Command also issues **pre-alert warnings** — cell broadcast messages sent minutes before sirens activate, triggered when the military detects missile launches. These are a distinct category from actual siren activations and provide valuable lead-time data for analysis.

## Data Source: Tzofar WebSocket

**Why Tzofar over pikud-a-horef-mcp:**
- No geo-blocking (pikud-a-horef-mcp requires Israeli IP)
- Already proven — our existing data source (api.tzevaadom.co.il) is Tzofar's REST API
- WebSocket carries `SYSTEM_MESSAGE` events with exactly the pre-alert data we need
- No authentication required

**Connection details:**
- URL: `wss://ws.tzevaadom.co.il/socket?platform=ANDROID`
- Headers: `User-Agent` (Android), `Referer`/`Origin` (tzevaadom.co.il), `tzofar` (random 32-char hex)
- Reconnection: exponential backoff (10s → 60s max)

**Message types:**
1. `ALERT` — standard siren activation (we already capture these via REST)
2. `SYSTEM_MESSAGE` — pre-alerts and exit notifications

**SYSTEM_MESSAGE structure:**
```json
{
  "type": "SYSTEM_MESSAGE",
  "data": {
    "titleHe": "מבזק פיקוד העורף",
    "bodyHe": "בדקות הקרובות ייתכן ויופעלו התרעות...",
    "citiesIds": [123, 456, 789]
  }
}
```

**Early warning keywords (Hebrew):**
- `"בדקות הקרובות"` (in the coming minutes)
- `"צפויות להתקבל התרעות"` (alerts expected)
- `"ייתכן ויופעלו התרעות"` (alerts may be activated)
- `"זיהוי שיגורים"` (launch detection)
- `"שיגורים לעבר ישראל"` (launches toward Israel)

**Exit notification keywords:**
- `"האירוע הסתיים"` (event concluded)
- `"הסתיים באזורים"` (concluded in areas)

## Architecture

### Option chosen: Lightweight WebSocket bridge as GitHub Actions job

The existing architecture uses GitHub Actions (every 5 min) to poll REST. For pre-alerts, we need near-real-time capture. Two approaches:

**A) Persistent WebSocket listener (VPS-hosted)** — always-on Node process on a VPS, writes to Turso in real-time. Most responsive but requires infrastructure.

**B) GitHub Actions with WebSocket sampling** — a separate workflow that connects briefly to capture recent system messages. Simpler but may miss events between samples.

**C) Hybrid: extend existing ingest with REST fallback + add a lightweight WS bridge script** — the WS bridge runs on the existing VPS (OpenClaw), captures SYSTEM_MESSAGE events, and writes them directly to Turso. The bridge is a simple Node.js script managed by systemd.

**Decision: Option C** — We already have a VPS. The bridge is ~100 lines of code. It writes pre-alerts to a new `pre_alerts` table in the same Turso DB. The existing Next.js app reads from both tables.

### Database Schema

New table `pre_alerts`:
```sql
CREATE TABLE IF NOT EXISTS pre_alerts (
  id TEXT PRIMARY KEY,          -- hash of timestamp + title + body
  timestamp INTEGER NOT NULL,   -- when received (ms)
  title_he TEXT NOT NULL,       -- Hebrew title
  body_he TEXT NOT NULL,        -- Hebrew body text
  city_ids TEXT,                -- JSON array of city IDs
  regions TEXT,                 -- JSON array of resolved region IDs
  alert_type TEXT NOT NULL,     -- 'early_warning' | 'exit_notification'
  raw_data TEXT,                -- Full JSON for debugging
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_pre_alerts_timestamp ON pre_alerts(timestamp);
CREATE INDEX idx_pre_alerts_type ON pre_alerts(alert_type);
```

### WebSocket Bridge (`scripts/ws-bridge.ts`)

Responsibilities:
1. Connect to `wss://ws.tzevaadom.co.il/socket?platform=ANDROID`
2. Filter for `SYSTEM_MESSAGE` type
3. Classify as `early_warning` or `exit_notification` using keyword matching
4. Map `citiesIds` to region IDs using city_coords table
5. Deduplicate (hash-based ID)
6. Write to `pre_alerts` table in Turso
7. Auto-reconnect with exponential backoff
8. Log to stdout (systemd captures)

### API Route: `/api/pre-alerts`

```typescript
GET /api/pre-alerts?since=<ms>&type=<early_warning|exit_notification>&limit=<n>
```

Returns pre-alerts filtered by time, type, and with pagination.

### UI Integration

1. **Feed view**: Pre-alerts appear in the chronological feed with a distinct visual style (amber/yellow for early warnings, green for exit notifications) and a "PRE-ALERT" badge
2. **Map view**: When a pre-alert has resolved regions, show a pulsing amber overlay on those regions
3. **Analytics**: New panel "Pre-Alert Lead Time" — time between early_warning and the first matching siren in the same regions
4. **Filter**: New chip to toggle pre-alerts visibility on/off

### Translation (i18n)

| Key | EN | HE |
|-----|----|----|
| pre_alert | Pre-Alert | התרעה מוקדמת |
| early_warning | Early Warning | אזהרה מוקדמת |
| exit_notification | All Clear | סיום אירוע |
| pre_alert_lead_time | Pre-Alert Lead Time | זמן התרעה מוקדמת |

## Implementation Plan

1. **DB schema**: Add `pre_alerts` table via setup-db.ts
2. **WS bridge script**: `scripts/ws-bridge.ts` — standalone Node process
3. **City ID → region mapping**: Query city_coords to resolve citiesIds
4. **API route**: `/api/pre-alerts` endpoint
5. **Types**: Add PreAlert interface to types.ts
6. **Feed integration**: Show pre-alerts in FeedView with distinct styling
7. **Map integration**: Amber region overlay for active pre-alerts
8. **Analytics panel**: Lead time analysis
9. **Tests**: Unit tests for message classification and deduplication
10. **Systemd unit file**: For VPS deployment of ws-bridge

## Scope for this branch

**In scope (MVP):**
- DB schema
- WS bridge script (testable locally)
- API route
- Types
- Feed integration
- Tests for classification/dedup

**Deferred:**
- Map overlay (needs region polygon data we don't have yet)
- Lead time analytics panel (needs enough data to be meaningful)
- Systemd deployment (separate ops task)
- VPS setup
