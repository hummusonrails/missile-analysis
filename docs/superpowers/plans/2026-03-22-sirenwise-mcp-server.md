# SirenWise MCP Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Python FastMCP server that gives Poke conversational access to SirenWise alert analysis (daily context, sleep impact, clustering, streaks), deployed on the Contabo VPS behind Caddy.

**Architecture:** Standalone Python service at `missile-analysis/mcp-server/`. Four MCP tools query Turso via httpx (read-only), analyze alerts in pure Python functions, and return plain text. Deployed as a systemd service behind Caddy with auto-TLS on `*.hummusonrails.com`.

**Tech Stack:** Python 3.11+, FastMCP 2.12+, httpx, uvicorn, Turso HTTP API, Caddy, systemd

**Spec:** `docs/superpowers/specs/2026-03-22-sirenwise-mcp-server-design.md`

**VPS tooling:** The `contabo` CLI manages services, Caddy, env vars, and deployment. Existing services use ports 3800-3806 and 18789 (Jeeves). This server uses port **3810** (leaving 3810-3809 free for other MCP servers on Jeeves).

**Spec deviations:** Port changed from spec's 8400 to 3810 to match VPS port scheme. Rate limiting dropped (caddy-ratelimit plugin not installed; acceptable for low-traffic service).

---

### Task 1: Project scaffold and config

**Files:**
- Create: `mcp-server/config.py`
- Create: `mcp-server/requirements.txt`
- Create: `mcp-server/.env.example`

- [ ] **Step 1: Create the mcp-server directory**

```bash
mkdir -p /Users/bengreenberg/Dev/personal/missile-analysis/mcp-server
```

- [ ] **Step 2: Write config.py**

```python
# mcp-server/config.py
"""Constants for SirenWise MCP server."""

DEFAULT_CITY = "מודיעין-מכבים-רעות"

NIGHT_START = 22  # 10 PM
NIGHT_END = 6     # 6 AM
DEEP_SLEEP_START = 0   # midnight
DEEP_SLEEP_END = 5     # 5 AM

DEFAULT_CLUSTER_WINDOW_MINUTES = 5

TIMEZONE = "Asia/Jerusalem"

THREAT_LABELS = {
    0: "Rockets/Missiles",
    1: "Unknown",
    2: "Infiltration/Terror",
    3: "Earthquake",
    4: "Tsunami",
    5: "Hostile Aircraft",
    6: "Hazardous Materials",
    7: "Unconventional Weapon",
    8: "Nuclear Threat",
    13: "Hostile Fire",
}
THREAT_LABEL_DEFAULT = "Unknown Threat"
```

- [ ] **Step 3: Write requirements.txt**

```
fastmcp>=2.12.0
uvicorn>=0.35.0
httpx>=0.27.0
python-dotenv>=1.0.0
starlette>=0.40.0
pytest>=8.0.0
pytest-asyncio>=0.24.0
```

- [ ] **Step 4: Write .env.example**

```
MCP_API_KEY=your-secret-api-key-here
TURSO_DB_URL=https://missile-analysis-hummusonrails.aws-us-east-1.turso.io
TURSO_READ_TOKEN=your-turso-read-only-token
```

- [ ] **Step 5: Commit**

```bash
cd /Users/bengreenberg/Dev/personal/missile-analysis
git add mcp-server/config.py mcp-server/requirements.txt mcp-server/.env.example
git commit -m "feat(mcp): scaffold project with config and dependencies"
```

---

### Task 2: Turso database client

**Files:**
- Create: `mcp-server/db.py`
- Create: `mcp-server/tests/test_db.py`

- [ ] **Step 1: Write the failing test for fetch_alerts**

```python
# mcp-server/tests/__init__.py
# (empty)
```

```python
# mcp-server/tests/test_db.py
"""Tests for Turso database client."""
import json
import pytest
from unittest.mock import AsyncMock, patch

from db import parse_alert_row, parse_turso_response


def test_parse_alert_row_valid():
    row = {
        "id": "123_1700000000000",
        "timestamp": 1700000000000,
        "cities": '["מודיעין-מכבים-רעות", "תל אביב"]',
        "threat": 0,
        "created_at": 1700000000000,
    }
    result = parse_alert_row(row)
    assert result is not None
    assert result["cities"] == ["מודיעין-מכבים-רעות", "תל אביב"]
    assert result["timestamp"] == 1700000000000
    assert result["threat"] == 0


def test_parse_alert_row_malformed_json():
    row = {
        "id": "123_1700000000000",
        "timestamp": 1700000000000,
        "cities": "not valid json",
        "threat": 0,
        "created_at": 1700000000000,
    }
    result = parse_alert_row(row)
    assert result is None


def test_parse_alert_row_none_cities():
    row = {
        "id": "123_1700000000000",
        "timestamp": 1700000000000,
        "cities": None,
        "threat": 0,
        "created_at": 1700000000000,
    }
    result = parse_alert_row(row)
    assert result is None


def test_parse_turso_response_extracts_rows():
    response_json = {
        "results": [
            {
                "response": {
                    "type": "execute",
                    "result": {
                        "cols": [
                            {"name": "id"},
                            {"name": "timestamp"},
                            {"name": "cities"},
                            {"name": "threat"},
                            {"name": "created_at"},
                        ],
                        "rows": [
                            [
                                {"type": "text", "value": "1_1700000000000"},
                                {"type": "integer", "value": "1700000000000"},
                                {"type": "text", "value": '["מודיעין-מכבים-רעות"]'},
                                {"type": "integer", "value": "0"},
                                {"type": "integer", "value": "1700000000000"},
                            ]
                        ],
                    },
                }
            }
        ]
    }
    rows = parse_turso_response(response_json)
    assert len(rows) == 1
    assert rows[0]["id"] == "1_1700000000000"
    assert rows[0]["timestamp"] == 1700000000000
    assert rows[0]["cities"] == '["מודיעין-מכבים-רעות"]'


def test_parse_turso_response_empty():
    response_json = {
        "results": [
            {
                "response": {
                    "type": "execute",
                    "result": {
                        "cols": [
                            {"name": "id"},
                            {"name": "timestamp"},
                            {"name": "cities"},
                            {"name": "threat"},
                            {"name": "created_at"},
                        ],
                        "rows": [],
                    },
                }
            }
        ]
    }
    rows = parse_turso_response(response_json)
    assert len(rows) == 0
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/bengreenberg/Dev/personal/missile-analysis/mcp-server
python -m pytest tests/test_db.py -v
```
Expected: FAIL — `db` module not found

