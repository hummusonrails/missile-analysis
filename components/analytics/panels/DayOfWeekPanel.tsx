"use client";

import { useAnalytics } from "../../../lib/hooks/use-analytics";
import { AnalyticsCard } from "../AnalyticsCard";
import { MiniBarChart } from "../charts/MiniBarChart";

interface DayData {
  days: { day: number; name: string; count: number }[];
  busiestDay: string;
  busiestCount: number;
}

interface DayOfWeekPanelProps {
  regionId: string | null;
}

export function DayOfWeekPanel({ regionId }: DayOfWeekPanelProps) {
  const { data, loading } = useAnalytics<DayData>("day_of_week", regionId);

  if (loading) {
    return <div className="h-48 bg-bg-surface rounded-[14px] animate-pulse mb-2.5" />;
  }

  const busiestDay = data?.busiestDay ?? "—";
  const busiestCount = data?.busiestCount ?? 0;
  const days = data?.days ?? [];

  // Normalize to 7 bars Sun(0)–Sat(6)
  const chartData = Array.from({ length: 7 }, (_, i) => {
    const day = days.find((d) => d.day === i);
    return {
      name: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][i],
      value: day?.count ?? 0,
    };
  });

  const highlightIdx = chartData.reduce(
    (maxI, d, i, arr) => (d.value > arr[maxI].value ? i : maxI),
    0
  );

  return (
    <AnalyticsCard title="Day of Week">
      {/* Hero */}
      <div className="px-4 pb-2">
        <div className="text-[28px] font-mono font-bold text-text-primary leading-none">
          {busiestDay}
        </div>
        <div className="text-[11px] text-text-secondary font-mono mt-1">
          busiest day · {busiestCount} alerts
        </div>
      </div>

      {/* Chart */}
      <div className="px-4">
        <MiniBarChart
          data={chartData}
          highlightIndices={[highlightIdx]}
          color="#3B82F6"
          highlightColor="#EF4444"
        />
        <div className="flex justify-between mt-1">
          {chartData.map((d) => (
            <span key={d.name} className="text-[9px] text-text-tertiary font-mono">{d.name}</span>
          ))}
        </div>
      </div>

      {/* Insight */}
      <div className="mx-4 mb-3.5 mt-2 p-3 bg-accent-blue/5 border border-accent-blue/10 rounded-[10px] text-[12px] text-text-secondary leading-relaxed">
        <strong className="text-accent-blue font-semibold">{busiestDay}</strong> is the most active
        day with{" "}
        <strong className="text-accent-red font-semibold">{busiestCount}</strong> alerts.
      </div>
    </AnalyticsCard>
  );
}
