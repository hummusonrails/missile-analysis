"use client";

import { useMemo, useState, useCallback, useEffect } from "react";

export interface Finding {
  id: string;
  type: string;
  severity: Severity;
  titleKey: string;
  descKey: string;
}

type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "INFO";

interface AnalyticsInput {
  totalAlerts: number;
  escalation_patterns: { currentRate: number; multiplier: number; baseline: number };
  monthly_trends: { months: Array<{ month: string; count: number }>; monthOverMonthDelta: number };
  shabbat_vs_weekday: { multiplier: number; shabbatCount: number; weekdayCount: number };
  hourly_histogram: { peakHour: number; quietestHour: number };
  morning_vs_evening: { eveningPercent: number };
  day_of_week: { busiestDay: string; busiestCount: number };
  regional_heatmap: { regions: Record<string, number> };
  quiet_vs_active: { longestQuietHours: number; longestActiveHours: number };
}

const LS_KEY = "sirenwise-seen-findings";

function todayBucket(): string {
  return new Date().toISOString().slice(0, 10);
}

function pruneOldSeen(seen: string[]): string[] {
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return seen.filter((id) => {
    const dateStr = id.split(":").slice(1).join(":");
    const ts = new Date(dateStr).getTime();
    return !isNaN(ts) && ts >= cutoff;
  });
}

function loadSeen(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return pruneOldSeen(parsed);
  } catch {
    return [];
  }
}

function saveSeen(seen: string[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LS_KEY, JSON.stringify(seen));
}

export function useFindings(analytics: AnalyticsInput | null) {
  const [seen, setSeen] = useState<string[]>([]);

  useEffect(() => {
    setSeen(loadSeen());
  }, []);

  const findings = useMemo<Finding[]>(() => {
    if (!analytics) return [];
    const bucket = todayBucket();
    const result: Finding[] = [];

    // CRITICAL: Escalation — rate well above baseline
    if (analytics.escalation_patterns.multiplier > 2 && analytics.escalation_patterns.baseline > 0) {
      result.push({
        id: `escalation:${bucket}`,
        type: "escalation",
        severity: "CRITICAL",
        titleKey: "findings.escalation",
        descKey: "findings.escalation.desc",
      });
    }

    // HIGH: Many alerts in the last hour
    if (analytics.escalation_patterns.currentRate >= 10) {
      result.push({
        id: `highActivity:${bucket}`,
        type: "highActivity",
        severity: "HIGH",
        titleKey: "findings.highActivity",
        descKey: "findings.highActivity.desc",
      });
    }

    // HIGH: Monthly trend surge
    const months = analytics.monthly_trends.months;
    if (months.length >= 2 && analytics.monthly_trends.monthOverMonthDelta > 50) {
      const currentMonth = months[months.length - 1].month;
      const currentDay = new Date().getDate();
      const isCurrentMonth = currentMonth === new Date().toISOString().slice(0, 7);
      if (!isCurrentMonth || currentDay >= 7) {
        result.push({
          id: `monthlyTrend:${bucket}`,
          type: "monthlyTrend",
          severity: "HIGH",
          titleKey: "findings.monthlyTrend",
          descKey: "findings.monthlyTrend.desc",
        });
      }
    }

    // MEDIUM: Shabbat pattern shift
    if (analytics.shabbat_vs_weekday.multiplier > 2 || (analytics.shabbat_vs_weekday.multiplier > 0 && analytics.shabbat_vs_weekday.multiplier < 0.5)) {
      result.push({
        id: `shabbatShift:${bucket}`,
        type: "shabbatShift",
        severity: "MEDIUM",
        titleKey: "findings.shabbatShift",
        descKey: "findings.shabbatShift.desc",
      });
    }

    // INFO: Active alerts — always shows when there's any recent activity
    if (analytics.escalation_patterns.currentRate > 0) {
      result.push({
        id: `activeAlerts:${bucket}`,
        type: "activeAlerts",
        severity: "INFO",
        titleKey: "findings.activeAlerts",
        descKey: "findings.activeAlerts.desc",
      });
    }

    // INFO: Peak hour insight — always present when there's data
    if (analytics.totalAlerts > 0) {
      result.push({
        id: `peakHour:${bucket}`,
        type: "peakHour",
        severity: "INFO",
        titleKey: "findings.peakHour",
        descKey: "findings.peakHour.desc",
      });
    }

    // INFO: Night dominance — evening alerts > 60%
    if (analytics.morning_vs_evening.eveningPercent > 60) {
      result.push({
        id: `nightDominance:${bucket}`,
        type: "nightDominance",
        severity: "MEDIUM",
        titleKey: "findings.nightDominance",
        descKey: "findings.nightDominance.desc",
      });
    }

    // INFO: Regional concentration — top region has 40%+ of all alerts
    const regionEntries = Object.entries(analytics.regional_heatmap.regions);
    if (regionEntries.length > 1 && analytics.totalAlerts > 0) {
      const topCount = Math.max(...regionEntries.map(([, c]) => c));
      const topPercent = Math.round((topCount / analytics.totalAlerts) * 100);
      if (topPercent >= 40) {
        result.push({
          id: `regionalConcentration:${bucket}`,
          type: "regionalConcentration",
          severity: "INFO",
          titleKey: "findings.regionalConcentration",
          descKey: "findings.regionalConcentration.desc",
        });
      }
    }

    // MEDIUM: Extended quiet broken — long quiet period in data
    if (analytics.quiet_vs_active.longestQuietHours >= 12) {
      result.push({
        id: `longQuiet:${bucket}`,
        type: "longQuiet",
        severity: "INFO",
        titleKey: "findings.longQuiet",
        descKey: "findings.longQuiet.desc",
      });
    }

    return result;
  }, [analytics]);

  const unseenCount = useMemo(() => {
    const seenSet = new Set(seen);
    return findings.filter((f) => !seenSet.has(f.id)).length;
  }, [findings, seen]);

  const markAllSeen = useCallback(() => {
    const ids = findings.map((f) => f.id);
    const merged = [...new Set([...seen, ...ids])];
    setSeen(merged);
    saveSeen(merged);
  }, [findings, seen]);

  return { findings, unseenCount, markAllSeen };
}
