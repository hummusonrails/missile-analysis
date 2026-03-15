import type { FilterState } from "./types";

type Analytics = NonNullable<ReturnType<typeof import("./hooks/use-client-analytics").useClientAnalytics>>;

// Threat type ID to human-readable name
const THREAT_NAMES: Record<number, string> = {
  0: "Rockets/Missiles",
  1: "Unknown Threat",
  2: "Infiltration/Terror",
  3: "Earthquake",
  4: "Tsunami",
  5: "Hostile Aircraft",
  6: "Hazardous Materials",
  7: "Unconventional Weapon",
  8: "Nuclear Threat",
  13: "Hostile Fire",
};

function formatTimeRange(filter: FilterState): string {
  if (filter.timeRange === "custom" && filter.customStart && filter.customEnd) {
    const start = new Date(filter.customStart).toISOString().slice(0, 10);
    const end = new Date(filter.customEnd).toISOString().slice(0, 10);
    return `Custom range: ${start} to ${end}`;
  }
  const labels: Record<string, string> = {
    "24h": "Last 24 hours",
    "7d": "Last 7 days",
    "30d": "Last 30 days",
  };
  return labels[filter.timeRange] ?? filter.timeRange;
}

function topRegions(regionCounts: Record<string, number>, n = 5): string {
  return Object.entries(regionCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, n)
    .map(([region, count], i) => `  ${i + 1}. ${region}: ${count} alerts`)
    .join("\n");
}

function formatMonthlyTrends(
  months: Array<{ month: string; count: number }>,
  delta: number
): string {
  const recent = months.slice(-6);
  const lines = recent
    .map((m) => `  ${m.month}: ${m.count}`)
    .join("\n");
  const trend =
    delta > 0
      ? `+${delta}% month-over-month (escalating)`
      : delta < 0
      ? `${delta}% month-over-month (declining)`
      : "0% month-over-month (stable)";
  return `${lines}\n  Trend: ${trend}`;
}

function formatThreatBreakdown(counts: Record<number, number>): string {
  return Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .map(([id, count]) => {
      const name = THREAT_NAMES[Number(id)] ?? `Type ${id}`;
      return `  - ${name}: ${count}`;
    })
    .join("\n");
}

function formatHourlyPeak(peakHour: number, quietestHour: number): string {
  const fmt = (h: number) =>
    `${String(h).padStart(2, "0")}:00–${String(h + 1).padStart(2, "0")}:00`;
  return `Peak: ${fmt(peakHour)}, Quietest: ${fmt(quietestHour)}`;
}

function langInstruction(lang: string): string {
  if (lang === "he") {
    return "Respond in Hebrew (עברית). Use right-to-left formatting conventions.";
  }
  return "Respond in English.";
}

