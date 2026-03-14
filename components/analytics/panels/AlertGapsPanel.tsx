"use client";

import { useAnalytics } from "../../../lib/hooks/use-analytics";
import { AnalyticsCard } from "../AnalyticsCard";
import { MiniBarChart } from "../charts/MiniBarChart";

interface GapData {
  medianGapMinutes: number;
  distribution: { label: string; count: number }[];
}

interface AlertGapsPanelProps {
  regionId: string | null;
}

export function AlertGapsPanel({ regionId }: AlertGapsPanelProps) {
  const { data, loading } = useAnalytics<GapData>("time_between_alerts", regionId);

  if (loading) {
    return <div className="h-48 bg-bg-surface rounded-[14px] animate-pulse mb-2.5" />;
  }

  const medianGap = data?.medianGapMinutes ?? 0;
  const distribution = data?.distribution ?? [];

  const chartData = distribution.map((d) => ({ name: d.label, value: d.count }));
  const maxIdx = chartData.reduce(
    (maxI, d, i, arr) => (d.value > arr[maxI].value ? i : maxI),
    0
  );

  return (
    <AnalyticsCard title="Alert Gaps">
      {/* Hero */}
      <div className="px-4 pb-2">
        <div className="text-[28px] font-mono font-bold text-text-primary leading-none">
          {medianGap.toFixed(0)}
          <span className="text-[16px] text-text-secondary ml-1">min</span>
        </div>
        <div className="text-[11px] text-text-secondary font-mono mt-1">median gap between alerts</div>
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="px-4">
          <MiniBarChart
            data={chartData}
            highlightIndices={[maxIdx]}
            color="#3B82F6"
            highlightColor="#F59E0B"
          />
          <div className="flex justify-between mt-1">
            {distribution.slice(0, 4).map((d, i) => (
              <span key={i} className="text-[9px] text-text-tertiary font-mono">{d.label}</span>
            ))}
          </div>
        </div>
      )}

      {/* Insight */}
      <div className="mx-4 mb-3.5 mt-2 p-3 bg-accent-blue/5 border border-accent-blue/10 rounded-[10px] text-[12px] text-text-secondary leading-relaxed">
        Half of all alerts occur within{" "}
        <strong className="text-accent-blue font-semibold">{medianGap.toFixed(0)} minutes</strong>{" "}
        of each other. Most common gap bucket:{" "}
        <strong className="text-accent-blue font-semibold">
          {distribution[maxIdx]?.label ?? "—"}
        </strong>.
      </div>
    </AnalyticsCard>
  );
}
