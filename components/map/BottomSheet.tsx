"use client";

import type { Alert, CityCoord } from "../../lib/types";

interface BottomSheetProps {
  alert: Alert | null;
  cityCoords: Map<string, CityCoord>;
  onClose: () => void;
  onShowInFeed: () => void;
}

function timeAgo(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const h = Math.floor(diffMin / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function threatLabel(threat: number): string {
  switch (threat) {
    case 0: return "Low";
    case 1: return "Medium";
    case 2: return "High";
    case 3: return "Critical";
    default: return "Unknown";
  }
}

function threatColor(threat: number): string {
  switch (threat) {
    case 0: return "text-text-secondary";
    case 1: return "text-accent-amber";
    case 2: return "text-accent-red";
    case 3: return "text-accent-red";
    default: return "text-text-tertiary";
  }
}

export function BottomSheet({ alert, cityCoords, onClose, onShowInFeed }: BottomSheetProps) {
  if (!alert) return null;

  // Derive unique regions from cities
  const regions = Array.from(
    new Set(
      alert.cities
        .map((c) => cityCoords.get(c)?.region_id)
        .filter((r): r is string => Boolean(r))
    )
  );

  // Format city list — show up to 5 then "+N more"
  const displayCities = alert.cities.slice(0, 5);
  const remaining = alert.cities.length - displayCities.length;

  return (
    <>
      {/* Backdrop */}
      <div
        className="absolute inset-0 z-[999]"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="absolute bottom-0 left-0 right-0 z-[1000] bg-bg-surface/95 backdrop-blur-xl rounded-t-2xl border-t border-border shadow-2xl">
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-border-active rounded-full" />
        </div>

        <div className="px-5 pb-6 pt-2">
          {/* Header row */}
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="text-[11px] text-text-tertiary font-medium uppercase tracking-widest mb-0.5">
                Alert
              </div>
              <div className="font-mono text-[13px] text-text-secondary">
                {timeAgo(alert.timestamp)}
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-text-tertiary hover:text-text-secondary w-7 h-7 flex items-center justify-center rounded-full border border-border"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          {/* City list */}
          <div className="mb-3">
            <div className="text-[10px] text-text-tertiary uppercase tracking-widest font-medium mb-1.5">
              Cities
            </div>
            <div className="flex flex-wrap gap-1.5">
              {displayCities.map((city) => (
                <span
                  key={city}
                  className="bg-bg-elevated border border-border rounded-lg px-2 py-0.5 text-[12px] text-text-primary"
                >
                  {cityCoords.get(city)?.city_name_en ?? city}
                </span>
              ))}
              {remaining > 0 && (
                <span className="bg-bg-elevated border border-border rounded-lg px-2 py-0.5 text-[12px] text-text-tertiary">
                  +{remaining} more
                </span>
              )}
            </div>
          </div>

          {/* Region + threat row */}
          <div className="flex gap-4 mb-4">
            {regions.length > 0 && (
              <div>
                <div className="text-[10px] text-text-tertiary uppercase tracking-widest font-medium mb-1">
                  Region
                </div>
                <div className="text-[13px] text-text-primary capitalize">
                  {regions.join(", ")}
                </div>
              </div>
            )}
            <div>
              <div className="text-[10px] text-text-tertiary uppercase tracking-widest font-medium mb-1">
                Threat
              </div>
              <div className={`text-[13px] font-medium ${threatColor(alert.threat)}`}>
                {threatLabel(alert.threat)}
              </div>
            </div>
          </div>

          {/* Show in feed button */}
          <button
            onClick={onShowInFeed}
            className="w-full bg-accent-blue/10 hover:bg-accent-blue/20 border border-accent-blue/30 text-accent-blue rounded-xl py-2.5 text-[13px] font-medium transition-colors"
          >
            Show in Feed →
          </button>
        </div>
      </div>
    </>
  );
}
