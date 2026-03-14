"use client";

import { useI18n } from "../../lib/i18n";

interface MapStatsProps {
  alertCount: number;
  regionCount: number;
  lastAlertMinutes: number | null;
}

function formatMinutes(minutes: number | null): string {
  if (minutes === null) return "—";
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function MapStats({ alertCount, regionCount, lastAlertMinutes }: MapStatsProps) {
  const { t } = useI18n();

  return (
    <div className="flex gap-2 px-3 pb-2 pt-1 flex-shrink-0">
      <div className="flex-1 bg-bg-surface border border-border rounded-xl p-3 text-center">
        <div className="font-mono text-[22px] font-bold tracking-tight text-accent-red">
          {alertCount.toLocaleString()}
        </div>
        <div className="text-[9px] text-text-tertiary uppercase tracking-widest font-medium mt-0.5">
          {t("stats.today")}
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
  );
}