- [ ] **Step 3: Write db.py**

```python
# mcp-server/db.py
"""Turso database client using HTTP API via httpx."""
import json
import logging
import os
from functools import lru_cache

import httpx

logger = logging.getLogger(__name__)

_region_cache: dict[str, list[str]] = {}


def _get_turso_url() -> str:
    url = os.environ["TURSO_DB_URL"].strip()
    return url.replace("libsql://", "https://")


def _get_turso_token() -> str:
    return os.environ["TURSO_READ_TOKEN"].strip()


def parse_turso_response(data: dict) -> list[dict]:
    """Parse Turso HTTP API response into list of row dicts."""
    rows = []
    for result in data.get("results", []):
        resp = result.get("response", {})
        res = resp.get("result", {})
        cols = [c["name"] for c in res.get("cols", [])]
        for row in res.get("rows", []):
            values = []
            for cell in row:
                if cell.get("type") == "integer":
                    values.append(int(cell["value"]))
                elif cell.get("type") == "float":
                    values.append(float(cell["value"]))
                elif cell.get("type") == "null":
                    values.append(None)
                else:
                    values.append(cell.get("value"))
            rows.append(dict(zip(cols, values)))
    return rows


def parse_alert_row(row: dict) -> dict | None:
    """Parse a raw alert row, converting cities JSON. Returns None if malformed."""
    try:
        parsed = json.loads(row["cities"])
    except (json.JSONDecodeError, TypeError):
        logger.warning("Malformed cities JSON in alert %s", row.get("id"))
        return None
    return {**row, "cities": parsed}


async def _execute(statements: list[dict]) -> dict:
    """Execute statements against Turso HTTP API."""
    url = f"{_get_turso_url()}/v2/pipeline"
    headers = {
        "Authorization": f"Bearer {_get_turso_token()}",
        "Content-Type": "application/json",
    }
    body = {"requests": [{"type": "execute", "stmt": s} for s in statements]}

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(url, json=body, headers=headers)
        resp.raise_for_status()
        return resp.json()


async def fetch_alerts(start_ts: int, end_ts: int) -> list[dict]:
    """Fetch alerts in a timestamp range. Returns parsed rows with cities as lists."""
    stmt = {
        "sql": "SELECT id, timestamp, cities, threat, created_at FROM alerts WHERE timestamp >= ? AND timestamp < ? ORDER BY timestamp ASC",
        "args": [{"type": "integer", "value": str(start_ts)}, {"type": "integer", "value": str(end_ts)}],
    }
    data = await _execute([stmt])
    raw_rows = parse_turso_response(data)
    results = []
    for row in raw_rows:
        parsed = parse_alert_row(row)
        if parsed is not None:
            results.append(parsed)
    return results


async def fetch_cities_for_region(region_id: str) -> list[str]:
    """Fetch all city names in a region. Cached in-memory after first call."""
    if region_id in _region_cache:
        return _region_cache[region_id]

    stmt = {
        "sql": "SELECT city_name FROM city_coords WHERE region_id = ?",
        "args": [{"type": "text", "value": region_id}],
    }
    data = await _execute([stmt])
    rows = parse_turso_response(data)
    cities = [r["city_name"] for r in rows]
    _region_cache[region_id] = cities
    return cities
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/bengreenberg/Dev/personal/missile-analysis/mcp-server
python -m pytest tests/test_db.py -v
```
Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/bengreenberg/Dev/personal/missile-analysis
git add mcp-server/db.py mcp-server/tests/
git commit -m "feat(mcp): add Turso HTTP API client with parsing and caching"
```

---

### Task 3: Analysis — compute_daily_context

**Files:**
- Create: `mcp-server/analysis.py`
- Create: `mcp-server/tests/test_analysis.py`

- [ ] **Step 1: Write the failing test**

```python
# mcp-server/tests/test_analysis.py
"""Tests for analysis functions."""
from datetime import date

from analysis import compute_daily_context, filter_alerts_by_city


def _make_alert(ts: int, cities: list[str], threat: int = 0) -> dict:
    return {
        "id": f"1_{ts}",
        "timestamp": ts,
        "cities": cities,
        "threat": threat,
        "created_at": ts,
    }


# --- filter_alerts_by_city ---

def test_filter_by_single_city():
    alerts = [
        _make_alert(1000, ["מודיעין-מכבים-רעות", "תל אביב"]),
        _make_alert(2000, ["תל אביב"]),
        _make_alert(3000, ["מודיעין-מכבים-רעות"]),
    ]
    result = filter_alerts_by_city(alerts, "מודיעין-מכבים-רעות")
    assert len(result) == 2


def test_filter_by_city_list():
    alerts = [
        _make_alert(1000, ["מודיעין-מכבים-רעות"]),
        _make_alert(2000, ["תל אביב"]),
        _make_alert(3000, ["חיפה"]),
    ]
    result = filter_alerts_by_city(alerts, ["מודיעין-מכבים-רעות", "תל אביב"])
    assert len(result) == 2


def test_filter_nationwide():
    alerts = [
        _make_alert(1000, ["מודיעין-מכבים-רעות"]),
        _make_alert(2000, ["תל אביב"]),
    ]
    result = filter_alerts_by_city(alerts, None)
    assert len(result) == 2


# --- compute_daily_context ---

def test_daily_context_no_activity():
    result = compute_daily_context([], "מודיעין-מכבים-רעות", date(2026, 3, 22))
    assert "no recent activity" in result.lower()