export function buildSystemPrompt(
  analytics: Analytics,
  filter: FilterState,
  lang: string
): string {
  const {
    totalAlerts,
    shabbat_vs_weekday,
    hourly_histogram,
    morning_vs_evening,
    day_of_week,
    threat_distribution,
    regional_heatmap,
    time_between_alerts,
    quiet_vs_active,
    monthly_trends,
    escalation_patterns,
    multi_city_correlation,
    geographic_spread,
  } = analytics;

  const top5 = topRegions(regional_heatmap.regions);
  const busiestDay = day_of_week.busiestDay;
  const gapDist = time_between_alerts.distribution
    .map((b) => `${b.label}: ${b.count}`)
    .join(", ");

  return `You are an analyst for SirenWise, an Israeli missile alert monitoring platform.
Your role is to help users understand patterns and statistics in real-time alert data.
Be concise, specific with numbers, and do not invent data not present in the context below.

## Current Filter Context
- Time range: ${formatTimeRange(filter)}
- Region filter: ${filter.regionId ?? "All regions (nationwide)"}
- Total alerts in view: ${totalAlerts}

## 1. Shabbat vs Weekday
ANSWER: ${shabbat_vs_weekday.avgPerShabbatDay > shabbat_vs_weekday.avgPerWeekday ? `YES — Shabbat days average ${shabbat_vs_weekday.avgPerShabbatDay} alerts/day vs ${shabbat_vs_weekday.avgPerWeekday} on weekdays. Shabbat is MORE dangerous.` : shabbat_vs_weekday.avgPerShabbatDay < shabbat_vs_weekday.avgPerWeekday ? `NO — Weekdays average ${shabbat_vs_weekday.avgPerWeekday} alerts/day vs ${shabbat_vs_weekday.avgPerShabbatDay} on Shabbat days. Weekdays are MORE dangerous in this period.` : `EQUAL — both average about ${shabbat_vs_weekday.avgPerShabbatDay} alerts/day.`}
- Total Shabbat alerts: ${shabbat_vs_weekday.shabbatCount}, Total weekday alerts: ${shabbat_vs_weekday.weekdayCount}
- Ratio: ${shabbat_vs_weekday.multiplier}x

## 2. Hourly Pattern
- ${formatHourlyPeak(hourly_histogram.peakHour, hourly_histogram.quietestHour)}

## 3. Morning vs Evening
- Morning (06:00–18:00): ${morning_vs_evening.morningCount} alerts
- Evening (18:00–06:00): ${morning_vs_evening.eveningCount} alerts (${morning_vs_evening.eveningPercent}% of total)
- Conclusion: ${morning_vs_evening.eveningPercent > 50 ? `Evening/night hours are MORE dangerous (${morning_vs_evening.eveningPercent}% of alerts)` : `Morning/daytime hours have more alerts (${100 - morning_vs_evening.eveningPercent}%)`}. Safest time is around ${hourly_histogram.quietestHour}:00, most dangerous is ${hourly_histogram.peakHour}:00.

## 4. Day of Week
- Busiest day: ${busiestDay} (avg ${day_of_week.busiestCount} alerts/day)

## 5. Threat Type Breakdown
${formatThreatBreakdown(threat_distribution.counts)}
- Most common threat ID: ${threat_distribution.mostCommonLevel} (${THREAT_NAMES[threat_distribution.mostCommonLevel] ?? "Unknown"})

## 6. Top 5 Regions by Alert Count
${top5}

## 7. Time Between Alert Events
- Median gap between events: ${time_between_alerts.medianGapMinutes} minutes
- Gap distribution: ${gapDist}

## 8. Quiet vs Active Periods
- Longest quiet period: ${quiet_vs_active.longestQuietHours} hours
- Longest active period: ${quiet_vs_active.longestActiveHours} hours

## 9. Monthly Trends
${formatMonthlyTrends(monthly_trends.months, monthly_trends.monthOverMonthDelta)}

## 10. Escalation Patterns
- Current hour rate: ${escalation_patterns.currentRate} alerts
- 7-day hourly baseline: ${escalation_patterns.baseline} alerts/hour
- Escalation multiplier: ${escalation_patterns.multiplier}x
- Conclusion: ${escalation_patterns.currentRate === 0 ? "Currently QUIET — no alerts in the last hour" : escalation_patterns.multiplier > 2 ? `ESCALATING — current rate is ${escalation_patterns.multiplier}x the average` : "Current rate is NORMAL relative to the average"}

## 11. Multi-Region Correlation
- Alert groups spanning 3+ regions: ${multi_city_correlation.multiRegionCount}
- Avg regions per multi-region group: ${multi_city_correlation.avgRegions}
- Total alert groups: ${multi_city_correlation.totalGroups}

## 12. Geographic Spread
- Avg regions per alert group: ${geographic_spread.avgRegionsPerGroup}
- Total alert groups analyzed: ${geographic_spread.totalGroups}

## Threat Type Reference
${Object.entries(THREAT_NAMES)
  .map(([id, name]) => `  ${id} = ${name}`)
  .join("\n")}

## Instructions
- ${langInstruction(lang)}
- Answer only based on the data above. Do not invent statistics or events.
- When referencing numbers, be precise. Round percentages to the nearest whole number.
- Keep answers focused and concise unless the user requests detail.`;
}
