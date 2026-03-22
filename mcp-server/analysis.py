"""Pure analysis functions for SirenWise MCP server. No I/O, no framework imports."""

from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from config import (
    DEEP_SLEEP_END,
    DEEP_SLEEP_START,
    DEFAULT_CLUSTER_WINDOW_MINUTES,
    NIGHT_END,
    NIGHT_START,
    THREAT_LABEL_DEFAULT,
    THREAT_LABELS,
    TIMEZONE,
)


# ---------------------------------------------------------------------------
# 1. filter_alerts_by_city
# ---------------------------------------------------------------------------

def filter_alerts_by_city(alerts: list[dict], cities_filter) -> list[dict]:
    """Filter alerts by city or cities.

    Args:
        alerts: List of alert dicts with a 'cities' key (list of str).
        cities_filter: str for single city, list[str] for a region, None for nationwide.

    Returns:
        Filtered list of alerts.
    """
    if cities_filter is None:
        return list(alerts)

    if isinstance(cities_filter, str):
        target = {cities_filter}
    else:
        target = set(cities_filter)

    return [a for a in alerts if target.intersection(a.get("cities", []))]


# ---------------------------------------------------------------------------
# 2. compute_daily_context
# ---------------------------------------------------------------------------

def compute_daily_context(alerts: list[dict], cities_filter, today: date) -> str:
    """Compare today's alert count to 7/30 day averages and return a label.

    Args:
        alerts: All alerts (pre-fetched for the relevant window).
        cities_filter: str | list[str] | None
        today: The date to treat as "today".

    Returns:
        A human-readable string describing daily activity level.
    """
    tz = ZoneInfo(TIMEZONE)
    filtered = filter_alerts_by_city(alerts, cities_filter)

    # Determine label for the cities_filter
    if cities_filter is None:
        location_label = "Nationwide"
    elif isinstance(cities_filter, str):
        location_label = cities_filter
    else:
        location_label = ", ".join(cities_filter)

    if not filtered:
        return f"No recent activity for {location_label} in the past 30 days."

    def _alert_date(alert: dict) -> date:
        ts_s = alert["timestamp"] / 1000
        return datetime.fromtimestamp(ts_s, tz=tz).date()

    # Today's alerts
    today_alerts = [a for a in filtered if _alert_date(a) == today]
    today_count = len(today_alerts)

    # 7-day window (not counting today)
    week_start = today - timedelta(days=7)
    week_alerts = [a for a in filtered if week_start <= _alert_date(a) < today]
    week_avg = len(week_alerts) / 7

    # 30-day window (not counting today)
    month_start = today - timedelta(days=30)
    month_alerts = [a for a in filtered if month_start <= _alert_date(a) < today]
    month_avg = len(month_alerts) / 30

    # Deviation label vs week average
    if week_avg == 0:
        if today_count == 0:
            return f"No recent activity for {location_label} in the past 30 days."
        deviation_label = "elevated"
    else:
        ratio = today_count / week_avg
        if ratio < 0.5:
            deviation_label = "unusually quiet"
        elif ratio < 0.8:
            deviation_label = "quiet"
        elif ratio <= 1.2:
            deviation_label = "typical"
        elif ratio <= 2.0:
            deviation_label = "elevated"
        else:
            deviation_label = "intense"

    return (
        f"{location_label} — {today.strftime('%B %-d, %Y')}\n"
        f"Today: {today_count} alert(s) — activity level: {deviation_label}\n"
        f"7-day avg: {week_avg:.1f}/day | 30-day avg: {month_avg:.1f}/day"
    )


# ---------------------------------------------------------------------------
# 3. compute_sleep_impact
# ---------------------------------------------------------------------------