def test_daily_context_elevated():
    # 30 days of data: 1 alert per day for 30 days = avg 1/day
    # Today has 3 alerts = elevated (200-300% of avg)
    from config import TIMEZONE
    from datetime import datetime
    import zoneinfo

    tz = zoneinfo.ZoneInfo(TIMEZONE)
    today = date(2026, 3, 22)

    alerts = []
    # 3 alerts today
    for i in range(3):
        dt = datetime(2026, 3, 22, 10 + i, 0, tzinfo=tz)
        alerts.append(_make_alert(int(dt.timestamp() * 1000), ["מודיעין-מכבים-רעות"]))
    # 1 alert per day for 29 previous days
    for d in range(1, 30):
        dt = datetime(2026, 3, 22 - d if 22 - d > 0 else 1, 12, 0, tzinfo=tz)
        # Use proper date math
        from datetime import timedelta
        day_dt = datetime(2026, 3, 22, 12, 0, tzinfo=tz) - timedelta(days=d)
        alerts.append(_make_alert(int(day_dt.timestamp() * 1000), ["מודיעין-מכבים-רעות"]))

    result = compute_daily_context(alerts, "מודיעין-מכבים-רעות", today)
    assert "elevated" in result.lower() or "intense" in result.lower()
    assert "3" in result  # today's count
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/bengreenberg/Dev/personal/missile-analysis/mcp-server
python -m pytest tests/test_analysis.py -v
```
Expected: FAIL — `analysis` module not found

- [ ] **Step 3: Write analysis.py with filter_alerts_by_city and compute_daily_context**

```python
# mcp-server/analysis.py
"""Pure analysis functions for SirenWise alert data.

No I/O, no framework imports. Each function takes pre-fetched alert data
and returns formatted plain text for Poke to relay conversationally.
"""
from datetime import date, datetime, timedelta
import zoneinfo

from config import (
    DEFAULT_CITY,
    TIMEZONE,
    THREAT_LABELS,
    THREAT_LABEL_DEFAULT,
)

_tz = zoneinfo.ZoneInfo(TIMEZONE)


def filter_alerts_by_city(
    alerts: list[dict], cities_filter: str | list[str] | None
) -> list[dict]:
    """Filter alerts by city/cities. None means no filter (nationwide)."""
    if cities_filter is None:
        return alerts
    if isinstance(cities_filter, str):
        return [a for a in alerts if cities_filter in a["cities"]]
    # list of cities
    city_set = set(cities_filter)
    return [a for a in alerts if city_set.intersection(a["cities"])]


def _ts_to_israel(ts_ms: int) -> datetime:
    """Convert unix ms timestamp to Israel datetime."""
    return datetime.fromtimestamp(ts_ms / 1000, tz=_tz)


def _date_start_ts(d: date) -> int:
    """Start of day in Israel time as unix ms."""
    dt = datetime(d.year, d.month, d.day, tzinfo=_tz)
    return int(dt.timestamp() * 1000)


def _deviation_label(today: int, avg: float) -> str:
    if avg == 0:
        return "elevated" if today > 0 else "unusually quiet"
    ratio = today / avg
    if ratio < 0.5:
        return "unusually quiet"
    elif ratio < 0.8:
        return "quiet"
    elif ratio <= 1.2:
        return "typical"
    elif ratio <= 2.0:
        return "elevated"
    else:
        return "intense"


def compute_daily_context(
    alerts: list[dict], cities_filter: str | list[str] | None, today: date
) -> str:
    """Compare today's alert count against 7-day and 30-day averages."""
    filtered = filter_alerts_by_city(alerts, cities_filter)

    today_start = _date_start_ts(today)
    tomorrow_start = _date_start_ts(today + timedelta(days=1))
    week_start = _date_start_ts(today - timedelta(days=7))
    month_start = _date_start_ts(today - timedelta(days=30))

    today_alerts = [a for a in filtered if today_start <= a["timestamp"] < tomorrow_start]
    week_alerts = [a for a in filtered if week_start <= a["timestamp"] < today_start]
    month_alerts = [a for a in filtered if month_start <= a["timestamp"] < today_start]

    today_count = len(today_alerts)
    week_avg = len(week_alerts) / 7
    month_avg = len(month_alerts) / 30

    if today_count == 0 and week_avg == 0 and month_avg == 0:
        scope = cities_filter if isinstance(cities_filter, str) else "your area"
        return f"No recent activity for {scope}."

    label = _deviation_label(today_count, week_avg)

    lines = [f"Today so far: {today_count} alert{'s' if today_count != 1 else ''}"]
    lines.append(f"7-day average: {week_avg:.1f}/day")
    lines.append(f"30-day average: {month_avg:.1f}/day")

    if week_avg > 0:
        pct_week = ((today_count - week_avg) / week_avg) * 100
        direction = "above" if pct_week > 0 else "below"
        lines.append(f"vs 7-day avg: {abs(pct_week):.0f}% {direction}")

    if month_avg > 0:
        pct_month = ((today_count - month_avg) / month_avg) * 100
        direction = "above" if pct_month > 0 else "below"
        lines.append(f"vs 30-day avg: {abs(pct_month):.0f}% {direction}")

    lines.append(f"Assessment: {label}")

    return "\n".join(lines)
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/bengreenberg/Dev/personal/missile-analysis/mcp-server
python -m pytest tests/test_analysis.py -v
```
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/bengreenberg/Dev/personal/missile-analysis
git add mcp-server/analysis.py mcp-server/tests/test_analysis.py
git commit -m "feat(mcp): add filter_alerts_by_city and compute_daily_context"
```

---

### Task 4: Analysis — compute_sleep_impact

**Files:**
- Modify: `mcp-server/analysis.py`
- Modify: `mcp-server/tests/test_analysis.py`

- [ ] **Step 1: Write the failing test**

Append to `tests/test_analysis.py`:

