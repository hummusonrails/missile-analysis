"use client";

import { useAnalytics } from "../../../lib/hooks/use-analytics";
import { AnalyticsCard } from "../AnalyticsCard";
import { StatRow } from "../charts/StatRow";

interface QuietData {
  longestQuietHours: number;
  longestActiveHours: number;
  avgQuietHours?: number;
  quietPeriodCount?: number;
}

interface QuietPeriodsPanelProps {
  regionId: string | null;
}

export function QuietPeriodsPanel({ regionId }: QuietPeriodsPanelProps) {
  const { data, loading } = useAnalytics<QuietData>("quiet_vs_active", regionId);

  if (loading) {
    return <div className="h-48 bg-bg-surface rounded-[14px] animate-pulse mb-2.5" />;
  }

  const quietHours = data?.longestQuietHours ?? 0;
  const activeHours = data?.longestActiveHours ?? 0;

  return (
    <AnalyticsCard title="Quiet Periods">
      {/* Hero */}
      <div className="px-4 pb-2">
        <div className="text-[28px] font-mono font-bold text-accent-green leading-none">
          {quietHours.toFixed(1)}h
        </div>
        <div className="text-[11px] text-text-secondary font-mono mt-1">longest quiet stretch</div>
      </div>

      <StatRow
        label="Longest quiet period"
        sublabel="consecutive hours without alerts"
        value={`${quietHours.toFixed(1)}h`}
        color="#10B981"
      />
      <StatRow
        label="Longest active period"
        sublabel="consecutive hours with alerts"
        value={`${activeHours.toFixed(1)}h`}
        color="#EF4444"
      />
      {data?.avgQuietHours != null && (
        <StatRow
          label="Avg quiet gap"
          sublabel="between alert clusters"
          value={`${data.avgQuietHours.toFixed(1)}h`}
        />
      )}

      {/* Insight */}
      <div className="mx-4 mb-3.5 mt-2 p-3 bg-accent-blue/5 border border-accent-blue/10 rounded-[10px] text-[12px] text-text-secondary leading-relaxed">
        Longest pause between alerts:{" "}
        <strong className="text-accent-green font-semibold">{quietHours.toFixed(1)} hours</strong>.
        Longest sustained activity:{" "}
        <strong className="text-accent-red font-semibold">{activeHours.toFixed(1)} hours</strong>.
      </div>
    </AnalyticsCard>
  );
}
