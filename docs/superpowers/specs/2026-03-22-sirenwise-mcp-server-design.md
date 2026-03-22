# SirenWise MCP Server — Design Spec

**Date:** 2026-03-22
**Status:** Approved
**Project:** `/missile-analysis/mcp-server/`

## Purpose

A standalone MCP server that gives Poke (poke.com) conversational access to SirenWise alert analysis. Four tools surface contextual insights: how today compares to recent averages, nighttime sleep disruption, alert clustering patterns, and quiet-day streaks. Default scope is Modi'in Maccabim Reut.

## Architecture

```
Poke ──HTTPS──▶ Caddy (auto-TLS, rate-limited)
                  │
                  ▼ HTTP :8400
               FastMCP (uvicorn, stateless_http=True)
                  │
                  ▼ HTTPS (read-only token)
               Turso (alerts table)
```

- **Standalone Python service** deployed on Ben's VPS behind Caddy.
- **Colocated** with the SirenWise repo at `missile-analysis/mcp-server/` but independently deployable.
- **Stateless** — no local database, no session state. Every request queries Turso directly.
- **Analysis logic isolated** in `analysis.py` so a future proactive push layer (cron → Poke inbound SMS API) can reuse the same functions without importing FastMCP.

## Tools

All tools default to city `Modi'in Maccabim Reut` (Hebrew: `מודיעין-מכבים-רעות`). All timestamps use `Asia/Jerusalem` timezone. All return plain text formatted for conversational relay by Poke — no raw JSON.

### 1. `get_daily_context`

Compare today's alert activity against recent averages.

**Parameters:**
| Name | Type | Default | Description |
|------|------|---------|-------------|
| `city` | string (optional) | `מודיעין-מכבים-רעות` | City name (Hebrew) to filter by |
| `region_id` | string (optional) | None | Region ID; overrides city filter if provided |
| `nationwide` | boolean (optional) | false | If true, ignore city/region filters |

**Returns (plain text):**
- Today's alert count so far
- 7-day daily average
- 30-day daily average
- Percent deviation from each average
- Deviation label: "unusually quiet" (<50% of avg), "quiet" (50-80%), "typical" (80-120%), "elevated" (120-200%), "intense" (>200%)

**Query logic:**
1. Count alerts today where `cities` JSON array contains the target city
2. Count alerts in last 7 days, divide by 7
3. Count alerts in last 30 days, divide by 30
4. Compute percent deviation: `(today - avg) / avg * 100`
5. If today has 0 alerts and averages are also 0, return "no recent activity"

### 2. `get_sleep_impact`

Flag alerts that hit during night hours (22:00–06:00 Asia/Jerusalem).

**Parameters:**
| Name | Type | Default | Description |
|------|------|---------|-------------|
| `date` | string (optional) | Last night (yesterday 22:00 → today 06:00) | ISO date; queries that night's window |
| `city` | string (optional) | `מודיעין-מכבים-רעות` | City name (Hebrew) |
| `region_id` | string (optional) | None | Region ID override |
| `nationwide` | boolean (optional) | false | Ignore city/region filters |

**Returns (plain text):**
- Count of nighttime alerts
- Each alert with human-readable timestamp: "3:14 AM — Rocket alert in [cities]"
- Deep sleep flag (00:00–05:00) marked with emphasis
- Average nighttime alerts per night over the last 7 nights for comparison
- "No disruptions last night" if count is 0

**Query logic:**
1. Define night window: if `date` is today, use yesterday 22:00 → today 06:00. If `date` is a past date, use that date's 22:00 → next day 06:00.
2. Query alerts within the window where `cities` contains the target city
3. For each alert, format timestamp in 12-hour AM/PM with "wake-up call" language
4. Flag alerts between 00:00–05:00 as "deep sleep disruption"
5. Compute 7-night average for comparison

### 3. `get_clustering`

Detect whether alerts were isolated events or part of a barrage.

**Parameters:**
| Name | Type | Default | Description |
|------|------|---------|-------------|
| `date` | string (optional) | today | ISO date to analyze |
| `window_minutes` | integer (optional) | 5 | Max gap between alerts to consider them part of the same cluster |
| `city` | string (optional) | `מודיעין-מכבים-רעות` | City name (Hebrew) |
| `region_id` | string (optional) | None | Region ID override |
| `nationwide` | boolean (optional) | false | Ignore city/region filters |

