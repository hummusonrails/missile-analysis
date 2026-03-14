"use client";

import { useAnalytics } from "../../../lib/hooks/use-analytics";
import { AnalyticsCard } from "../AnalyticsCard";
import { ComparisonBar } from "../charts/ComparisonBar";

interface AmPmData {
  morningCount: number;
  eveningCount: number;
  eveningPercent: number;
  peakHour: number;
  quietestHour: number;
}

interface AmPmPanelProps {
  regionId: string | null;
}

export function AmPmPanel({ regionId }: AmPmPanelProps) {
  const { data, loading } = useAnalytics<AmPmData>("morning_vs_evening", regionId);

  if (loading) {
    return <div className="h-48 bg-bg-surface rounded-[14px] animate-pulse mb-2.5" />;
  }

  const eveningPct = data?.eveningPercent ?? 0;
  const morningCount = data?.morningCount ?? 0;
  const eveningCount = data?.eveningCount ?? 0;
  const peakHour = data?.peakHour ?? 0;
  const quietestHour = data?.quietestHour ?? 0;

  const peakLabel = `${String(peakHour).padStart(2, "0")}:00`;
  const quietLabel = `${String(quietestHour).padStart(2, "0")}:00`;

  return (
    <AnalyticsCard title="AM vs PM">
      {/* Hero */}
      <div className="px-4 pb-2">
        <div className="text-[28px] font-mono font-bold text-text-primary leading-none">
          {eveningPct.toFixed(0)}
          <span className="text-[16px] text-text-secondary ml-0.5">%</span>
        </div>
        <div className="text-[11px] text-text-secondary font-mono mt-1">evening alerts (12:00–23:59)</div>
      </div>

      {/* Comparison bar */}
      <ComparisonBar
        leftValue={morningCount}
        rightValue={eveningCount}
        leftLabel="Morning"
        rightLabel="Evening"
        leftColor="#3B82F6"
        rightColor="#F59E0B"
      />

      {/* Insight */}
      <div className="mx-4 mb-3.5 p-3 bg-accent-blue/5 border border-accent-blue/10 rounded-[10px] text-[12px] text-text-secondary leading-relaxed">
        Peak hour: <strong className="text-accent-blue font-semibold">{peakLabel}</strong>. Quietest
        hour: <strong className="text-accent-blue font-semibold">{quietLabel}</strong>.
        Evenings account for{" "}
        <strong className="text-accent-amber font-semibold">{eveningPct.toFixed(0)}%</strong> of
        total alerts.
      </div>
    </AnalyticsCard>
  );
}
