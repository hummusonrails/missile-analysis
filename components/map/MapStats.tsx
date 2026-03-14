"use client";

import { useI18n } from "../../lib/i18n";
import type { TimeRange } from "../../lib/types";

interface MapStatsProps {
  alertCount: number;
  mappedCount: number;
  regionCount: number;
  lastAlertMinutes: number | null;
  timeRange: TimeRange;
}

function formatMinutes(minutes: number | null): string {
  if (minutes === null) return "—";
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

const RANGE_LABELS: Record<TimeRange, { en: string; he: string }> = {
  "24h": { en: "Alerts", he: "התרעות" },
  "7d": { en: "Alerts (7d)", he: "התרעות (7 ימים)" },
  "30d": { en: "Alerts (30d)", he: "התרעות (30 ימים)" },
  "custom": { en: "Alerts", he: "התרעות" },
};

export function MapStats({ alertCount, mappedCount, regionCount, lastAlertMinutes, timeRange }: MapStatsProps) {
  const { t, lang } = useI18n();
  const rangeLabel = RANGE_LABELS[timeRange][lang];
  const unmapped = alertCount - mappedCount;

  return (
    <div className="flex-shrink-0">
      <div className="flex gap-2 px-3 pb-1 pt-1">
        <div className="flex-1 bg-bg-surface border border-border rounded-xl p-3 text-center">
          <div className="font-mono text-[22px] font-bold tracking-tight text-accent-red">
            {alertCount.toLocaleString()}
          </div>
          <div className="text-[9px] text-text-tertiary uppercase tracking-widest font-medium mt-0.5">
            {rangeLabel}
          </div>
        </div>

        <div className="flex-1 bg-bg-surface border border-border rounded-xl p-3 text-center">
          <div className="font-mono text-[22px] font-bold tracking-tight text-accent-amber">
            {regionCount}
          </div>
          <div className="text-[9px] text-text-tertiary uppercase tracking-widest font-medium mt-0.5">
            {t("stats.regions")}
          </div>
        </div>

        <div className="flex-1 bg-bg-surface border border-border rounded-xl p-3 text-center">
          <div className="font-mono text-[22px] font-bold tracking-tight text-accent-green">
            {formatMinutes(lastAlertMinutes)}
          </div>
          <div className="text-[9px] text-text-tertiary uppercase tracking-widest font-medium mt-0.5">
            {t("stats.lastAlert")}
          </div>
        </div>
      </div>
      {unmapped > 0 && (
        <div className="px-3 pb-1.5">
          <div className="text-[9px] font-mono text-text-tertiary/50 text-center">
            {lang === "he"
              ? `${mappedCount.toLocaleString()} מוצגים על המפה · ${unmapped.toLocaleString()} ללא מיקום ידוע`
              : `${mappedCount.toLocaleString()} shown on map · ${unmapped.toLocaleString()} in areas without coordinates`}
          </div>
        </div>
      )}
    </div>
  );
}
