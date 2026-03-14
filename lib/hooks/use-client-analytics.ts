"use client";

import { useMemo } from "react";
import type { Alert, CityCoord } from "../types";

// Lightweight client-side analytics computed from filtered alerts
// This ensures analytics respond to time range filters

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

    // Hourly histogram
    const hourCounts = new Array(24).fill(0);
    let shabbatCount = 0;
    let weekdayCount = 0;
    let morningCount = 0;
    let eveningCount = 0;
    const dayCounts = new Array(7).fill(0);
    const monthCounts: Record<string, number> = {};
    const threatCounts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
    const regionCounts: Record<string, number> = {};

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

      // Region counts
      const regions = new Set<string>();
      for (const city of alert.cities) {
        const coord = cityCoords.get(city);
        if (coord?.region_id) regions.add(coord.region_id);
      }
      for (const r of regions) {
        regionCounts[r] = (regionCounts[r] || 0) + 1;
      }
    }

    const peakHour = hourCounts.indexOf(Math.max(...hourCounts));
    const quietestHour = hourCounts.indexOf(Math.min(...hourCounts));

    // Shabbat multiplier
    const shabbatRate = shabbatCount / 27;
    const weekdayRate = weekdayCount > 0 ? weekdayCount / 141 : 0;
    const shabbatMultiplier = weekdayRate > 0 ? Math.round((shabbatRate / weekdayRate) * 10) / 10 : 0;

    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const busiestDayIdx = dayCounts.indexOf(Math.max(...dayCounts));

    // Time between alerts
    const sorted = [...alerts].sort((a, b) => a.timestamp - b.timestamp);
    const gaps: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      gaps.push(Math.round((sorted[i].timestamp - sorted[i - 1].timestamp) / 60000));
    }
    gaps.sort((a, b) => a - b);
    const medianGap = gaps.length > 0 ? gaps[Math.floor(gaps.length / 2)] : 0;

    // Quiet/active periods
    let longestQuietMs = 0;
    for (let i = 1; i < sorted.length; i++) {
      const gap = sorted[i].timestamp - sorted[i - 1].timestamp;
      if (gap > longestQuietMs) longestQuietMs = gap;
    }

    const eveningPercent = alerts.length > 0 ? Math.round((eveningCount / alerts.length) * 100) : 0;

    return {
      shabbat_vs_weekday: {
        shabbatCount,
        weekdayCount,
        multiplier: shabbatMultiplier,
        shabbatPercent: alerts.length > 0 ? Math.round((shabbatCount / alerts.length) * 100) : 0,
      },
      hourly_histogram: {
        hours: hourCounts.map((count, hour) => ({ hour, count })),
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
        days: dayCounts.map((count, i) => ({ day: i, name: dayNames[i], count })),
        busiestDay: dayNames[busiestDayIdx],
        busiestCount: dayCounts[busiestDayIdx],
      },
      threat_distribution: {
        counts: threatCounts,
        mostCommonLevel: Number(Object.entries(threatCounts).reduce((max, [l, c]) => c > max[1] ? [l, c] : max, ["0", 0])[0]),
      },
      regional_heatmap: { regions: regionCounts },
      time_between_alerts: {
        medianGapMinutes: medianGap,
        distribution: [
          { label: "<5m", max: 5, count: 0 },
          { label: "5-15m", max: 15, count: 0 },
          { label: "15-30m", max: 30, count: 0 },
          { label: "30m-1h", max: 60, count: 0 },
          { label: "1-2h", max: 120, count: 0 },
          { label: "2-6h", max: 360, count: 0 },
          { label: ">6h", max: Infinity, count: 0 },
        ].map((b) => {
          b.count = gaps.filter((g) => g < b.max && g >= (b.max === 5 ? 0 : b.max === 15 ? 5 : b.max === 30 ? 15 : b.max === 60 ? 30 : b.max === 120 ? 60 : b.max === 360 ? 120 : 360)).length;
          return b;
        }),
      },
      quiet_vs_active: {
        longestQuietHours: Math.round(longestQuietMs / (60 * 60 * 1000)),
        longestActiveHours: 0,
      },
      monthly_trends: {
        months: Object.entries(monthCounts).sort(([a], [b]) => a.localeCompare(b)).map(([month, count]) => ({ month, count })),
        monthOverMonthDelta: 0,
      },
      escalation_patterns: {
        currentRate: 0,
        baseline: 0,
        multiplier: 0,
        escalations: [],
      },
      multi_city_correlation: {
        multiRegionCount: 0,
        avgRegions: 0,
        coOccurrence: {},
      },
      geographic_spread: {
        avgRegionsPerGroup: 0,
        totalGroups: alerts.length,
      },
      totalAlerts: alerts.length,
    };
  }, [alerts, cityCoords]);
}
