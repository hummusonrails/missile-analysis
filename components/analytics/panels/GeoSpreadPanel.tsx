"use client";

import { useAnalytics } from "../../../lib/hooks/use-analytics";
import { AnalyticsCard } from "../AnalyticsCard";
import { StatRow } from "../charts/StatRow";

interface SpreadData {
  avgRegionsPerGroup: number;
  totalGroups: number;
  maxRegionsInGroup?: number;
  spreadScore?: number;
}

interface GeoSpreadPanelProps {
  regionId: string | null;
}

export function GeoSpreadPanel({ regionId }: GeoSpreadPanelProps) {
  const { data, loading } = useAnalytics<SpreadData>("geographic_spread", regionId);

  if (loading) {
    return <div className="h-48 bg-bg-surface rounded-[14px] animate-pulse mb-2.5" />;
  }

  const avgRegions = data?.avgRegionsPerGroup ?? 0;
  const totalGroups = data?.totalGroups ?? 0;
  const maxRegions = data?.maxRegionsInGroup ?? 0;

  return (
    <AnalyticsCard title="Geographic Spread">
      {/* Hero */}
      <div className="px-4 pb-2">
        <div className="text-[28px] font-mono font-bold text-text-primary leading-none">
          {avgRegions.toFixed(1)}
        </div>
        <div className="text-[11px] text-text-secondary font-mono mt-1">avg regions per group</div>
      </div>

      <StatRow
        label="Alert clusters"
        sublabel="grouped by proximity"
        value={totalGroups}
        color="#3B82F6"
      />
      {maxRegions > 0 && (
        <StatRow
          label="Widest spread"
          sublabel="max regions in one cluster"
          value={maxRegions}
          color="#F59E0B"
        />
      )}
      {data?.spreadScore != null && (
        <StatRow
          label="Spread score"
          sublabel="geographic diversity index"
          value={data.spreadScore.toFixed(2)}
        />
      )}

      {/* Insight */}
      <div className="mx-4 mb-3.5 mt-2 p-3 bg-accent-blue/5 border border-accent-blue/10 rounded-[10px] text-[12px] text-text-secondary leading-relaxed">
        Alerts span an average of{" "}
        <strong className="text-accent-blue font-semibold">{avgRegions.toFixed(1)} regions</strong>{" "}
        per cluster across{" "}
        <strong className="text-accent-blue font-semibold">{totalGroups}</strong> groups.
      </div>
    </AnalyticsCard>
  );
}
