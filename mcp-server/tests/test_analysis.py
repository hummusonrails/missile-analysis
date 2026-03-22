"""Tests for analysis.py — pure analysis functions."""

from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

import pytest

from analysis import (
    compute_clustering,
    compute_daily_context,
    compute_sleep_impact,
    compute_streak,
    filter_alerts_by_city,
)
from config import TIMEZONE

TZ = ZoneInfo(TIMEZONE)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_alert(ts: int, cities: list[str], threat: int = 0) -> dict:
    return {"id": f"1_{ts}", "timestamp": ts, "cities": cities, "threat": threat, "created_at": ts}


def _ts(d: date, hour: int, minute: int = 0) -> int:
    """Return unix milliseconds for a given date + time in Jerusalem timezone."""
    dt = datetime(d.year, d.month, d.day, hour, minute, 0, tzinfo=TZ)
    return int(dt.timestamp() * 1000)


# ---------------------------------------------------------------------------
# filter_alerts_by_city
# ---------------------------------------------------------------------------

def test_filter_by_single_city():
    modin = "מודיעין-מכבים-רעות"
    tel_aviv = "תל אביב"
    alerts = [
        _make_alert(1000, [modin, tel_aviv]),
        _make_alert(2000, [modin]),
        _make_alert(3000, [tel_aviv]),
    ]
    result = filter_alerts_by_city(alerts, modin)
    assert len(result) == 2
    assert all(modin in a["cities"] for a in result)


def test_filter_by_city_list():
    modin = "מודיעין-מכבים-רעות"
    tel_aviv = "תל אביב"
    haifa = "חיפה"
    alerts = [
        _make_alert(1000, [modin]),
        _make_alert(2000, [tel_aviv]),
        _make_alert(3000, [haifa]),
    ]
    result = filter_alerts_by_city(alerts, [modin, tel_aviv])
    assert len(result) == 2
    assert _make_alert(3000, [haifa]) not in result


def test_filter_nationwide():
    modin = "מודיעין-מכבים-רעות"
    tel_aviv = "תל אביב"
    alerts = [
        _make_alert(1000, [modin]),
        _make_alert(2000, [tel_aviv]),
        _make_alert(3000, [modin, tel_aviv]),
    ]
    result = filter_alerts_by_city(alerts, None)
    assert len(result) == 3


# ---------------------------------------------------------------------------
# compute_daily_context
# ---------------------------------------------------------------------------

def test_daily_context_no_activity():
    result = compute_daily_context([], "מודיעין-מכבים-רעות", date(2024, 1, 15))
    assert "no recent activity" in result.lower()


def test_daily_context_elevated():
    modin = "מודיעין-מכבים-רעות"
    today = date(2024, 1, 15)

    # 1 alert on each of the 7 previous days → avg = 1/day
    past_alerts = [
        _make_alert(_ts(today - timedelta(days=i), 10), [modin])
        for i in range(1, 8)
    ]
    # 3 alerts today → ratio = 3 → "intense"
    today_alerts = [
        _make_alert(_ts(today, 10), [modin]),
        _make_alert(_ts(today, 11), [modin]),
        _make_alert(_ts(today, 12), [modin]),
    ]
    alerts = past_alerts + today_alerts
    result = compute_daily_context(alerts, modin, today)
    assert "elevated" in result or "intense" in result


# ---------------------------------------------------------------------------
# compute_sleep_impact
# ---------------------------------------------------------------------------

def test_sleep_impact_no_disruptions():
    result = compute_sleep_impact([], "מודיעין-מכבים-רעות", date(2024, 1, 15))
    assert "no disruptions" in result.lower()


def test_sleep_impact_deep_sleep():
    modin = "מודיעין-מכבים-רעות"
    night_date = date(2024, 1, 15)
    # 3:14 AM on night_date is deep sleep
    ts = _ts(night_date, 3, 14)
    alerts = [_make_alert(ts, [modin])]
    result = compute_sleep_impact(alerts, modin, night_date)
    assert "deep sleep" in result.lower()
    assert "3:14 AM" in result


