import type { Alert } from "../../lib/types";

const ISRAEL_TZ = "Asia/Jerusalem";

function toIsraelDate(timestamp: number): Date {
  return new Date(new Date(timestamp).toLocaleString("en-US", { timeZone: ISRAEL_TZ }));
}

function getIsraelHour(timestamp: number): number {
  return toIsraelDate(timestamp).getHours();
}

function getIsraelDay(timestamp: number): number {
  return toIsraelDate(timestamp).getDay();
}

function isShabbat(timestamp: number): boolean {
  const d = toIsraelDate(timestamp);
  const day = d.getDay();
  const hour = d.getHours();
  if (day === 5 && hour >= 18) return true;
  if (day === 6 && hour <= 21) return true;
  return false;
}

export function computeHourlyHistogram(alerts: Alert[]) {
  const hours = Array.from({ length: 24 }, (_, i) => ({ hour: i, count: 0 }));
  for (const alert of alerts) {
    const h = getIsraelHour(alert.timestamp);
    hours[h].count++;
  }
  const peakHour = hours.reduce((max, h) => (h.count > max.count ? h : max), hours[0]);
  const quietestHour = hours.reduce((min, h) => (h.count < min.count ? h : min), hours[0]);
  return { hours, peakHour: peakHour.hour, quietestHour: quietestHour.hour };
}

export function computeShabbatVsWeekday(alerts: Alert[]) {
  let shabbatCount = 0;
  let weekdayCount = 0;
  for (const alert of alerts) {
    if (isShabbat(alert.timestamp)) shabbatCount++;
    else weekdayCount++;
  }
  const shabbatRate = shabbatCount / 27;
  const weekdayRate = weekdayCount > 0 ? weekdayCount / 141 : 0;
  const multiplier = weekdayRate > 0 ? Math.round((shabbatRate / weekdayRate) * 10) / 10 : 0;
  const shabbatPercent = alerts.length > 0 ? Math.round((shabbatCount / alerts.length) * 100) : 0;
  return { shabbatCount, weekdayCount, multiplier, shabbatPercent };
}

export function computeMorningVsEvening(alerts: Alert[]) {
  let morningCount = 0;
  let eveningCount = 0;
  const hourCounts = new Array(24).fill(0);
  for (const alert of alerts) {
    const h = getIsraelHour(alert.timestamp);
    hourCounts[h]++;
    if (h >= 6 && h < 18) morningCount++;
    else eveningCount++;
  }
  const peakHour = hourCounts.indexOf(Math.max(...hourCounts));
  const quietestHour = hourCounts.indexOf(Math.min(...hourCounts));
  const eveningPercent = alerts.length > 0 ? Math.round((eveningCount / alerts.length) * 100) : 0;
  return { morningCount, eveningCount, eveningPercent, peakHour, quietestHour };
}

export function computeDayOfWeek(alerts: Alert[]) {
  const days = Array.from({ length: 7 }, (_, i) => ({ day: i, count: 0 }));
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  for (const alert of alerts) {
    const d = getIsraelDay(alert.timestamp);
    days[d].count++;
  }
  const busiest = days.reduce((max, d) => (d.count > max.count ? d : max), days[0]);
  return {
    days: days.map((d) => ({ ...d, name: dayNames[d.day] })),
    busiestDay: dayNames[busiest.day],
    busiestCount: busiest.count,
  };
}

export function computeMonthlyTrends(alerts: Alert[]) {
  const months: Record<string, number> = {};
  for (const alert of alerts) {
    const d = toIsraelDate(alert.timestamp);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    months[key] = (months[key] || 0) + 1;
  }
  const sorted = Object.entries(months).sort(([a], [b]) => a.localeCompare(b)).map(([month, count]) => ({ month, count }));
  const len = sorted.length;
  const delta = len >= 2 ? Math.round(((sorted[len - 1].count - sorted[len - 2].count) / sorted[len - 2].count) * 100) : 0;
  return { months: sorted, monthOverMonthDelta: delta };
}

