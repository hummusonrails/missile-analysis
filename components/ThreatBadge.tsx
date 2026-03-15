"use client";

import { useI18n } from "../lib/i18n";

interface EscalationData {
  currentRate: number;
  baseline: number;
  multiplier: number;
}

type ThreatLevelId = "calm" | "elevated" | "high" | "critical";

interface ThreatLevelConfig {
  color: string;
  bg: string;
  dotColor: string;
  pulse: boolean;
}

const LEVELS: Record<ThreatLevelId, ThreatLevelConfig> = {
  calm:     { color: "text-emerald-400", bg: "bg-emerald-400/15 border-emerald-400/30", dotColor: "bg-emerald-400", pulse: false },
  elevated: { color: "text-yellow-400",  bg: "bg-yellow-400/15 border-yellow-400/30",  dotColor: "bg-yellow-400",  pulse: false },
  high:     { color: "text-orange-400",  bg: "bg-orange-400/15 border-orange-400/30",  dotColor: "bg-orange-400",  pulse: false },
  critical: { color: "text-red-400",     bg: "bg-red-400/15 border-red-400/30",        dotColor: "bg-red-400",     pulse: true },
};

function computeLevel(esc: EscalationData): ThreatLevelId {
  if (esc.currentRate === 0) return "calm";
  if (esc.baseline === 0) return "elevated";
  if (esc.multiplier > 4) return "critical";
  if (esc.multiplier > 2) return "high";
  return "elevated";
}

interface ThreatBadgeProps {
  escalation: EscalationData;
}

export function ThreatBadge({ escalation }: ThreatBadgeProps) {
  const { t } = useI18n();
  const levelId = computeLevel(escalation);
  const level = LEVELS[levelId];

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9px] font-bold tracking-wider uppercase ${level.bg} ${level.color} ${level.pulse ? "animate-pulse" : ""}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${level.dotColor}`} />
      {t(`threat.${levelId}`)}
    </span>
  );
}
