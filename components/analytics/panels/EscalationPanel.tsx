"use client";

import { useAnalytics } from "../../../lib/hooks/use-analytics";
import { AnalyticsCard } from "../AnalyticsCard";
import { StatRow } from "../charts/StatRow";

interface EscalationData {
  currentRate: number;
  baseline: number;
  multiplier: number;
  escalations: { start: number; end: number; count: number }[];
}

interface EscalationPanelProps {
  regionId: string | null;
}

export function EscalationPanel({ regionId }: EscalationPanelProps) {
  const { data, loading } = useAnalytics<EscalationData>("escalation_patterns", regionId);

  if (loading) {
    return <div className="h-48 bg-bg-surface rounded-[14px] animate-pulse mb-2.5" />;
  }

  const multiplier = data?.multiplier ?? 0;
  const currentRate = data?.currentRate ?? 0;
  const baseline = data?.baseline ?? 0;
  const escalationCount = data?.escalations?.length ?? 0;

  const badge =
    multiplier > 2
      ? { label: "↑ now", direction: "up" as const }
      : { label: "stable", direction: "neutral" as const };

  return (
    <AnalyticsCard title="Escalation Patterns" badge={badge}>
      {/* Hero */}
      <div className="px-4 pb-2">
        <div className="text-[28px] font-mono font-bold text-accent-red leading-none">
          {multiplier.toFixed(1)}x
        </div>
        <div className="text-[11px] text-text-secondary font-mono mt-1">above baseline rate</div>
      </div>

      <StatRow label="Current rate" sublabel="alerts / hour" value={currentRate.toFixed(1)} color="#EF4444" />
      <StatRow label="Baseline rate" sublabel="historical avg" value={baseline.toFixed(1)} />
      <StatRow label="Escalation events" sublabel="detected periods" value={escalationCount} />

      {/* Insight */}
      <div className="mx-4 mb-3.5 mt-2 p-3 bg-accent-blue/5 border border-accent-blue/10 rounded-[10px] text-[12px] text-text-secondary leading-relaxed">
        Current alert rate is{" "}
        <strong className="text-accent-red font-semibold">{multiplier.toFixed(1)}x</strong> the
        historical baseline with{" "}
        <strong className="text-accent-blue font-semibold">{escalationCount}</strong> escalation
        periods detected.
      </div>
    </AnalyticsCard>
  );
}
