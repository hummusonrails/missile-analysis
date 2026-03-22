#!/usr/bin/env python3
"""SirenWise MCP server — Poke-compatible alert analysis tools."""
import os
import logging
from datetime import date, datetime, timedelta
import zoneinfo

from dotenv import load_dotenv
load_dotenv()

from fastmcp import FastMCP
from fastmcp.server.dependencies import get_http_request

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

# --- Auth (tunnel-mode permissive) ---
def validate_api_key():
    """Validate API key if provided. In tunnel mode, requests come without tokens
    since the tunnel itself is the auth boundary (localhost-only, outbound tunnel,
    only authenticated Poke account can route requests)."""
    expected = os.environ.get("MCP_API_KEY")
    if not expected:
        return
    request = get_http_request()
    auth = request.headers.get("authorization", "")
    if not auth:
        return  # Tunnel mode — server is localhost-only
    if not auth.startswith("Bearer "):
        raise ValueError("Unauthorized")
    token = auth.split("Bearer ", 1)[1].strip()
    if token != expected:
        raise ValueError("Unauthorized")

# --- MCP App ---
mcp = FastMCP(
    "SirenWise",
    instructions="Alert analysis for Israel missile/rocket sirens. Tools provide daily context, sleep impact, clustering patterns, and quiet-day streaks. Default city: Modi'in Maccabim Reut.",
)

async def _resolve_filter(city, region_id, nationwide):
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
    validate_api_key()
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
    validate_api_key()
    cities_filter = await _resolve_filter(city, region_id, nationwide)
    night_date = date.fromisoformat(date_str) if date_str else date.today()
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
    validate_api_key()
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
    validate_api_key()
    cities_filter = await _resolve_filter(city, region_id, nationwide)
    today = date.today()
    month_ago = datetime(today.year, today.month, today.day, tzinfo=_tz) - timedelta(days=30)
    tomorrow = datetime(today.year, today.month, today.day, tzinfo=_tz) + timedelta(days=1)
    alerts = await db.fetch_alerts(int(month_ago.timestamp() * 1000), int(tomorrow.timestamp() * 1000))
    return compute_streak(alerts, cities_filter, today)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8001))
    mcp.run(transport="http", host="127.0.0.1", port=port, stateless_http=True)