export function computeRegionalHeatmap(alerts: Alert[], cityRegionMap: Map<string, string>) {
  const regionCounts: Record<string, number> = {};
  for (const alert of alerts) {
    const regions = new Set<string>();
    for (const city of alert.cities) {
      const region = cityRegionMap.get(city);
      if (region) regions.add(region);
    }
    for (const region of regions) {
      regionCounts[region] = (regionCounts[region] || 0) + 1;
    }
  }
  return { regions: regionCounts };
}

export function computeThreatDistribution(alerts: Alert[]) {
  const counts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
  for (const alert of alerts) {
    counts[alert.threat] = (counts[alert.threat] || 0) + 1;
  }
  const mostCommon = Object.entries(counts).reduce((max, [level, count]) => count > max[1] ? [level, count] : max, ["0", 0]);
  return { counts, mostCommonLevel: Number(mostCommon[0]) };
}

export function computeEscalationPatterns(alerts: Alert[]) {
  if (alerts.length === 0) return { currentRate: 0, baseline: 0, multiplier: 0, escalations: [] };
  const sorted = [...alerts].sort((a, b) => a.timestamp - b.timestamp);
  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
  const recentAlerts = sorted.filter((a) => a.timestamp >= thirtyDaysAgo);
  const totalHours = Math.max(1, (now - thirtyDaysAgo) / (60 * 60 * 1000));
  const baseline = recentAlerts.length / totalHours;
  const oneHourAgo = now - 60 * 60 * 1000;
  const currentRate = sorted.filter((a) => a.timestamp >= oneHourAgo).length;
  const multiplier = baseline > 0 ? Math.round((currentRate / baseline) * 10) / 10 : 0;
  const escalations: { start: number; end: number; rate: number }[] = [];
  const hourBuckets: Record<number, number> = {};
  for (const alert of recentAlerts) {
    const hourKey = Math.floor(alert.timestamp / (60 * 60 * 1000));
    hourBuckets[hourKey] = (hourBuckets[hourKey] || 0) + 1;
  }
  let escStart: number | null = null;
  for (const [hourStr, count] of Object.entries(hourBuckets).sort(([a], [b]) => Number(a) - Number(b))) {
    const hour = Number(hourStr);
    if (count > baseline * 2) {
      if (escStart === null) escStart = hour * 60 * 60 * 1000;
    } else if (escStart !== null) {
      escalations.push({ start: escStart, end: hour * 60 * 60 * 1000, rate: count });
      escStart = null;
    }
  }
  return { currentRate, baseline: Math.round(baseline * 10) / 10, multiplier, escalations };
}

export function computeQuietVsActive(alerts: Alert[]) {
  if (alerts.length < 2) return { longestQuietHours: 0, longestActiveHours: 0 };
  const sorted = [...alerts].sort((a, b) => a.timestamp - b.timestamp);
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    gaps.push(sorted[i].timestamp - sorted[i - 1].timestamp);
  }
  const longestQuietMs = Math.max(...gaps);
  const longestQuietHours = Math.round(longestQuietMs / (60 * 60 * 1000));
  let activeStart = sorted[0].timestamp;
  let longestActiveMs = 0;
  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i].timestamp - sorted[i - 1].timestamp;
    if (gap > 30 * 60 * 1000) {
      const duration = sorted[i - 1].timestamp - activeStart;
      if (duration > longestActiveMs) longestActiveMs = duration;
      activeStart = sorted[i].timestamp;
    }
  }
  const lastDuration = sorted[sorted.length - 1].timestamp - activeStart;
  if (lastDuration > longestActiveMs) longestActiveMs = lastDuration;
  const longestActiveHours = Math.round(longestActiveMs / (60 * 60 * 1000));
  return { longestQuietHours, longestActiveHours };
}

