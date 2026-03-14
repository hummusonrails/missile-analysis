"use client";

import { useMemo } from "react";
import type { Alert, CityCoord } from "../types";

const ISRAEL_TZ = "Asia/Jerusalem";

function toIsraelDate(ts: number): Date {
  return new Date(new Date(ts).toLocaleString("en-US", { timeZone: ISRAEL_TZ }));
}

function isShabbat(ts: number): boolean {
  const d = toIsraelDate(ts);
  const day = d.getDay();
  const hour = d.getHours();
  if (day === 5 && hour >= 18) return true;
  if (day === 6 && hour <= 21) return true;
  return false;
}

export function useClientAnalytics(alerts: Alert[], cityCoords: Map<string, CityCoord>) {
  return useMemo(() => {
    if (alerts.length === 0) return null;

    const hourCounts = new Array(24).fill(0);
    let shabbatCount = 0;
    let weekdayCount = 0;
    let morningCount = 0;
    let eveningCount = 0;
    const dayCounts = new Array(7).fill(0);
    const monthCounts: Record<string, number> = {};
    const threatCounts: Record<number, number> = {};
    const regionCounts: Record<string, number> = {};

    // Per-alert: map group_id -> set of region_ids for multi-region analysis
    const groupRegions: Record<string, Set<string>> = {};

    for (const alert of alerts) {
      const d = toIsraelDate(alert.timestamp);
      const hour = d.getHours();
      const day = d.getDay();
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

      hourCounts[hour]++;
      dayCounts[day]++;
      monthCounts[monthKey] = (monthCounts[monthKey] || 0) + 1;
      threatCounts[alert.threat] = (threatCounts[alert.threat] || 0) + 1;

      if (isShabbat(alert.timestamp)) shabbatCount++;
      else weekdayCount++;

      if (hour >= 6 && hour < 18) morningCount++;
      else eveningCount++;

      // Region + group tracking
      const groupId = alert.id.split("_")[0];
      if (!groupRegions[groupId]) groupRegions[groupId] = new Set();
      const alertRegions = new Set<string>();
      for (const city of alert.cities) {
        const coord = cityCoords.get(city);
        if (coord?.region_id) {
          alertRegions.add(coord.region_id);
          groupRegions[groupId].add(coord.region_id);
        }
      }
      for (const r of alertRegions) {
        regionCounts[r] = (regionCounts[r] || 0) + 1;
      }
    }

    // === HOURLY PATTERN ===
    const peakHour = hourCounts.indexOf(Math.max(...hourCounts));
    const quietestHour = hourCounts.indexOf(Math.min(...hourCounts));

    // === SHABBAT VS WEEKDAY ===
    // Count actual calendar days in range for per-day averages
    const oldest = Math.min(...alerts.map((a) => a.timestamp));
    const newest = Math.max(...alerts.map((a) => a.timestamp));
    const dayMs = 24 * 60 * 60 * 1000;

    const shabbatDays = new Set<string>();
    const weekdayDays = new Set<string>();
    const dayOfWeekDateCount = new Array(7).fill(0); // count of each weekday in the range

    for (let t = oldest; t <= newest; t += dayMs) {
      const d = toIsraelDate(t);
      const dow = d.getDay();
      const dateKey = d.toISOString().slice(0, 10);
      dayOfWeekDateCount[dow]++;
      if (dow === 5 || dow === 6) shabbatDays.add(dateKey);
      else weekdayDays.add(dateKey);
    }

    const numShabbatDays = Math.max(shabbatDays.size, 1);
    const numWeekdays = Math.max(weekdayDays.size, 1);
    const avgPerShabbatDay = Math.round(shabbatCount / numShabbatDays);
    const avgPerWeekday = Math.round(weekdayCount / numWeekdays);
    const shabbatMultiplier = avgPerWeekday > 0
      ? Math.round((avgPerShabbatDay / avgPerWeekday) * 10) / 10
      : 0;

    // === DAY OF WEEK (normalized by number of each weekday in range) ===
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const normalizedDayCounts = dayCounts.map((count: number, i: number) => {
      const numDays = Math.max(dayOfWeekDateCount[i], 1);
      return Math.round(count / numDays); // avg alerts per that weekday
    });
    const busiestDayIdx = normalizedDayCounts.indexOf(Math.max(...normalizedDayCounts));

    // === TIME BETWEEN ALERTS ===
    const sorted = [...alerts].sort((a, b) => a.timestamp - b.timestamp);
    const gaps: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      gaps.push(Math.round((sorted[i].timestamp - sorted[i - 1].timestamp) / 60000));
    }
    gaps.sort((a, b) => a - b);
    const medianGap = gaps.length > 0 ? gaps[Math.floor(gaps.length / 2)] : 0;

    // Distribution buckets
    const bucketDefs = [
      { label: "<5m", min: 0, max: 5 },
      { label: "5-15m", min: 5, max: 15 },
      { label: "15-30m", min: 15, max: 30 },
      { label: "30m-1h", min: 30, max: 60 },
      { label: "1-2h", min: 60, max: 120 },
      { label: "2-6h", min: 120, max: 360 },
      { label: "6-24h", min: 360, max: 1440 },
      { label: ">24h", min: 1440, max: Infinity },
    ];
    const gapDistribution = bucketDefs.map((b) => ({
      label: b.label,
      count: gaps.filter((g) => g >= b.min && g < b.max).length,
    }));

    // === QUIET/ACTIVE PERIODS ===
    let longestQuietMs = 0;
    let longestActiveMs = 0;
    let activeStart = sorted.length > 0 ? sorted[0].timestamp : 0;

    for (let i = 1; i < sorted.length; i++) {
      const gap = sorted[i].timestamp - sorted[i - 1].timestamp;
      if (gap > longestQuietMs) longestQuietMs = gap;

      // Active period = consecutive alerts within 30 min
      if (gap > 30 * 60 * 1000) {
        const activeDuration = sorted[i - 1].timestamp - activeStart;
        if (activeDuration > longestActiveMs) longestActiveMs = activeDuration;
        activeStart = sorted[i].timestamp;
      }
    }
    if (sorted.length > 0) {
      const lastActive = sorted[sorted.length - 1].timestamp - activeStart;
      if (lastActive > longestActiveMs) longestActiveMs = lastActive;
    }

    // === MONTHLY TRENDS ===
    const monthsSorted = Object.entries(monthCounts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, count]) => ({ month, count }));
    const mLen = monthsSorted.length;
    const monthDelta = mLen >= 2
      ? Math.round(((monthsSorted[mLen - 1].count - monthsSorted[mLen - 2].count) / Math.max(monthsSorted[mLen - 2].count, 1)) * 100)
      : 0;

    // === ESCALATION ===
    // Current hourly rate vs 7-day rolling hourly average
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const currentHourAlerts = alerts.filter((a) => a.timestamp >= oneHourAgo).length;
    const last7dAlerts = alerts.filter((a) => a.timestamp >= sevenDaysAgo).length;
    const last7dHours = Math.max(1, (now - Math.max(sevenDaysAgo, oldest)) / (60 * 60 * 1000));
    const baseline = last7dAlerts / last7dHours;
    const escalationMultiplier = baseline > 0
      ? Math.round((currentHourAlerts / baseline) * 10) / 10
      : 0;

    // === MULTI-REGION CORRELATION ===
    const multiRegionGroups = Object.values(groupRegions).filter((regions) => regions.size >= 3);
    const multiRegionCount = multiRegionGroups.length;
    const avgRegionsPerMulti = multiRegionGroups.length > 0
      ? Math.round((multiRegionGroups.reduce((sum, r) => sum + r.size, 0) / multiRegionGroups.length) * 10) / 10
      : 0;

    // === GEOGRAPHIC SPREAD ===
    const allGroupSpreads = Object.values(groupRegions).map((r) => r.size);
    const avgSpread = allGroupSpreads.length > 0
      ? Math.round((allGroupSpreads.reduce((a, b) => a + b, 0) / allGroupSpreads.length) * 10) / 10
      : 0;

    const eveningPercent = alerts.length > 0 ? Math.round((eveningCount / alerts.length) * 100) : 0;

    return {
      shabbat_vs_weekday: {
        shabbatCount,
        weekdayCount,
        avgPerShabbatDay,
        avgPerWeekday,
        multiplier: shabbatMultiplier,
        shabbatPercent: alerts.length > 0 ? Math.round((shabbatCount / alerts.length) * 100) : 0,
      },
      hourly_histogram: {
        hours: hourCounts.map((count: number, hour: number) => ({ hour, count })),
        peakHour,
        quietestHour,
      },
      morning_vs_evening: {
        morningCount,
        eveningCount,
        eveningPercent,
        peakHour,
        quietestHour,
      },
      day_of_week: {
        days: normalizedDayCounts.map((avgCount: number, i: number) => ({
          day: i,
          name: dayNames[i],
          count: avgCount, // average per day, not raw total
          rawCount: dayCounts[i], // keep raw for reference
        })),
        busiestDay: dayNames[busiestDayIdx],
        busiestCount: normalizedDayCounts[busiestDayIdx],
      },
      threat_distribution: {
        counts: threatCounts,
        mostCommonLevel: Number(
          Object.entries(threatCounts).reduce(
            (max, [l, c]) => (c > max[1] ? [l, c] : max),
            ["0", 0]
          )[0]
        ),
      },
      regional_heatmap: { regions: regionCounts },
      time_between_alerts: {
        medianGapMinutes: medianGap,
        distribution: gapDistribution,
      },
      quiet_vs_active: {
        longestQuietHours: Math.round(longestQuietMs / (60 * 60 * 1000)),
        longestActiveHours: Math.round(longestActiveMs / (60 * 60 * 1000)),
      },
      monthly_trends: {
        months: monthsSorted,
        monthOverMonthDelta: monthDelta,
      },
      escalation_patterns: {
        currentRate: currentHourAlerts,
        baseline: Math.round(baseline * 10) / 10,
        multiplier: escalationMultiplier,
      },
      multi_city_correlation: {
        multiRegionCount,
        avgRegions: avgRegionsPerMulti,
        totalGroups: Object.keys(groupRegions).length,
      },
      geographic_spread: {
        avgRegionsPerGroup: avgSpread,
        totalGroups: Object.keys(groupRegions).length,
      },
      totalAlerts: alerts.length,
    };
  }, [alerts, cityCoords]);
}
