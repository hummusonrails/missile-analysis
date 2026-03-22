"""Turso database client using HTTP API via httpx."""
import json
import logging
import os

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


async def resolve_city_name(name: str) -> list[str]:
    """Resolve an English or partial city name to Hebrew zone names.

    Poke sends English names like 'Modiin' or "Modi'in". This strips
    apostrophes from both the search term and the DB column so all
    transliteration variants match (Modiin, Modi'in, Modi\u2019in, etc.).

    Returns a deduplicated list of matching Hebrew city names, or the
    original name wrapped in a list if no match is found.
    """
    # Strip all apostrophe variants for matching
    stripped = name.replace("'", "").replace("\u2019", "").replace("`", "")

    # Search English names with apostrophes stripped on both sides
    stmt = {
        "sql": "SELECT DISTINCT city_name FROM city_coords WHERE REPLACE(REPLACE(REPLACE(city_name_en, '''', ''), '\u2019', ''), '`', '') LIKE ? COLLATE NOCASE",
        "args": [{"type": "text", "value": f"%{stripped}%"}],
    }
    data = await _execute([stmt])
    rows = parse_turso_response(data)
    if rows:
        return [r["city_name"] for r in rows]

    # Fallback: try Hebrew name match
    stmt2 = {
        "sql": "SELECT DISTINCT city_name FROM city_coords WHERE city_name LIKE ?",
        "args": [{"type": "text", "value": f"%{name}%"}],
    }
    data2 = await _execute([stmt2])
    rows2 = parse_turso_response(data2)
    if rows2:
        return [r["city_name"] for r in rows2]
    return [name]


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
