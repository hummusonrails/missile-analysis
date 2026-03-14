"use client";

import { useAnalytics } from "../../../lib/hooks/use-analytics";
import { AnalyticsCard } from "../AnalyticsCard";
import { MiniBarChart } from "../charts/MiniBarChart";

interface ShabbatData {
  shabbatCount: number;
  weekdayCount: number;
  multiplier: number;
  shabbatPercent: number;
  days?: { day: number; count: number }[];
}

interface ShabbatPanelProps {
  regionId: string | null;
}

export function ShabbatPanel({ regionId }: ShabbatPanelProps) {
  const { data, loading } = useAnalytics<ShabbatData>("shabbat_vs_weekday", regionId);

  if (loading) {
    return <div className="h-48 bg-bg-surface rounded-[14px] animate-pulse mb-2.5" />;
  }

  const multiplier = data?.multiplier ?? 0;
  const shabbatCount = data?.shabbatCount ?? 0;
  const weekdayCount = data?.weekdayCount ?? 0;

  // Build 7-bar chart (Sun=0 … Sat=6), highlighting Fri(5) and Sat(6)
  const dayData = Array.from({ length: 7 }, (_, i) => ({
    name: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][i],
    value: data?.days?.find((d) => d.day === i)?.count ?? 0,
  }));

  const badge =
    multiplier >= 1.5
      ? { label: `${multiplier.toFixed(1)}x`, direction: "up" as const }
      : undefined;

  return (
    <AnalyticsCard title="Shabbat vs Weekday" badge={badge}>
      {/* Hero */}
      <div className="flex items-start justify-between px-4 pb-2">
        <div>
          <div className="text-[28px] font-mono font-bold text-text-primary leading-none">
            {shabbatCount}
          </div>
          <div className="text-[11px] text-text-secondary font-mono mt-1">Shabbat alerts</div>
        </div>
        <div className="text-right">
          <div className="text-[28px] font-mono font-bold text-text-tertiary leading-none">
            {weekdayCount}
          </div>
          <div className="text-[11px] text-text-secondary font-mono mt-1">Weekday alerts</div>
        </div>
      </div>

      {/* Chart */}
      <div className="px-4">
        <MiniBarChart data={dayData} highlightIndices={[5, 6]} color="#3B82F6" highlightColor="#F59E0B" />
      </div>

      {/* Insight */}
      <div className="mx-4 mb-3.5 mt-2 p-3 bg-accent-blue/5 border border-accent-blue/10 rounded-[10px] text-[12px] text-text-secondary leading-relaxed">
        Shabbat (Fri–Sat) accounts for{" "}
        <strong className="text-accent-blue font-semibold">
          {data?.shabbatPercent?.toFixed(0) ?? "–"}%
        </strong>{" "}
        of alerts — <strong className="text-accent-blue font-semibold">{multiplier.toFixed(1)}x</strong> the weekday average.
      </div>
    </AnalyticsCard>
  );
}
