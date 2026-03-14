"use client";

import { useState } from "react";
import { ANALYTICS_PANELS } from "../../lib/types";
import { ShabbatPanel } from "./panels/ShabbatPanel";
import { HourlyPanel } from "./panels/HourlyPanel";
import { MonthlyPanel } from "./panels/MonthlyPanel";
import { EscalationPanel } from "./panels/EscalationPanel";
import { QuietPeriodsPanel } from "./panels/QuietPeriodsPanel";
import { MultiRegionPanel } from "./panels/MultiRegionPanel";
import { AlertGapsPanel } from "./panels/AlertGapsPanel";
import { GeoSpreadPanel } from "./panels/GeoSpreadPanel";
import { ThreatPanel } from "./panels/ThreatPanel";
import { AmPmPanel } from "./panels/AmPmPanel";
import { DayOfWeekPanel } from "./panels/DayOfWeekPanel";

interface AnalyticsViewProps {
  regionId: string | null;
}

const DEFAULT_PANELS = new Set(["shabbat_vs_weekday", "hourly_histogram"]);

function PanelRenderer({ panelKey, regionId }: { panelKey: string; regionId: string | null }) {
  switch (panelKey) {
    case "shabbat_vs_weekday":
      return <ShabbatPanel regionId={regionId} />;
    case "hourly_histogram":
      return <HourlyPanel regionId={regionId} />;
    case "monthly_trends":
      return <MonthlyPanel regionId={regionId} />;
    case "escalation_patterns":
      return <EscalationPanel regionId={regionId} />;
    case "quiet_vs_active":
      return <QuietPeriodsPanel regionId={regionId} />;
    case "multi_city_correlation":
      return <MultiRegionPanel regionId={regionId} />;
    case "time_between_alerts":
      return <AlertGapsPanel regionId={regionId} />;
    case "geographic_spread":
      return <GeoSpreadPanel regionId={regionId} />;
    case "threat_distribution":
      return <ThreatPanel regionId={regionId} />;
    case "morning_vs_evening":
      return <AmPmPanel regionId={regionId} />;
    case "day_of_week":
      return <DayOfWeekPanel regionId={regionId} />;
    default:
      return null;
  }
}

export function AnalyticsView({ regionId }: AnalyticsViewProps) {
  const [activePanels, setActivePanels] = useState<Set<string>>(DEFAULT_PANELS);

  function togglePanel(key: string) {
    setActivePanels((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  return (
    <div className="h-full flex flex-col bg-bg-primary">
      {/* Filter awareness indicator */}
      {regionId && (
        <div className="mx-4 mt-3 mb-1 flex items-center gap-2 px-3 py-2 bg-accent-blue/5 border border-accent-blue/15 rounded-[10px]">
          <div className="w-1.5 h-1.5 bg-accent-blue rounded-full" />
          <span className="text-[11px] text-accent-blue font-mono">
            Filtered to region: {regionId}
          </span>
        </div>
      )}

      {/* Chip selector row */}
      <div className="flex-shrink-0 px-4 pt-3 pb-2">
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1">
          {ANALYTICS_PANELS.map((panel) => {
            const isActive = activePanels.has(panel.key);
            return (
              <button
                key={panel.key}
                onClick={() => togglePanel(panel.key)}
                className={`flex-shrink-0 text-[11px] font-mono font-medium px-3 py-1.5 rounded-full border transition-all ${
                  isActive
                    ? "bg-accent-blue/15 border-accent-blue/30 text-accent-blue"
                    : "bg-bg-surface border-border text-text-tertiary hover:text-text-secondary hover:border-border-active"
                }`}
              >
                {panel.labelEn}
              </button>
            );
          })}
        </div>
      </div>

      {/* Scrollable panel stack */}
      <div className="flex-1 overflow-y-auto px-4 pt-1 pb-6">
        {activePanels.size === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2">
            <span className="text-[13px] text-text-tertiary font-mono">No panels selected</span>
            <span className="text-[11px] text-text-tertiary">Tap a chip above to add a panel</span>
          </div>
        ) : (
          ANALYTICS_PANELS.filter((p) => activePanels.has(p.key)).map((panel) => (
            <PanelRenderer key={panel.key} panelKey={panel.key} regionId={regionId} />
          ))
        )}
      </div>
    </div>
  );
}
