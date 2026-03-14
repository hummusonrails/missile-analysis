"use client";

import { useAnalytics } from "../../../lib/hooks/use-analytics";
import { AnalyticsCard } from "../AnalyticsCard";
import { DonutChart } from "../charts/DonutChart";
import { StatRow } from "../charts/StatRow";

interface ThreatData {
  counts: Record<number, number>;
  mostCommonLevel: number;
}

interface ThreatPanelProps {
  regionId: string | null;
}

const THREAT_COLORS = ["#3D4B5F", "#10B981", "#F59E0B", "#EF4444"];
const THREAT_LABELS = ["Level 0", "Level 1", "Level 2", "Level 3"];

export function ThreatPanel({ regionId }: ThreatPanelProps) {
  const { data, loading } = useAnalytics<ThreatData>("threat_distribution", regionId);

  if (loading) {
    return <div className="h-48 bg-bg-surface rounded-[14px] animate-pulse mb-2.5" />;
  }

  const counts = data?.counts ?? {};
  const mostCommon = data?.mostCommonLevel ?? 0;

  const donutData = [0, 1, 2, 3].map((level) => ({
    name: THREAT_LABELS[level],
    value: counts[level] ?? 0,
    fill: THREAT_COLORS[level],
  }));

  const total = donutData.reduce((sum, d) => sum + d.value, 0);

  return (
    <AnalyticsCard title="Threat Levels">
      {/* Hero */}
      <div className="px-4 pb-1">
        <div className="text-[28px] font-mono font-bold leading-none" style={{ color: THREAT_COLORS[mostCommon] }}>
          Level {mostCommon}
        </div>
        <div className="text-[11px] text-text-secondary font-mono mt-1">most common threat level</div>
      </div>

      {/* Donut */}
      <DonutChart data={donutData} />

      {/* Legend */}
      {[0, 1, 2, 3].map((level) => {
        const count = counts[level] ?? 0;
        const pct = total > 0 ? ((count / total) * 100).toFixed(0) : "0";
        return (
          <StatRow
            key={level}
            label={THREAT_LABELS[level]}
            value={`${count} (${pct}%)`}
            color={THREAT_COLORS[level]}
          />
        );
      })}

      <div className="pb-1" />
    </AnalyticsCard>
  );
}