def compute_sleep_impact(alerts: list[dict], cities_filter, night_date: date) -> str:
    """Flag alerts during 22:00–06:00 and specifically deep sleep 00:00–05:00.

    Args:
        alerts: All alerts (pre-fetched for the relevant window).
        cities_filter: str | list[str] | None
        night_date: The morning date of the night in question (e.g. 2024-01-15 means
                    the night of Jan 14–15).

    Returns:
        Human-readable string describing sleep disruptions.
    """
    tz = ZoneInfo(TIMEZONE)
    filtered = filter_alerts_by_city(alerts, cities_filter)

    if cities_filter is None:
        location_label = "Nationwide"
    elif isinstance(cities_filter, str):
        location_label = cities_filter
    else:
        location_label = ", ".join(cities_filter)

    # Night window: 22:00 of the previous evening to 06:00 of night_date
    night_start_dt = datetime(
        night_date.year, night_date.month, night_date.day,
        NIGHT_START, 0, 0, tzinfo=tz
    ) - timedelta(days=1)
    night_end_dt = datetime(
        night_date.year, night_date.month, night_date.day,
        NIGHT_END, 0, 0, tzinfo=tz
    )

    # Deep sleep window: 00:00–05:00 of night_date
    deep_start_dt = datetime(
        night_date.year, night_date.month, night_date.day,
        DEEP_SLEEP_START, 0, 0, tzinfo=tz
    )
    deep_end_dt = datetime(
        night_date.year, night_date.month, night_date.day,
        DEEP_SLEEP_END, 0, 0, tzinfo=tz
    )

    # Night alerts for this specific night
    night_alerts = []
    for alert in filtered:
        ts_s = alert["timestamp"] / 1000
        dt = datetime.fromtimestamp(ts_s, tz=tz)
        if night_start_dt <= dt < night_end_dt:
            night_alerts.append((dt, alert))

    # 7-night average (previous 7 nights, not counting this night)
    seven_night_count = 0
    for i in range(1, 8):
        prev_date = night_date - timedelta(days=i)
        prev_night_start = datetime(
            prev_date.year, prev_date.month, prev_date.day,
            NIGHT_START, 0, 0, tzinfo=tz
        ) - timedelta(days=1)
        prev_night_end = datetime(
            prev_date.year, prev_date.month, prev_date.day,
            NIGHT_END, 0, 0, tzinfo=tz
        )
        for alert in filtered:
            ts_s = alert["timestamp"] / 1000
            dt = datetime.fromtimestamp(ts_s, tz=tz)
            if prev_night_start <= dt < prev_night_end:
                seven_night_count += 1
    seven_night_avg = seven_night_count / 7

    if not night_alerts:
        return (
            f"No disruptions for {location_label} on the night of "
            f"{night_date.strftime('%B %-d, %Y')}.\n"
            f"7-night avg: {seven_night_avg:.1f} alert(s)/night"
        )

    lines = [
        f"Sleep impact for {location_label} — night of {night_date.strftime('%B %-d, %Y')}:"
    ]
    for dt, alert in sorted(night_alerts, key=lambda x: x[0]):
        threat_label = THREAT_LABELS.get(alert.get("threat", -1), THREAT_LABEL_DEFAULT)
        cities_str = ", ".join(alert.get("cities", []))
        time_str = dt.strftime("%-I:%M %p")
        is_deep = deep_start_dt <= dt < deep_end_dt
        prefix = "** DEEP SLEEP **" if is_deep else "  Night alert  "
        lines.append(f"{prefix} {time_str} — {threat_label} in {cities_str}")

    lines.append(f"Total: {len(night_alerts)} night alert(s) | 7-night avg: {seven_night_avg:.1f}/night")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# 4. compute_clustering
# ---------------------------------------------------------------------------

def compute_clustering(
    alerts: list[dict],
    cities_filter,
    target_date: date,
    window_minutes: int = DEFAULT_CLUSTER_WINDOW_MINUTES,
) -> str:
    """Cluster ALL alerts by time, then filter clusters containing the target city.

    Args:
        alerts: All alerts (pre-fetched for the relevant window).
        cities_filter: str | list[str] | None
        target_date: The date to analyse.
        window_minutes: Gap threshold for forming a new cluster (default 5 min).

    Returns:
        Human-readable string describing alert clusters.
    """
    tz = ZoneInfo(TIMEZONE)

    if cities_filter is None:
        location_label = "Nationwide"
        target_cities: set[str] | None = None
    elif isinstance(cities_filter, str):
        location_label = cities_filter
        target_cities = {cities_filter}
    else:
        location_label = ", ".join(cities_filter)
        target_cities = set(cities_filter)

    # Filter alerts to target_date (all cities)
    day_start = datetime(target_date.year, target_date.month, target_date.day, 0, 0, 0, tzinfo=tz)
    day_end = day_start + timedelta(days=1)
    day_start_ms = int(day_start.timestamp() * 1000)
    day_end_ms = int(day_end.timestamp() * 1000)

    day_alerts = [
        a for a in alerts
        if day_start_ms <= a["timestamp"] < day_end_ms
    ]
    day_alerts.sort(key=lambda a: a["timestamp"])

    if not day_alerts:
        return f"No alerts on {target_date.strftime('%B %-d, %Y')} for {location_label}."

    # Cluster ALL alerts by time
    window_ms = window_minutes * 60 * 1000
    clusters: list[list[dict]] = []
    current_cluster: list[dict] = []

    for alert in day_alerts:
        if not current_cluster:
            current_cluster.append(alert)
        elif alert["timestamp"] - current_cluster[-1]["timestamp"] <= window_ms:
            current_cluster.append(alert)
        else:
            clusters.append(current_cluster)
            current_cluster = [alert]
    if current_cluster:
        clusters.append(current_cluster)

    # Filter clusters containing target cities (or all if nationwide)
    if target_cities is not None:
        relevant_clusters = [
            c for c in clusters
            if any(target_cities.intersection(a.get("cities", [])) for a in c)
        ]
    else:
        relevant_clusters = clusters

    if not relevant_clusters:
        return f"No alerts on {target_date.strftime('%B %-d, %Y')} for {location_label}."

    def _cluster_label(size: int) -> str:
        if size == 1:
            return "isolated"
        elif size <= 4:
            return "burst"
        else:
            return "barrage"

    lines = [
        f"Alert clustering for {location_label} — {target_date.strftime('%B %-d, %Y')}:"
    ]
    for i, cluster in enumerate(relevant_clusters, 1):
        label = _cluster_label(len(cluster))
        first_dt = datetime.fromtimestamp(cluster[0]["timestamp"] / 1000, tz=tz)
        last_dt = datetime.fromtimestamp(cluster[-1]["timestamp"] / 1000, tz=tz)
        if len(cluster) == 1:
            lines.append(f"  Cluster {i}: {label} at {first_dt.strftime('%-I:%M %p')} ({len(cluster)} alert)")
        else:
            lines.append(
                f"  Cluster {i}: {label} from {first_dt.strftime('%-I:%M %p')} to "
                f"{last_dt.strftime('%-I:%M %p')} ({len(cluster)} alerts)"
            )

    total = sum(len(c) for c in relevant_clusters)
    lines.append(f"Total: {len(relevant_clusters)} cluster(s), {total} alert(s)")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# 5. compute_streak
