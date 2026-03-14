"use client";

import { useAnalytics } from "../../../lib/hooks/use-analytics";
import { AnalyticsCard } from "../AnalyticsCard";
import { SparkLine } from "../charts/SparkLine";

interface MonthlyData {
  months: { month: string; count: number }[];
  monthOverMonthDelta: number;
}

interface MonthlyPanelProps {
  regionId: string | null;
}

export function MonthlyPanel({ regionId }: MonthlyPanelProps) {
  const { data, loading } = useAnalytics<MonthlyData>("monthly_trends", regionId);

  if (loading) {
    return <div className="h-48 bg-bg-surface rounded-[14px] animate-pulse mb-2.5" />;
  }

  const delta = data?.monthOverMonthDelta ?? 0;
  const months = data?.months ?? [];
  const latestCount = months[months.length - 1]?.count ?? 0;
  const latestMonth = months[months.length - 1]?.month ?? "—";

  const sparkData = months.map((m) => ({ value: m.count }));

  const deltaPct = Math.abs(delta).toFixed(0) + "%";
  const badge = {
    label: delta >= 0 ? `↑ ${deltaPct}` : `↓ ${deltaPct}`,
    direction: delta >= 0 ? ("up" as const) : ("down" as const),
  };

  return (
    <AnalyticsCard title="Monthly Trends" badge={badge}>
      {/* Hero */}
      <div className="px-4 pb-2">
        <div className="text-[28px] font-mono font-bold text-text-primary leading-none">
          {latestCount}
        </div>
        <div className="text-[11px] text-text-secondary font-mono mt-1">{latestMonth} alerts</div>
      </div>

      {/* Spark */}
      <div className="px-4">
        <SparkLine data={sparkData} color="#3B82F6" />
      </div>

      {/* Insight */}
      <div className="mx-4 mb-3.5 mt-2 p-3 bg-accent-blue/5 border border-accent-blue/10 rounded-[10px] text-[12px] text-text-secondary leading-relaxed">
        Month-over-month change:{" "}
        <strong className={`font-semibold ${delta >= 0 ? "text-accent-red" : "text-accent-green"}`}>
          {delta >= 0 ? "+" : ""}
          {delta.toFixed(0)}%
        </strong>{" "}
        across {months.length} months of data.
      </div>
    </AnalyticsCard>
  );
}