```python
from analysis import compute_sleep_impact


def test_sleep_impact_no_disruptions():
    result = compute_sleep_impact([], "מודיעין-מכבים-רעות", date(2026, 3, 22))
    assert "no disruptions" in result.lower()


def test_sleep_impact_deep_sleep():
    import zoneinfo
    tz = zoneinfo.ZoneInfo("Asia/Jerusalem")
    # Alert at 3:14 AM
    dt = datetime(2026, 3, 22, 3, 14, tzinfo=tz)
    alerts = [_make_alert(int(dt.timestamp() * 1000), ["מודיעין-מכבים-רעות"])]
    result = compute_sleep_impact(alerts, "מודיעין-מכבים-רעות", date(2026, 3, 22))
    assert "3:14 AM" in result
    assert "deep sleep" in result.lower()


def test_sleep_impact_evening_alert():
    import zoneinfo
    tz = zoneinfo.ZoneInfo("Asia/Jerusalem")
    # Alert at 11:30 PM (previous night)
    dt = datetime(2026, 3, 21, 23, 30, tzinfo=tz)
    alerts = [_make_alert(int(dt.timestamp() * 1000), ["מודיעין-מכבים-רעות"])]
    result = compute_sleep_impact(alerts, "מודיעין-מכבים-רעות", date(2026, 3, 22))
    assert "11:30 PM" in result
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/bengreenberg/Dev/personal/missile-analysis/mcp-server
python -m pytest tests/test_analysis.py::test_sleep_impact_no_disruptions -v
```
Expected: FAIL — `compute_sleep_impact` not found

- [ ] **Step 3: Add compute_sleep_impact to analysis.py**

```python
def compute_sleep_impact(
    alerts: list[dict], cities_filter: str | list[str] | None, night_date: date
) -> str:
    """Flag alerts during night hours (22:00-06:00 Israel time)."""
    from config import NIGHT_START, NIGHT_END, DEEP_SLEEP_START, DEEP_SLEEP_END

    # Night window: previous day 22:00 -> this day 06:00
    night_start_dt = datetime(night_date.year, night_date.month, night_date.day, NIGHT_START, 0, tzinfo=_tz) - timedelta(days=1)
    night_end_dt = datetime(night_date.year, night_date.month, night_date.day, NIGHT_END, 0, tzinfo=_tz)

    night_start_ts = int(night_start_dt.timestamp() * 1000)
    night_end_ts = int(night_end_dt.timestamp() * 1000)

    night_alerts = [a for a in alerts if night_start_ts <= a["timestamp"] < night_end_ts]
    filtered = filter_alerts_by_city(night_alerts, cities_filter)

    if not filtered:
        return "No disruptions last night."

    lines = [f"{len(filtered)} alert{'s' if len(filtered) != 1 else ''} during night hours:"]

    for alert in filtered:
        dt = _ts_to_israel(alert["timestamp"])
        time_str = dt.strftime("%-I:%M %p")
        hour = dt.hour
        threat_label = THREAT_LABELS.get(alert["threat"], THREAT_LABEL_DEFAULT)
        cities_str = ", ".join(alert["cities"][:3])
        if len(alert["cities"]) > 3:
            cities_str += f" +{len(alert['cities']) - 3} more"

        is_deep = DEEP_SLEEP_START <= hour < DEEP_SLEEP_END
        prefix = "** DEEP SLEEP ** " if is_deep else ""
        lines.append(f"  {prefix}{time_str} — {threat_label} in {cities_str}")

    # 7-night average
    week_nights = []
    for d in range(1, 8):
        nd = night_date - timedelta(days=d)
        ns_dt = datetime(nd.year, nd.month, nd.day, NIGHT_END, 0, tzinfo=_tz) - timedelta(hours=24 - NIGHT_START + NIGHT_END)
        ne_dt = datetime(nd.year, nd.month, nd.day, NIGHT_END, 0, tzinfo=_tz)
        ns_ts = int(ns_dt.timestamp() * 1000)
        ne_ts = int(ne_dt.timestamp() * 1000)
        night_count = len(filter_alerts_by_city(
            [a for a in alerts if ns_ts <= a["timestamp"] < ne_ts],
            cities_filter,
        ))
        week_nights.append(night_count)

    avg_night = sum(week_nights) / 7
    lines.append(f"\n7-night average: {avg_night:.1f} alerts/night")

    return "\n".join(lines)
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/bengreenberg/Dev/personal/missile-analysis/mcp-server
python -m pytest tests/test_analysis.py -v -k "sleep"
```
Expected: All 3 sleep tests PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/bengreenberg/Dev/personal/missile-analysis
git add mcp-server/analysis.py mcp-server/tests/test_analysis.py
git commit -m "feat(mcp): add compute_sleep_impact with deep sleep flagging"
```

---

### Task 5: Analysis — compute_clustering

**Files:**
- Modify: `mcp-server/analysis.py`
- Modify: `mcp-server/tests/test_analysis.py`

- [ ] **Step 1: Write the failing test**

Append to `tests/test_analysis.py`:

```python
from analysis import compute_clustering


def test_clustering_no_alerts():
    result = compute_clustering([], "מודיעין-מכבים-רעות", date(2026, 3, 22), 5)
    assert "no alerts" in result.lower()


def test_clustering_isolated():
    import zoneinfo
    tz = zoneinfo.ZoneInfo("Asia/Jerusalem")
    # Single alert
    dt = datetime(2026, 3, 22, 10, 0, tzinfo=tz)
    alerts = [_make_alert(int(dt.timestamp() * 1000), ["מודיעין-מכבים-רעות"])]
    result = compute_clustering(alerts, "מודיעין-מכבים-רעות", date(2026, 3, 22), 5)
    assert "isolated" in result.lower()