# ---------------------------------------------------------------------------

def compute_streak(alerts: list[dict], cities_filter, today: date) -> str:
    """Compute days since last alert, streak-breaker detection, longest quiet streak.

    Args:
        alerts: All alerts (pre-fetched for a 30+ day window).
        cities_filter: str | list[str] | None
        today: The date to treat as "today".

    Returns:
        Human-readable string describing alert streaks.
    """
    tz = ZoneInfo(TIMEZONE)
    filtered = filter_alerts_by_city(alerts, cities_filter)

    if cities_filter is None:
        location_label = "Nationwide"
    elif isinstance(cities_filter, str):
        location_label = cities_filter
    else:
        location_label = ", ".join(cities_filter)

    def _alert_date(alert: dict) -> date:
        ts_s = alert["timestamp"] / 1000
        return datetime.fromtimestamp(ts_s, tz=tz).date()

    thirty_days_ago = today - timedelta(days=30)

    if not filtered:
        if cities_filter is None:
            return "Nationwide alerts are continuous — no quiet streaks detected in the past 30 days."
        return f"No alerts in the last 30 days for {location_label}."

    # Most recent alert
    most_recent = max(filtered, key=lambda a: a["timestamp"])
    most_recent_date = _alert_date(most_recent)

    # Days since last alert (relative to today)
    days_since = (today - most_recent_date).days

    # Streak breaker: today has alerts AND previous alert was >1 day ago
    today_alerts = [a for a in filtered if _alert_date(a) == today]
    prev_alerts = [a for a in filtered if _alert_date(a) < today]
    is_streak_breaker = False
    quiet_days = 0
    if today_alerts and prev_alerts:
        prev_most_recent = max(prev_alerts, key=lambda a: a["timestamp"])
        prev_date = _alert_date(prev_most_recent)
        gap = (today - prev_date).days
        if gap > 1:
            is_streak_breaker = True
            quiet_days = gap - 1  # number of quiet days before today

    # Longest consecutive quiet streak in the 30-day window
    # Scan day-by-day
    alert_dates = {_alert_date(a) for a in filtered}
    longest_streak = 0
    current_streak = 0
    for offset in range(30):
        check_date = thirty_days_ago + timedelta(days=offset)
        if check_date not in alert_dates:
            current_streak += 1
            if current_streak > longest_streak:
                longest_streak = current_streak
        else:
            current_streak = 0

    lines = [f"Alert streak report for {location_label} — {today.strftime('%B %-d, %Y')}:"]

    if days_since == 0:
        lines.append(f"  Alerts today: {len(today_alerts)}")
    else:
        lines.append(f"  Last alert: {days_since} day(s) ago ({most_recent_date.strftime('%B %-d')})")

    if is_streak_breaker:
        lines.append(
            f"  ** Streak breaker ** — first alert in {quiet_days} day(s)"
        )

    lines.append(f"  Longest quiet streak in past 30 days: {longest_streak} day(s)")
    return "\n".join(lines)