def test_sleep_impact_evening_alert():
    modin = "מודיעין-מכבים-רעות"
    night_date = date(2024, 1, 15)
    # 11:30 PM on the evening BEFORE night_date (i.e. Jan 14 at 23:30)
    prev_day = night_date - timedelta(days=1)
    ts = _ts(prev_day, 23, 30)
    alerts = [_make_alert(ts, [modin])]
    result = compute_sleep_impact(alerts, modin, night_date)
    assert "11:30 PM" in result


# ---------------------------------------------------------------------------
# compute_clustering
# ---------------------------------------------------------------------------

def test_clustering_no_alerts():
    result = compute_clustering([], "מודיעין-מכבים-רעות", date(2024, 1, 15))
    assert "no alerts" in result.lower()


def test_clustering_isolated():
    modin = "מודיעין-מכבים-רעות"
    target_date = date(2024, 1, 15)
    alerts = [_make_alert(_ts(target_date, 10, 0), [modin])]
    result = compute_clustering(alerts, modin, target_date)
    assert "isolated" in result.lower()


def test_clustering_barrage():
    modin = "מודיעין-מכבים-רעות"
    target_date = date(2024, 1, 15)
    base_ts = _ts(target_date, 10, 0)
    # 6 alerts within 5 minutes of each other
    alerts = [
        _make_alert(base_ts + i * 45_000, [modin])  # 45 second gaps
        for i in range(6)
    ]
    result = compute_clustering(alerts, modin, target_date)
    assert "barrage" in result.lower()


def test_clustering_filters_by_city():
    """A barrage of only Tel Aviv alerts should not appear for Modi'in."""
    modin = "מודיעין-מכבים-רעות"
    tel_aviv = "תל אביב"
    target_date = date(2024, 1, 15)
    base_ts = _ts(target_date, 10, 0)
    alerts = [
        _make_alert(base_ts + i * 45_000, [tel_aviv])
        for i in range(6)
    ]
    result = compute_clustering(alerts, modin, target_date)
    assert "no alerts" in result.lower()


def test_clustering_includes_multi_city_barrage():
    """A barrage with mixed cities that includes Modi'in should be shown."""
    modin = "מודיעין-מכבים-רעות"
    tel_aviv = "תל אביב"
    target_date = date(2024, 1, 15)
    base_ts = _ts(target_date, 10, 0)
    # 5 alerts in rapid succession — some in Tel Aviv, one in Modi'in
    alerts = [
        _make_alert(base_ts + 0 * 45_000, [tel_aviv]),
        _make_alert(base_ts + 1 * 45_000, [tel_aviv]),
        _make_alert(base_ts + 2 * 45_000, [modin, tel_aviv]),
        _make_alert(base_ts + 3 * 45_000, [tel_aviv]),
        _make_alert(base_ts + 4 * 45_000, [tel_aviv]),
    ]
    result = compute_clustering(alerts, modin, target_date)
    assert "barrage" in result.lower()


# ---------------------------------------------------------------------------
# compute_streak
# ---------------------------------------------------------------------------

def test_streak_no_alerts():
    result = compute_streak([], "מודיעין-מכבים-רעות", date(2024, 1, 15))
    assert "no alerts in the last 30 days" in result.lower()


def test_streak_today_breaks_streak():
    modin = "מודיעין-מכבים-רעות"
    today = date(2024, 1, 15)
    # Alert 5 days ago and then again today (4 quiet days between them)
    prev_alert_date = today - timedelta(days=5)
    alerts = [
        _make_alert(_ts(prev_alert_date, 12, 0), [modin]),
        _make_alert(_ts(today, 9, 0), [modin]),
    ]
    result = compute_streak(alerts, modin, today)
    assert "first alert in" in result.lower()
    # The gap is 5 days total, quiet_days = gap - 1 = 4
    assert "4" in result


def test_streak_ongoing_quiet():
    modin = "מודיעין-מכבים-רעות"
    today = date(2024, 1, 15)
    # Last alert 10 days ago, nothing since
    last_alert_date = today - timedelta(days=10)
    alerts = [_make_alert(_ts(last_alert_date, 12, 0), [modin])]
    result = compute_streak(alerts, modin, today)
    assert "10" in result