def test_clustering_barrage():
    import zoneinfo
    tz = zoneinfo.ZoneInfo("Asia/Jerusalem")
    # 6 alerts within 5 minutes = barrage
    alerts = []
    base = datetime(2026, 3, 22, 14, 0, tzinfo=tz)
    for i in range(6):
        dt = base + timedelta(minutes=i)
        alerts.append(_make_alert(int(dt.timestamp() * 1000), ["מודיעין-מכבים-רעות"]))
    result = compute_clustering(alerts, "מודיעין-מכבים-רעות", date(2026, 3, 22), 5)
    assert "barrage" in result.lower()


def test_clustering_filters_by_city():
    import zoneinfo
    tz = zoneinfo.ZoneInfo("Asia/Jerusalem")
    # Barrage hitting Tel Aviv only — should be excluded for Modi'in
    base = datetime(2026, 3, 22, 14, 0, tzinfo=tz)
    alerts = []
    for i in range(6):
        dt = base + timedelta(minutes=i)
        alerts.append(_make_alert(int(dt.timestamp() * 1000), ["תל אביב"]))
    result = compute_clustering(alerts, "מודיעין-מכבים-רעות", date(2026, 3, 22), 5)
    assert "no alerts" in result.lower()


def test_clustering_includes_multi_city_barrage():
    import zoneinfo
    tz = zoneinfo.ZoneInfo("Asia/Jerusalem")
    # Barrage hitting multiple cities including Modi'in
    base = datetime(2026, 3, 22, 14, 0, tzinfo=tz)
    alerts = []
    for i in range(6):
        dt = base + timedelta(minutes=i)
        cities = ["תל אביב"] if i % 2 == 0 else ["מודיעין-מכבים-רעות"]
        alerts.append(_make_alert(int(dt.timestamp() * 1000), cities))
    result = compute_clustering(alerts, "מודיעין-מכבים-רעות", date(2026, 3, 22), 5)
    assert "barrage" in result.lower()
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/bengreenberg/Dev/personal/missile-analysis/mcp-server
python -m pytest tests/test_analysis.py -v -k "clustering"
```
Expected: FAIL

- [ ] **Step 3: Add compute_clustering to analysis.py**

```python
def compute_clustering(
    alerts: list[dict],
    cities_filter: str | list[str] | None,
    target_date: date,
    window_minutes: int = 5,
) -> str:
    """Detect isolated alerts vs barrages by clustering within a time window.

    Clusters ALL alerts by time first, then filters clusters that include
    the target city. This preserves multi-city barrage context.
    """
    from config import DEFAULT_CLUSTER_WINDOW_MINUTES

    day_start = _date_start_ts(target_date)
    day_end = _date_start_ts(target_date + timedelta(days=1))
    day_alerts = [a for a in alerts if day_start <= a["timestamp"] < day_end]
    day_alerts.sort(key=lambda a: a["timestamp"])

    if not day_alerts:
        return f"No alerts on {target_date.isoformat()}."

    # Step 1: cluster ALL alerts by time
    window_ms = window_minutes * 60 * 1000
    clusters: list[list[dict]] = []
    current_cluster: list[dict] = [day_alerts[0]]

    for alert in day_alerts[1:]:
        if alert["timestamp"] - current_cluster[-1]["timestamp"] <= window_ms:
            current_cluster.append(alert)
        else:
            clusters.append(current_cluster)
            current_cluster = [alert]
    clusters.append(current_cluster)

    # Step 2: filter clusters that include the target city
    def cluster_matches(cluster: list[dict]) -> bool:
        if cities_filter is None:
            return True
        for a in cluster:
            if isinstance(cities_filter, str):
                if cities_filter in a["cities"]:
                    return True
            else:
                if set(cities_filter).intersection(a["cities"]):
                    return True
        return False

    relevant = [c for c in clusters if cluster_matches(c)]

    if not relevant:
        return f"No alerts on {target_date.isoformat()}."

    # Step 3: format
    lines = []
    largest = max(relevant, key=len)

    for cluster in relevant:
        count = len(cluster)
        start_dt = _ts_to_israel(cluster[0]["timestamp"])
        end_dt = _ts_to_israel(cluster[-1]["timestamp"])
        all_cities = set()
        for a in cluster:
            all_cities.update(a["cities"])

        if count == 1:
            label = "isolated"
        elif count <= 4:
            label = "burst"
        else:
            label = "barrage"

        if count == 1:
            lines.append(f"  {start_dt.strftime('%-I:%M %p')} — {label} (1 alert, {', '.join(list(all_cities)[:3])})")
        else:
            duration_min = (cluster[-1]["timestamp"] - cluster[0]["timestamp"]) / 60000
            lines.append(
                f"  {start_dt.strftime('%-I:%M %p')}–{end_dt.strftime('%-I:%M %p')} — "
                f"{label} ({count} alerts over {duration_min:.0f} min, "
                f"{', '.join(list(all_cities)[:3])}{'...' if len(all_cities) > 3 else ''})"
            )

    # Summary
    isolated = sum(1 for c in relevant if len(c) == 1)
    clustered = len(relevant) - isolated
    header = f"{len(relevant)} cluster{'s' if len(relevant) != 1 else ''} on {target_date.isoformat()}:"
    summary = f"\n{isolated} isolated, {clustered} clustered. Largest: {len(largest)} alerts."

    return header + "\n" + "\n".join(lines) + summary
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/bengreenberg/Dev/personal/missile-analysis/mcp-server
python -m pytest tests/test_analysis.py -v -k "clustering"
```
Expected: All 5 clustering tests PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/bengreenberg/Dev/personal/missile-analysis
git add mcp-server/analysis.py mcp-server/tests/test_analysis.py
git commit -m "feat(mcp): add compute_clustering with cluster-first-then-filter"
```

---

### Task 6: Analysis — compute_streak

**Files:**
- Modify: `mcp-server/analysis.py`
- Modify: `mcp-server/tests/test_analysis.py`

- [ ] **Step 1: Write the failing test**

Append to `tests/test_analysis.py`:

```python
from analysis import compute_streak


def test_streak_no_alerts():
    result = compute_streak([], "מודיעין-מכבים-רעות", date(2026, 3, 22))
    assert "no alerts in the last 30 days" in result.lower()


def test_streak_today_breaks_streak():
    import zoneinfo
    tz = zoneinfo.ZoneInfo("Asia/Jerusalem")
    # Last alert was 5 days ago, one today
    today_dt = datetime(2026, 3, 22, 10, 0, tzinfo=tz)
    old_dt = datetime(2026, 3, 17, 12, 0, tzinfo=tz)
    alerts = [
        _make_alert(int(old_dt.timestamp() * 1000), ["מודיעין-מכבים-רעות"]),
        _make_alert(int(today_dt.timestamp() * 1000), ["מודיעין-מכבים-רעות"]),
    ]
    result = compute_streak(alerts, "מודיעין-מכבים-רעות", date(2026, 3, 22))
    assert "first alert in" in result.lower()


def test_streak_ongoing_quiet():
    import zoneinfo
    tz = zoneinfo.ZoneInfo("Asia/Jerusalem")
    # Last alert was 10 days ago, none today
    old_dt = datetime(2026, 3, 12, 12, 0, tzinfo=tz)
    alerts = [
        _make_alert(int(old_dt.timestamp() * 1000), ["מודיעין-מכבים-רעות"]),
    ]
    result = compute_streak(alerts, "מודיעין-מכבים-רעות", date(2026, 3, 22))
    assert "10" in result  # 10 days quiet
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/bengreenberg/Dev/personal/missile-analysis/mcp-server
python -m pytest tests/test_analysis.py -v -k "streak"
```
Expected: FAIL

- [ ] **Step 3: Add compute_streak to analysis.py**

```python
def compute_streak(
    alerts: list[dict], cities_filter: str | list[str] | None, today: date
) -> str:
    """Calculate quiet-day streaks — days since the last alert."""
    filtered = filter_alerts_by_city(alerts, cities_filter)

    if not filtered:
        if cities_filter is None:
            return "Nationwide alerts are continuous — consider filtering by city for meaningful streak data."
        return "No alerts in the last 30 days."

    today_start = _date_start_ts(today)
    tomorrow_start = _date_start_ts(today + timedelta(days=1))

    # Most recent alert
    most_recent = max(filtered, key=lambda a: a["timestamp"])
    most_recent_dt = _ts_to_israel(most_recent["timestamp"])
    most_recent_date = most_recent_dt.date()

    today_alerts = [a for a in filtered if today_start <= a["timestamp"] < tomorrow_start]
    has_alert_today = len(today_alerts) > 0

    if has_alert_today:
        # Find previous alert before today
        before_today = [a for a in filtered if a["timestamp"] < today_start]
        if before_today:
            prev = max(before_today, key=lambda a: a["timestamp"])
            prev_date = _ts_to_israel(prev["timestamp"]).date()
            gap = (today - prev_date).days
            streak_broke = gap > 1
        else:
            gap = 0
            streak_broke = False
    else:
        gap = (today - most_recent_date).days
        streak_broke = False

    # Build output
    lines = []

    if has_alert_today and streak_broke:
        lines.append(f"*** First alert in {gap} days ***")
    elif has_alert_today:
        lines.append(f"Alert activity today ({len(today_alerts)} alert{'s' if len(today_alerts) != 1 else ''}).")
    else:
        lines.append(f"Quiet streak: {gap} day{'s' if gap != 1 else ''} since last alert.")

    # Last alert details
    threat_label = THREAT_LABELS.get(most_recent["threat"], THREAT_LABEL_DEFAULT)
    time_str = most_recent_dt.strftime("%b %d at %-I:%M %p")
    cities_str = ", ".join(most_recent["cities"][:3])
    lines.append(f"Last alert: {time_str} — {threat_label} in {cities_str}")

    # Longest streak in 30 days
    month_start = today - timedelta(days=30)
    days_with_alerts = set()
    for a in filtered:
        ad = _ts_to_israel(a["timestamp"]).date()
        if month_start <= ad <= today:
            days_with_alerts.add(ad)

    longest_streak = 0
    current_streak = 0
    for d_offset in range(31):
        d = month_start + timedelta(days=d_offset)
        if d not in days_with_alerts:
            current_streak += 1
            longest_streak = max(longest_streak, current_streak)
        else:
            current_streak = 0

    lines.append(f"Longest quiet streak (30 days): {longest_streak} day{'s' if longest_streak != 1 else ''}")

    return "\n".join(lines)
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/bengreenberg/Dev/personal/missile-analysis/mcp-server
python -m pytest tests/test_analysis.py -v -k "streak"
```
Expected: All 3 streak tests PASS

- [ ] **Step 5: Run ALL tests**

```bash
cd /Users/bengreenberg/Dev/personal/missile-analysis/mcp-server
python -m pytest tests/ -v
```
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
cd /Users/bengreenberg/Dev/personal/missile-analysis
git add mcp-server/analysis.py mcp-server/tests/test_analysis.py
git commit -m "feat(mcp): add compute_streak with streak-breaker detection"
```

---

### Task 7: FastMCP server with auth and health check

**Files:**
- Create: `mcp-server/server.py`

- [ ] **Step 1: Write server.py**

```python
# mcp-server/server.py
"""SirenWise MCP server — Poke-compatible alert analysis tools."""
import os
import logging
from datetime import date, datetime, timedelta
import zoneinfo

from dotenv import load_dotenv

load_dotenv()

from fastmcp import FastMCP
from fastmcp.server.dependencies import get_http_request
from starlette.applications import Starlette
from starlette.responses import JSONResponse
from starlette.routing import Route, Mount

