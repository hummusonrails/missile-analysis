"use client";

import { useI18n } from "../../lib/i18n";
import { THREAT_COLORS } from "../../lib/threat-colors";

const THREAT_LABELS: Record<number, string> = {
  0: "threat.type.rockets",
  2: "threat.type.infiltration",
  3: "threat.type.earthquake",
  5: "threat.type.aircraft",
  7: "threat.type.nonconventional",
  8: "threat.type.general",
};

interface MapLegendProps {
  activeThreatTypes: Set<number>;
  preAlertCount: number;
}

export function MapLegend({ activeThreatTypes, preAlertCount }: MapLegendProps) {
  const { t } = useI18n();

  if (activeThreatTypes.size === 0 && preAlertCount === 0) return null;

  const entries = Array.from(activeThreatTypes)
    .sort((a, b) => a - b)
    .map((id) => ({
      id: String(id),
      color: THREAT_COLORS[id] ?? "#6B7280",
      label: t(THREAT_LABELS[id] ?? "threat.type.unknown"),
    }));

  return (
    <div className="absolute bottom-1 left-1/2 -translate-x-1/2 z-[400] flex items-center gap-3 px-3 py-1.5 rounded-lg bg-bg-primary/80 backdrop-blur-sm border border-border">
      {entries.map((e) => (
        <div key={e.id} className="flex items-center gap-1">
          <span
            className="w-2.5 h-2.5 rounded-full inline-block flex-shrink-0"
            style={{ backgroundColor: e.color }}
          />
          <span className="text-[9px] text-text-secondary font-medium whitespace-nowrap">
            {e.label}
          </span>
        </div>
      ))}
      {preAlertCount > 0 && (
        <div className="flex items-center gap-1">
          <span
            className="w-2.5 h-2.5 rounded-full inline-block flex-shrink-0 border border-amber-400/50 animate-pulse"
            style={{ backgroundColor: "#F59E0B" }}
          />
          <span className="text-[9px] text-amber-300 font-medium whitespace-nowrap">
            {t("prealert.earlyWarning")} ({preAlertCount})
          </span>
        </div>
      )}
    </div>
  );
}
