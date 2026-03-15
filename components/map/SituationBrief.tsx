"use client";

import { useI18n } from "../../lib/i18n";
import { REGIONS } from "../../lib/regions";
import type { FilterState } from "../../lib/types";

interface SituationBriefProps {
  analytics: {
    totalAlerts: number;
    regional_heatmap: { regions: Record<string, number> };
    hourly_histogram: { peakHour: number };
    escalation_patterns: { currentRate: number; multiplier: number };
  };
  filter: FilterState;
}

const TIME_RANGE_LABELS: Record<string, { en: string; he: string }> = {
  "24h": { en: "24h", he: "24 שעות" },
  "7d": { en: "7d", he: "7 ימים" },
  "30d": { en: "30d", he: "30 ימים" },
  custom: { en: "range", he: "טווח" },
};

function getTopRegion(regions: Record<string, number>, lang: string): string {
  const entries = Object.entries(regions);
  if (entries.length === 0) return lang === "he" ? "לא ידוע" : "Unknown";
  const [topId] = entries.sort(([, a], [, b]) => b - a)[0];
  const region = REGIONS.find((r) => r.id === topId);
  return region ? (lang === "he" ? region.he : region.en) : topId;
}

export function SituationBrief({ analytics, filter }: SituationBriefProps) {
  const { t, lang } = useI18n();
  const isHe = lang === "he";

  const { totalAlerts, regional_heatmap, hourly_histogram, escalation_patterns } = analytics;
  const topRegion = getTopRegion(regional_heatmap.regions, lang);
  const rangeLabel = TIME_RANGE_LABELS[filter.timeRange]?.[lang] ?? filter.timeRange;
  const peakHour = `${String(hourly_histogram.peakHour).padStart(2, "0")}:00`;

  let status: string;
  if (escalation_patterns.currentRate === 0) {
    status = t("brief.quiet");
  } else if (escalation_patterns.multiplier > 2) {
    status = isHe
      ? `${t("brief.escalation")}: פי ${escalation_patterns.multiplier} מהממוצע`
      : `${t("brief.escalation")}: ${escalation_patterns.multiplier}x baseline`;
  } else {
    status = t("brief.normal");
  }

  const brief = isHe
    ? `${totalAlerts} התרעות ב-${rangeLabel}. ${topRegion} הכי פעיל. שעת שיא: ${peakHour}. ${status}.`
    : `${totalAlerts} alerts in ${rangeLabel}. ${topRegion} most active. Peak hour: ${peakHour}. ${status}.`;

  return (
    <div className="px-3 pb-1">
      <p className="text-[10px] text-text-tertiary text-center truncate font-mono">
        {brief}
      </p>
    </div>
  );
}