import db
from config import DEFAULT_CITY, TIMEZONE, DEFAULT_CLUSTER_WINDOW_MINUTES
from analysis import (
    compute_daily_context,
    compute_sleep_impact,
    compute_clustering,
    compute_streak,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
logger = logging.getLogger("sirenwise-mcp")

_tz = zoneinfo.ZoneInfo(TIMEZONE)

# --- Auth ---

def require_auth():
    request = get_http_request()
    auth = request.headers.get("authorization", "")
    if not auth.startswith("Bearer "):
        raise ValueError("Missing or invalid Authorization header")
    token = auth.split("Bearer ", 1)[1].strip()
    if token != os.environ["MCP_API_KEY"]:
        raise ValueError("Invalid API key")


# --- MCP App ---

mcp = FastMCP(
    "SirenWise",
    instructions="Alert analysis for Israel missile/rocket sirens. Tools provide daily context, sleep impact, clustering patterns, and quiet-day streaks. Default city: Modi'in Maccabim Reut.",
    dependencies=[require_auth],
)


async def _resolve_filter(city: str | None, region_id: str | None, nationwide: bool) -> str | list[str] | None:
    """Resolve city/region/nationwide params into a cities_filter value."""
    if nationwide:
        return None
    if region_id:
        return await db.fetch_cities_for_region(region_id)
    return city or DEFAULT_CITY


@mcp.tool(description="Compare today's alert activity against 7-day and 30-day averages. Shows if it's unusually quiet or ramping up.")
async def get_daily_context(
    city: str | None = None,
    region_id: str | None = None,
    nationwide: bool = False,
) -> str:
    cities_filter = await _resolve_filter(city, region_id, nationwide)
    today = date.today()
    today_dt = datetime(today.year, today.month, today.day, tzinfo=_tz)
    month_ago_dt = today_dt - timedelta(days=30)
    tomorrow_dt = today_dt + timedelta(days=1)
    alerts = await db.fetch_alerts(int(month_ago_dt.timestamp() * 1000), int(tomorrow_dt.timestamp() * 1000))
    return compute_daily_context(alerts, cities_filter, today)


@mcp.tool(description="Flag alerts that hit during night hours (10 PM - 6 AM). Highlights deep sleep disruptions (midnight-5 AM).")
async def get_sleep_impact(
    date_str: str | None = None,
    city: str | None = None,
    region_id: str | None = None,
    nationwide: bool = False,
) -> str:
    cities_filter = await _resolve_filter(city, region_id, nationwide)
    if date_str:
        night_date = date.fromisoformat(date_str)
    else:
        night_date = date.today()
    # Fetch 8 days of data for 7-night average
    start_dt = datetime(night_date.year, night_date.month, night_date.day, tzinfo=_tz) - timedelta(days=8)
    end_dt = datetime(night_date.year, night_date.month, night_date.day, 6, 0, tzinfo=_tz)
    alerts = await db.fetch_alerts(int(start_dt.timestamp() * 1000), int(end_dt.timestamp() * 1000))
    return compute_sleep_impact(alerts, cities_filter, night_date)


@mcp.tool(description="Detect whether alerts were isolated or part of a barrage within a short time window.")
async def get_clustering(
    date_str: str | None = None,
    window_minutes: int = DEFAULT_CLUSTER_WINDOW_MINUTES,
    city: str | None = None,
    region_id: str | None = None,
    nationwide: bool = False,
) -> str:
    cities_filter = await _resolve_filter(city, region_id, nationwide)
    target_date = date.fromisoformat(date_str) if date_str else date.today()
    day_start = datetime(target_date.year, target_date.month, target_date.day, tzinfo=_tz)
    day_end = day_start + timedelta(days=1)
    alerts = await db.fetch_alerts(int(day_start.timestamp() * 1000), int(day_end.timestamp() * 1000))
    return compute_clustering(alerts, cities_filter, target_date, window_minutes)


@mcp.tool(description="How many days since the last alert. Highlights if today breaks a quiet streak.")
async def get_streak(
    city: str | None = None,
    region_id: str | None = None,
    nationwide: bool = False,
) -> str:
    cities_filter = await _resolve_filter(city, region_id, nationwide)
    today = date.today()
    month_ago = datetime(today.year, today.month, today.day, tzinfo=_tz) - timedelta(days=30)
    tomorrow = datetime(today.year, today.month, today.day, tzinfo=_tz) + timedelta(days=1)
    alerts = await db.fetch_alerts(int(month_ago.timestamp() * 1000), int(tomorrow.timestamp() * 1000))
    return compute_streak(alerts, cities_filter, today)


# --- Health check ---

async def health(request):
    try:
        now = datetime.now(tz=_tz)
        one_hour_ago = int((now - timedelta(hours=1)).timestamp() * 1000)
        now_ts = int(now.timestamp() * 1000)
        await db.fetch_alerts(one_hour_ago, now_ts)
        return JSONResponse({"status": "ok", "turso": "connected"})
    except Exception as e:
        return JSONResponse({"status": "error", "turso": str(e)}, status_code=503)


# --- ASGI app ---

mcp_app = mcp.http_app(path="/mcp", stateless_http=True)

app = Starlette(
    routes=[
        Route("/health", health),
        Mount("/", app=mcp_app),
    ],
)
```

- [ ] **Step 2: Verify it imports without errors**

```bash
cd /Users/bengreenberg/Dev/personal/missile-analysis/mcp-server
python -c "from server import app; print('OK')"
```
Expected: `OK` (requires env vars — may need a `.env` with dummy values)

- [ ] **Step 3: Commit**

```bash
cd /Users/bengreenberg/Dev/personal/missile-analysis
git add mcp-server/server.py
git commit -m "feat(mcp): add FastMCP server with 4 tools, auth, and health check"
```

---

### Task 8: Deployment config files

**Files:**
- Create: `mcp-server/Caddyfile.snippet`
- Create: `mcp-server/sirenwise-mcp.service`
- Create: `mcp-server/README.md`

- [ ] **Step 1: Write Caddyfile snippet**

This is a snippet to be appended to the VPS Caddyfile via `contabo caddy`.

```
# mcp-server/Caddyfile.snippet
# Append to /etc/caddy/Caddyfile on VPS
sirenwise-mcp.hummusonrails.com {
    reverse_proxy 127.0.0.1:3810 {
        header_up Host {host}
    }
}
```

Note: Using port 3810 (next available after existing services 3800-3806). Skipping rate_limit since the caddy-ratelimit plugin may not be installed. Caddy handles auto-TLS.

- [ ] **Step 2: Write systemd unit**

```ini
# mcp-server/sirenwise-mcp.service
[Unit]
Description=SirenWise MCP Server
After=network.target

[Service]
Type=simple
User=sirenwise-mcp
Group=sirenwise-mcp
WorkingDirectory=/opt/sirenwise-mcp
ExecStart=/opt/sirenwise-mcp/venv/bin/uvicorn server:app --host 127.0.0.1 --port 3810
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

- [ ] **Step 3: Write README.md**

```markdown
# SirenWise MCP Server

MCP server for [Poke](https://poke.com) providing conversational access to
SirenWise missile alert analysis. Default city: Modi'in Maccabim Reut.

## Tools

- **get_daily_context** — Today's alerts vs 7-day and 30-day averages
- **get_sleep_impact** — Nighttime alerts (10 PM–6 AM) with deep sleep flags
- **get_clustering** — Isolated alerts vs barrages within time windows
- **get_streak** — Days since last alert, streak-breaker detection

## Local development

```bash
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # fill in values
uvicorn server:app --host 127.0.0.1 --port 3810 --reload
```

## Deploy to VPS

```bash
contabo deploy sirenwise-mcp --from=./mcp-server
contabo env set sirenwise-mcp MCP_API_KEY "your-key"
contabo env set sirenwise-mcp TURSO_DB_URL "https://missile-analysis-hummusonrails.aws-us-east-1.turso.io"
contabo env set sirenwise-mcp TURSO_READ_TOKEN "your-read-token"
contabo service restart sirenwise-mcp
```

## Register with Poke

```bash
poke mcp add https://sirenwise-mcp.hummusonrails.com/mcp -n "SirenWise" -k "your-key"
```

## Tests

```bash
python -m pytest tests/ -v
```
```

- [ ] **Step 4: Commit**

```bash
cd /Users/bengreenberg/Dev/personal/missile-analysis
git add mcp-server/Caddyfile.snippet mcp-server/sirenwise-mcp.service mcp-server/README.md
git commit -m "feat(mcp): add deployment config (Caddy, systemd, README)"
```

---

### Task 9: VPS deployment

**Files:** No new files — uses `contabo` CLI to deploy.

**Prerequisites:** Tasks 1-8 complete, all tests passing.

- [ ] **Step 1: Create DNS record for sirenwise-mcp.hummusonrails.com**

Check if DNS is managed via Cloudflare or the domain registrar, then add an A record pointing to the VPS IP.

```bash
contabo ssh "curl -s ifconfig.me"
```

Add an A record for `sirenwise-mcp.hummusonrails.com` → VPS IP (via Cloudflare dashboard or API).

- [ ] **Step 2: Generate Turso read-only token**

```bash
turso db tokens create missile-analysis --read-only
```

Save the output — this goes into the env vars.

- [ ] **Step 3: Deploy the service**

```bash
cd /Users/bengreenberg/Dev/personal/missile-analysis
contabo deploy sirenwise-mcp --from=./mcp-server
```

- [ ] **Step 4: Set environment variables**

```bash
contabo env set sirenwise-mcp MCP_API_KEY "$(openssl rand -hex 32)"
contabo env set sirenwise-mcp TURSO_DB_URL "https://missile-analysis-hummusonrails.aws-us-east-1.turso.io"
contabo env set sirenwise-mcp TURSO_READ_TOKEN "<token-from-step-2>"
```

- [ ] **Step 5: Create VPS user and install service**

```bash
contabo ssh "sudo useradd -r -s /usr/sbin/nologin sirenwise-mcp"
contabo ssh "sudo mkdir -p /etc/sirenwise-mcp"
contabo ssh "cd /opt/sirenwise-mcp && python3 -m venv venv && venv/bin/pip install -r requirements.txt"
contabo ssh "sudo cp /opt/sirenwise-mcp/sirenwise-mcp.service /etc/systemd/system/"
contabo ssh "sudo systemctl daemon-reload && sudo systemctl enable --now sirenwise-mcp"
```

- [ ] **Step 6: Add Caddy config**

Append the Caddyfile snippet to the VPS Caddy config:

```bash
contabo ssh "cat >> /etc/caddy/Caddyfile << 'EOF'

sirenwise-mcp.hummusonrails.com {
    reverse_proxy 127.0.0.1:3810 {
        header_up Host {host}
    }
}
EOF"
contabo caddy validate
contabo caddy reload
```

- [ ] **Step 7: Verify health endpoint**

```bash
curl -s https://sirenwise-mcp.hummusonrails.com/health
```
Expected: `{"status":"ok","turso":"connected"}`

- [ ] **Step 8: Verify MCP endpoint with auth**

```bash
# Should fail without auth
curl -s -X POST https://sirenwise-mcp.hummusonrails.com/mcp
# Should succeed with auth (returns MCP protocol response)
curl -s -X POST https://sirenwise-mcp.hummusonrails.com/mcp \
  -H "Authorization: Bearer $(contabo env get sirenwise-mcp MCP_API_KEY --plain)" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{}},"id":1}'
```

- [ ] **Step 9: Register with Poke**

```bash
poke mcp add https://sirenwise-mcp.hummusonrails.com/mcp -n "SirenWise" -k "$(contabo env get sirenwise-mcp MCP_API_KEY --plain)"
```

- [ ] **Step 10: Test via Poke**

Send a test message to Poke: "How's the siren situation today in Modi'in?"

Verify Poke calls the MCP tools and returns a conversational response.

- [ ] **Step 11: Commit any deployment adjustments**

```bash
cd /Users/bengreenberg/Dev/personal/missile-analysis
git add -A mcp-server/
git commit -m "chore(mcp): finalize deployment config after VPS setup"
```