**Returns (plain text):**
- List of clusters, each with: start time, end time, duration, alert count, cities involved
- Label per cluster: "isolated" (1 alert), "burst" (2–4 alerts), "barrage" (5+ alerts)
- Summary: total clusters, largest cluster details, isolated vs clustered ratio
- "No alerts on this date" if none found

**Query logic:**
1. Fetch all alerts for the date, sorted by timestamp ascending
2. Group into clusters: start a new cluster when the gap between consecutive alerts exceeds `window_minutes`
3. For each cluster, compute duration (last - first timestamp), count alerts, collect unique cities
4. Assign labels based on alert count thresholds
5. Compute summary statistics

### 4. `get_streak`

Calculate quiet-day streaks — how many days since the last alert.

**Parameters:**
| Name | Type | Default | Description |
|------|------|---------|-------------|
| `city` | string (optional) | `מודיעין-מכבים-רעות` | City name (Hebrew) |
| `region_id` | string (optional) | None | Region ID override |
| `nationwide` | boolean (optional) | false | Ignore city/region filters |

**Returns (plain text):**
- Current quiet streak in days (0 if there was an alert today)
- If today breaks a streak: "First alert in X days" with emphasis
- Last alert details: timestamp, cities, threat type label
- Longest quiet streak in the last 30 days for comparison
- "No alerts in the last 30 days" if applicable

**Query logic:**
1. Find the most recent alert where `cities` contains the target city
2. Compute calendar days between that alert and today (Asia/Jerusalem)
3. Check if today has any alerts — if yes and yesterday had none, flag as streak-breaker
4. Scan last 30 days day-by-day to find the longest consecutive gap
5. Map threat level integer to human-readable label (0=Rockets, 2=Infiltration, etc.)

## Data Access

### Turso Connection
- **URL:** Same Turso database as SirenWise (`missile-analysis-hummusonrails.aws-us-east-1.turso.io`)
- **Auth:** A separate read-only token (to be generated via Turso CLI: `turso db tokens create missile-analysis --read-only`)
- **Client:** `libsql_client` Python package (HTTP transport)

### Query Patterns
All tools query the `alerts` table:
```sql
SELECT id, timestamp, cities, threat, created_at
FROM alerts
WHERE timestamp >= ? AND timestamp < ?
ORDER BY timestamp ASC
```

City filtering is done in Python after fetching — the `cities` column is a JSON string array, and SQLite's JSON functions on Turso are limited. For the expected data volume (hundreds to low thousands of alerts per 30-day window), this is acceptable.

### City Matching
The `cities` column contains Hebrew city names as a JSON array. Matching Modi'in uses:
```python
json.loads(row["cities"])  # → ["מודיעין-מכבים-רעות", ...]
city in parsed_cities      # exact match
```

## Security

### Authentication
- **Bearer API key** on every request
- Validated in a FastMCP dependency that reads the `Authorization` header
- Key stored as `MCP_API_KEY` env var on the VPS
- Registered with Poke via `poke mcp add <url> -n "SirenWise" -k "<key>"`

```python
from fastmcp.server.dependencies import get_http_request

def require_auth():
    request = get_http_request()
    auth = request.headers.get("authorization", "")
    if not auth.startswith("Bearer "):
        raise ValueError("Missing or invalid Authorization header")
    token = auth.split("Bearer ", 1)[1].strip()
    if token != os.environ["MCP_API_KEY"]:
        raise ValueError("Invalid API key")
```

