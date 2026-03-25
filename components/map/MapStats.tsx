"use client";

import { useI18n } from "../../lib/i18n";
import type { TimeRange, PreAlert } from "../../lib/types";

interface MapStatsProps {
  alertCount: number;
  mappedCount: number;
  regionCount: number;
  lastAlertMinutes: number | null;
  timeRange: TimeRange;
  preAlerts: PreAlert[];
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

export function MapStats({ alertCount, mappedCount, regionCount, lastAlertMinutes, timeRange, preAlerts }: MapStatsProps) {
  const { t, lang } = useI18n();
  const rangeLabel = RANGE_LABELS[timeRange][lang];
  const unmapped = alertCount - mappedCount;
  const warningCount = preAlerts.filter((pa) => pa.alert_type === "early_warning").length;
  const exitCount = preAlerts.filter((pa) => pa.alert_type === "exit_notification").length;
  const hasPreAlerts = preAlerts.length > 0;

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

        {hasPreAlerts ? (
          <div className="flex-1 bg-bg-surface border border-amber-500/20 rounded-xl p-3 text-center">
            <div className="font-mono text-[22px] font-bold tracking-tight text-amber-400">
              {warningCount}
            </div>
            <div className="text-[9px] text-amber-400/70 uppercase tracking-widest font-medium mt-0.5">
              {t("stats.preAlerts")}
            </div>
          </div>
        ) : (
          <div className="flex-1 bg-bg-surface border border-border rounded-xl p-3 text-center">
            <div className="font-mono text-[22px] font-bold tracking-tight text-accent-green">
              {formatMinutes(lastAlertMinutes)}
            </div>
            <div className="text-[9px] text-text-tertiary uppercase tracking-widest font-medium mt-0.5">
              {t("stats.lastAlert")}
            </div>
          </div>
        )}
      </div>

      {/* Pre-alert ticker */}
      {hasPreAlerts && (
        <div className="px-3 pb-1">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/5 border border-amber-500/15 rounded-lg">
            <span className="text-amber-400 text-[11px]">⚠</span>
            <span className="text-[10px] text-amber-300/80 font-mono">
              {lang === "he"
                ? `${warningCount} אזהרות מוקדמות · ${exitCount} סיומי אירוע`
                : `${warningCount} early warning${warningCount !== 1 ? "s" : ""} · ${exitCount} all-clear${exitCount !== 1 ? "s" : ""}`}
            </span>
            <span className="text-[10px] text-text-tertiary font-mono ms-auto">
              {formatMinutes(lastAlertMinutes)} {lang === "he" ? "מהתרעה" : "since alert"}
            </span>
          </div>
        </div>
      )}
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
