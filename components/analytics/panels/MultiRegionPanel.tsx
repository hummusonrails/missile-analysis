"use client";

import { useAnalytics } from "../../../lib/hooks/use-analytics";
import { AnalyticsCard } from "../AnalyticsCard";
import { StatRow } from "../charts/StatRow";

interface MultiRegionData {
  multiRegionCount: number;
  avgRegions: number;
  coOccurrence: Record<string, Record<string, number>>;
}

interface MultiRegionPanelProps {
  regionId: string | null;
}

export function MultiRegionPanel({ regionId }: MultiRegionPanelProps) {
  const { data, loading } = useAnalytics<MultiRegionData>("multi_city_correlation", regionId);

  if (loading) {
    return <div className="h-48 bg-bg-surface rounded-[14px] animate-pulse mb-2.5" />;
  }

  const avgRegions = data?.avgRegions ?? 0;
  const multiCount = data?.multiRegionCount ?? 0;

  // Find top co-occurring pair from coOccurrence matrix
  let topPair: string | null = null;
  let topPairCount = 0;
  if (data?.coOccurrence) {
    for (const [regionA, targets] of Object.entries(data.coOccurrence)) {
      for (const [regionB, count] of Object.entries(targets)) {
        if (count > topPairCount && regionA !== regionB) {
          topPairCount = count;
          topPair = `${regionA} + ${regionB}`;
        }
      }
    }
  }

  return (
    <AnalyticsCard title="Multi-Region Events">
      {/* Hero */}
      <div className="px-4 pb-2">
        <div className="text-[28px] font-mono font-bold text-text-primary leading-none">
          {avgRegions.toFixed(1)}
        </div>
        <div className="text-[11px] text-text-secondary font-mono mt-1">avg regions per alert</div>
      </div>

      <StatRow
        label="Multi-region alerts"
        sublabel="alerts hitting 2+ regions"
        value={multiCount}
        color="#3B82F6"
      />
      {topPair && (
        <StatRow
          label="Top co-occurrence"
          sublabel={topPair}
          value={topPairCount}
          color="#F59E0B"
        />
      )}

      {/* Insight */}
      <div className="mx-4 mb-3.5 mt-2 p-3 bg-accent-blue/5 border border-accent-blue/10 rounded-[10px] text-[12px] text-text-secondary leading-relaxed">
        <strong className="text-accent-blue font-semibold">{multiCount}</strong> alerts targeted
        multiple regions simultaneously, averaging{" "}
        <strong className="text-accent-blue font-semibold">{avgRegions.toFixed(1)}</strong> regions
        per event.
      </div>
    </AnalyticsCard>
  );
}