### Infrastructure
- **Caddy** handles TLS termination (Let's Encrypt auto-cert)
- **HTTP→HTTPS redirect** enforced by Caddy
- **Only port 443** open to the internet; FastMCP listens on `127.0.0.1:8400` (localhost only)
- **Rate limiting** via Caddy's `rate_limit` directive (e.g., 60 requests/minute per IP)

### Process Isolation
- **Systemd service** runs as dedicated user `sirenwise-mcp` with:
  - `NoNewPrivileges=true`
  - `ProtectSystem=strict`
  - `ProtectHome=read-only`
  - `PrivateTmp=true`
  - No login shell (`/usr/sbin/nologin`)
- Environment file at `/etc/sirenwise-mcp/env` with `0600` permissions, owned by root

### Data Sensitivity
- Alert data is sourced from the public Pikud HaOref API — not sensitive
- The MCP server handles no PII, no private keys, no user credentials
- Worst case of full server compromise: attacker can read public alert history and knows your API key (rotate it)

## Project Structure

```
missile-analysis/mcp-server/
├── server.py              # FastMCP app definition, tool registration, auth dependency
├── analysis.py            # Pure analysis functions (no FastMCP imports)
├── db.py                  # Turso read-only client (async httpx)
├── config.py              # Constants: default city, night hours, cluster window, threat labels
├── requirements.txt       # fastmcp>=2.12.0, uvicorn>=0.35.0, libsql-client>=0.3.0, python-dotenv>=1.0.0
├── .env.example           # MCP_API_KEY=, TURSO_DB_URL=, TURSO_READ_TOKEN=
├── Caddyfile              # Reverse proxy config
├── sirenwise-mcp.service  # Systemd unit file
└── README.md              # Setup, deployment, and Poke registration instructions
```

### Module Responsibilities

**`config.py`** — Constants only, no logic:
- `DEFAULT_CITY = "מודיעין-מכבים-רעות"`
- `NIGHT_START = 22`, `NIGHT_END = 6`
- `DEEP_SLEEP_START = 0`, `DEEP_SLEEP_END = 5`
- `DEFAULT_CLUSTER_WINDOW_MINUTES = 5`
- `TIMEZONE = "Asia/Jerusalem"`
- `THREAT_LABELS = {0: "Rockets/Missiles", 1: "Unknown", 2: "Infiltration", ...}`

**`db.py`** — Single async function to query alerts:
- `async def fetch_alerts(start_ts, end_ts) -> list[dict]` — returns all alerts in the time range
- Handles Turso HTTP connection with read-only token
- Parses `cities` JSON column into Python lists

**`analysis.py`** — Pure functions, no I/O, no framework dependencies:
- `def compute_daily_context(alerts, city, today) -> str`
- `def compute_sleep_impact(alerts, city, night_date) -> str`
- `def compute_clustering(alerts, city, date, window_minutes) -> str`
- `def compute_streak(alerts, city, today) -> str`
- Each takes a list of alert dicts and returns formatted plain text

**`server.py`** — Thin wiring layer:
- Creates FastMCP app with auth dependency
- Defines 4 `@mcp.tool` functions that call `db.fetch_alerts()` then `analysis.compute_*()`
- Runs with `mcp.run(transport="http", host="127.0.0.1", port=8400, stateless_http=True)`

## Deployment

### Caddyfile
```
sirenwise-mcp.yourdomain.com {
    rate_limit {
        zone mcp_zone {
            key {remote_host}
            events 60
            window 1m
        }
    }
    reverse_proxy 127.0.0.1:8400
}
```

(Domain TBD — Ben to provide the subdomain he wants to use.)

### Systemd Unit
```ini
[Unit]
Description=SirenWise MCP Server
After=network.target

[Service]
Type=simple
User=sirenwise-mcp
Group=sirenwise-mcp
WorkingDirectory=/opt/sirenwise-mcp
ExecStart=/opt/sirenwise-mcp/venv/bin/uvicorn server:app --host 127.0.0.1 --port 8400
EnvironmentFile=/etc/sirenwise-mcp/env
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=read-only
PrivateTmp=true
ReadWritePaths=/opt/sirenwise-mcp

[Install]
WantedBy=multi-user.target
```

### Deployment Steps
1. Create `sirenwise-mcp` user on VPS
2. Clone repo, copy `mcp-server/` to `/opt/sirenwise-mcp/`
3. Create virtualenv, install requirements
4. Generate Turso read-only token
5. Create `/etc/sirenwise-mcp/env` with secrets
6. Install and enable systemd service
7. Add Caddyfile entry, reload Caddy
8. Register with Poke: `poke mcp add https://sirenwise-mcp.domain.com/mcp -n "SirenWise" -k "<key>"`

## Future: Proactive Push Layer

Not in scope for this build, but the design enables it. A future addition would be:

```
cron (every 5 min) → analysis.py → conditional check → Poke inbound SMS API
```

Trigger conditions (examples):
- First alert after a quiet streak > 3 days
- Nighttime alert (immediate push)
- Alert rate exceeds 200% of 7-day average
- Barrage detected (5+ alerts in 5 minutes)

The analysis functions in `analysis.py` return structured data before formatting to text, making it straightforward to add threshold checks without duplicating logic.
