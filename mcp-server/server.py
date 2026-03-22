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
import payments
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

# --- MCP App ---
mcp = FastMCP(
    "SirenWise",
    instructions="Alert analysis for Israel missile/rocket sirens. Tools provide daily context, sleep impact, clustering patterns, and quiet-day streaks. Default city: Modi'in Maccabim Reut.",
)

def _is_external_request() -> bool:
    """Check if current request came via Caddy (external) vs localhost (Poke)."""
    try:
        request = get_http_request()
        caddy_secret = request.headers.get("x-caddy-secret")
        expected = os.environ.get("CADDY_INTERNAL_SECRET")
        if not expected or not caddy_secret:
            return False
        return caddy_secret == expected
    except Exception:
        return False


async def _resolve_filter(city, region_id, nationwide):
    """Resolve city/region/nationwide params into a cities_filter value.

    External requests (paid API) default to nationwide when no city specified.
    Localhost requests (Poke) default to Modi'in.
    """
    if nationwide:
        return None
    if region_id:
        return await db.fetch_cities_for_region(region_id)
    if not city:
        if _is_external_request():
            return None  # Nationwide for paid API
        return DEFAULT_CITY  # Modi'in for personal Poke
    # Poke sends English names — resolve to Hebrew zone names
    resolved = await db.resolve_city_name(city)
    logger.info(f"Resolved city '{city}' to {resolved}")
    return resolved

@mcp.tool(description="Compare today's alert activity against 7-day and 30-day averages. Shows if it's unusually quiet or ramping up.")
async def get_daily_context(
    city: str | None = None,
    region_id: str | None = None,
    nationwide: bool = False,
) -> str:
    await payments.check_access("get_daily_context")
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
    await payments.check_access("get_sleep_impact")
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
    await payments.check_access("get_clustering")
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
    await payments.check_access("get_streak")
    cities_filter = await _resolve_filter(city, region_id, nationwide)
    today = date.today()
    month_ago = datetime(today.year, today.month, today.day, tzinfo=_tz) - timedelta(days=30)
    tomorrow = datetime(today.year, today.month, today.day, tzinfo=_tz) + timedelta(days=1)
    alerts = await db.fetch_alerts(int(month_ago.timestamp() * 1000), int(tomorrow.timestamp() * 1000))
    return compute_streak(alerts, cities_filter, today)

if __name__ == "__main__":
    import uvicorn
    from x402_middleware import X402PaymentMiddleware

    port = int(os.environ.get("PORT", 8001))

    # Get the ASGI app from FastMCP and wrap with x402 middleware
    mcp_app = mcp.http_app(path="/mcp", stateless_http=True)
    app = X402PaymentMiddleware(mcp_app)

    uvicorn.run(app, host="127.0.0.1", port=port)