export function computeMultiCityCorrelation(alerts: Alert[], cityRegionMap: Map<string, string>) {
  const groups: Record<string, Set<string>> = {};
  for (const alert of alerts) {
    const groupId = alert.id.split("_")[0];
    if (!groups[groupId]) groups[groupId] = new Set();
    for (const city of alert.cities) {
      const region = cityRegionMap.get(city);
      if (region) groups[groupId].add(region);
    }
  }
  const multiRegionEvents = Object.entries(groups).filter(([, regions]) => regions.size >= 3);
  const avgRegions = multiRegionEvents.length > 0
    ? Math.round((multiRegionEvents.reduce((sum, [, r]) => sum + r.size, 0) / multiRegionEvents.length) * 10) / 10
    : 0;
  const coOccurrence: Record<string, Record<string, number>> = {};
  for (const [, regions] of multiRegionEvents) {
    const arr = Array.from(regions);
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        if (!coOccurrence[arr[i]]) coOccurrence[arr[i]] = {};
        coOccurrence[arr[i]][arr[j]] = (coOccurrence[arr[i]][arr[j]] || 0) + 1;
      }
    }
  }
  return { multiRegionCount: multiRegionEvents.length, avgRegions, coOccurrence };
}

export function computeTimeBetweenAlerts(alerts: Alert[]) {
  if (alerts.length < 2) return { medianGapMinutes: 0, distribution: [] };
  const sorted = [...alerts].sort((a, b) => a.timestamp - b.timestamp);
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    gaps.push(Math.round((sorted[i].timestamp - sorted[i - 1].timestamp) / 60000));
  }
  gaps.sort((a, b) => a - b);
  const median = gaps[Math.floor(gaps.length / 2)];
  const buckets = [
    { label: "<5m", max: 5, count: 0 },
    { label: "5-15m", max: 15, count: 0 },
    { label: "15-30m", max: 30, count: 0 },
    { label: "30m-1h", max: 60, count: 0 },
    { label: "1-2h", max: 120, count: 0 },
    { label: "2-6h", max: 360, count: 0 },
    { label: "6-12h", max: 720, count: 0 },
    { label: "12-24h", max: 1440, count: 0 },
    { label: ">24h", max: Infinity, count: 0 },
  ];
  for (const gap of gaps) {
    const bucket = buckets.find((b) => gap < b.max);
    if (bucket) bucket.count++;
  }
  return { medianGapMinutes: median, distribution: buckets };
}

export function computeGeographicSpread(alerts: Alert[], cityRegionMap: Map<string, string>) {
  const groups: Record<string, Set<string>> = {};
  for (const alert of alerts) {
    const groupId = alert.id.split("_")[0];
    if (!groups[groupId]) groups[groupId] = new Set();
    for (const city of alert.cities) {
      const region = cityRegionMap.get(city);
      if (region) groups[groupId].add(region);
    }
  }
  const spreads = Object.values(groups).map((r) => r.size);
  const avgSpread = spreads.length > 0 ? Math.round((spreads.reduce((a, b) => a + b, 0) / spreads.length) * 10) / 10 : 0;
  return { avgRegionsPerGroup: avgSpread, totalGroups: spreads.length };
}

export function computeAllAnalytics(alerts: Alert[], cityRegionMap: Map<string, string>): Record<string, object> {
  return {
    hourly_histogram: computeHourlyHistogram(alerts),
    day_of_week: computeDayOfWeek(alerts),
    shabbat_vs_weekday: computeShabbatVsWeekday(alerts),
    morning_vs_evening: computeMorningVsEvening(alerts),
    monthly_trends: computeMonthlyTrends(alerts),
    regional_heatmap: computeRegionalHeatmap(alerts, cityRegionMap),
    threat_distribution: computeThreatDistribution(alerts),
    escalation_patterns: computeEscalationPatterns(alerts),
    quiet_vs_active: computeQuietVsActive(alerts),
    multi_city_correlation: computeMultiCityCorrelation(alerts, cityRegionMap),
    time_between_alerts: computeTimeBetweenAlerts(alerts),
    geographic_spread: computeGeographicSpread(alerts, cityRegionMap),
  };
}

export function computeRegionAnalytics(alerts: Alert[], regionId: string, cityRegionMap: Map<string, string>): Record<string, object> {
  const regionAlerts = alerts.filter((a) => a.cities.some((city) => cityRegionMap.get(city) === regionId));
  const all = computeAllAnalytics(regionAlerts, cityRegionMap);
  delete (all as Record<string, unknown>).regional_heatmap;
  return all;
}
