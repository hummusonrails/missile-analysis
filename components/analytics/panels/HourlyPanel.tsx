"use client";

import { useAnalytics } from "../../../lib/hooks/use-analytics";
import { AnalyticsCard } from "../AnalyticsCard";
import { MiniBarChart } from "../charts/MiniBarChart";

interface HourlyData {
  hours: { hour: number; count: number }[];
  peakHour: number;
  quietestHour: number;
}

interface HourlyPanelProps {
  regionId: string | null;
}

export function HourlyPanel({ regionId }: HourlyPanelProps) {
  const { data, loading } = useAnalytics<HourlyData>("hourly_histogram", regionId);

  if (loading) {
    return <div className="h-48 bg-bg-surface rounded-[14px] animate-pulse mb-2.5" />;
  }

  const peakHour = data?.peakHour ?? 0;
  const quietestHour = data?.quietestHour ?? 0;

  const hourData = Array.from({ length: 24 }, (_, i) => ({
    name: `${i}:00`,
    value: data?.hours?.find((h) => h.hour === i)?.count ?? 0,
  }));

  const peakLabel = `${String(peakHour).padStart(2, "0")}:00`;
  const quietLabel = `${String(quietestHour).padStart(2, "0")}:00`;

  return (
    <AnalyticsCard title="Hourly Pattern">
      {/* Hero */}
      <div className="px-4 pb-2">
        <div className="text-[28px] font-mono font-bold text-text-primary leading-none">
          {peakLabel}
        </div>
        <div className="text-[11px] text-text-secondary font-mono mt-1">peak alert hour</div>
      </div>

      {/* Chart */}
      <div className="px-4">
        <MiniBarChart
          data={hourData}
          highlightIndices={[peakHour]}
          color="#3B82F6"
          highlightColor="#EF4444"
        />
      </div>

      {/* Insight */}
      <div className="mx-4 mb-3.5 mt-2 p-3 bg-accent-blue/5 border border-accent-blue/10 rounded-[10px] text-[12px] text-text-secondary leading-relaxed">
        Peak activity at{" "}
        <strong className="text-accent-blue font-semibold">{peakLabel}</strong>. Quietest hour:{" "}
        <strong className="text-accent-blue font-semibold">{quietLabel}</strong>.
      </div>
    </AnalyticsCard>
  );
}
