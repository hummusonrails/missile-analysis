"use client";

import type { Alert, CityCoord } from "../../lib/types";

interface FeedItemProps {
  alert: Alert;
  cityCoords: Map<string, CityCoord>;
  onTap: (alert: Alert) => void;
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

function threatBadgeColor(threat: number): string {
  switch (threat) {
    case 0: return "bg-text-tertiary/10 text-text-secondary border-text-tertiary/20";
    case 1: return "bg-accent-amber/10 text-accent-amber border-accent-amber/20";
    case 2: return "bg-accent-red/10 text-accent-red border-accent-red/20";
    case 3: return "bg-accent-red/20 text-accent-red border-accent-red/40";
    default: return "bg-text-tertiary/10 text-text-tertiary border-text-tertiary/20";
  }
}

type Recency = "recent" | "moderate" | "old";

function getRecency(timestamp: number): Recency {
  const diffMin = Math.floor((Date.now() - timestamp) / 60_000);
  if (diffMin < 60) return "recent";
  if (diffMin < 360) return "moderate";
  return "old";
}

function recencyTimeColor(recency: Recency): string {
  switch (recency) {
    case "recent": return "text-accent-red";
    case "moderate": return "text-accent-amber";
    case "old": return "text-text-tertiary";
  }
}

function recencyBorderColor(recency: Recency): string {
  switch (recency) {
    case "recent": return "border-s-accent-red";
    case "moderate": return "border-s-accent-amber";
    case "old": return "border-s-text-tertiary";
  }
}

function recencyGlow(recency: Recency): string {
  if (recency === "recent") {
    return "shadow-[inset_3px_0_8px_rgba(239,68,68,0.25)]";
  }
  return "";
}

export function FeedItem({ alert, cityCoords, onTap }: FeedItemProps) {
  const recency = getRecency(alert.timestamp);

  // Derive unique region(s) from cities
  const regions = Array.from(
    new Set(
      alert.cities
        .map((c) => cityCoords.get(c)?.region_id)
        .filter((r): r is string => Boolean(r))
    )
  );

  // City display names — up to 4 then "+N more"
  const displayCities = alert.cities.slice(0, 4);
  const remaining = alert.cities.length - displayCities.length;

  return (
    <button
      onClick={() => onTap(alert)}
      className={[
        "w-full text-left bg-bg-surface border border-border rounded-xl p-3.5 border-s-[3px]",
        "active:bg-bg-surface-hover transition-colors",
        recencyBorderColor(recency),
        recencyGlow(recency),
      ].join(" ")}
    >
      {/* Top row: time + threat badge */}
      <div className="flex items-center justify-between mb-2">
        <span className={`font-mono text-[12px] font-medium ${recencyTimeColor(recency)}`}>
          {timeAgo(alert.timestamp)}
        </span>
        <span
          className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${threatBadgeColor(alert.threat)}`}
        >
          {threatLabel(alert.threat)}
        </span>
      </div>

      {/* City list */}
      <div className="flex flex-wrap gap-1 mb-2">
        {displayCities.map((city) => {
          const coord = cityCoords.get(city);
          return (
            <span
              key={city}
              className="text-[12px] text-text-primary bg-bg-elevated border border-border rounded-md px-1.5 py-0.5"
            >
              {coord?.city_name_en ?? city}
            </span>
          );
        })}
        {remaining > 0 && (
          <span className="text-[12px] text-text-tertiary bg-bg-elevated border border-border rounded-md px-1.5 py-0.5">
            +{remaining} more
          </span>
        )}
      </div>

      {/* Footer: region + city count */}
      <div className="flex items-center justify-between">
        {regions.length > 0 ? (
          <span className="text-[11px] text-text-secondary capitalize">
            {regions.join(", ")}
          </span>
        ) : (
          <span />
        )}
        <span className="text-[11px] text-text-tertiary">
          {alert.cities.length} {alert.cities.length === 1 ? "city" : "cities"}
        </span>
      </div>
    </button>
  );
}
