"use client";

import type { Alert, CityCoord } from "../../lib/types";
import { useI18n } from "../../lib/i18n";

interface FeedItemProps {
  alert: Alert;
  cityCoords: Map<string, CityCoord>;
  onTap: (alert: Alert) => void;
}

const THREAT_LABELS: Record<number, { en: string; he: string }> = {
  0: { en: "Rockets", he: "רקטות" },
  2: { en: "Infiltration", he: "חדירה" },
  3: { en: "Earthquake", he: "רעידת אדמה" },
  5: { en: "Hostile Aircraft", he: "כלי טיס עוין" },
  7: { en: "Non-conv.", he: "לא קונבנציונלי" },
  8: { en: "Alert", he: "התרעה" },
};

function threatBadgeColor(threat: number): string {
  switch (threat) {
    case 0: return "bg-accent-red/10 text-accent-red border-accent-red/20";
    case 5: return "bg-accent-amber/10 text-accent-amber border-accent-amber/20";
    case 2: return "bg-accent-blue/10 text-accent-blue border-accent-blue/20";
    default: return "bg-text-tertiary/10 text-text-secondary border-text-tertiary/20";
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
  if (recency === "recent") return "shadow-[inset_3px_0_8px_rgba(239,68,68,0.25)]";
  return "";
}

export function FeedItem({ alert, cityCoords, onTap }: FeedItemProps) {
  const { lang } = useI18n();
  const isHe = lang === "he";
  const recency = getRecency(alert.timestamp);

  function timeAgo(timestamp: number): string {
    const diffMs = Date.now() - timestamp;
    const diffMin = Math.floor(diffMs / 60_000);
    if (diffMin < 1) return isHe ? "עכשיו" : "Just now";
    if (diffMin < 60) return isHe ? `לפני ${diffMin} דק'` : `${diffMin}m ago`;
    const h = Math.floor(diffMin / 60);
    if (h < 24) return isHe ? `לפני ${h} שע'` : `${h}h ago`;
    const d = Math.floor(h / 24);
    return isHe ? `לפני ${d} ימים` : `${d}d ago`;
  }

  const regions = Array.from(
    new Set(
      alert.cities
        .map((c) => cityCoords.get(c)?.region_id)
        .filter((r): r is string => Boolean(r))
    )
  );

  const displayCities = alert.cities.slice(0, 4);
  const remaining = alert.cities.length - displayCities.length;
  const threatInfo = THREAT_LABELS[alert.threat] || { en: "Alert", he: "התרעה" };

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
      <div className="flex items-center justify-between mb-2">
        <span className={`font-mono text-[12px] font-medium ${recencyTimeColor(recency)}`}>
          {timeAgo(alert.timestamp)}
        </span>
        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${threatBadgeColor(alert.threat)}`}>
          {isHe ? threatInfo.he : threatInfo.en}
        </span>
      </div>

      <div className="flex flex-wrap gap-1 mb-2">
        {displayCities.map((city) => {
          const coord = cityCoords.get(city);
          return (
            <span
              key={city}
              className="text-[12px] text-text-primary bg-bg-elevated border border-border rounded-md px-1.5 py-0.5"
            >
              {isHe ? city : (coord?.city_name_en ?? city)}
            </span>
          );
        })}
        {remaining > 0 && (
          <span className="text-[12px] text-text-tertiary bg-bg-elevated border border-border rounded-md px-1.5 py-0.5">
            +{remaining} {isHe ? "נוספים" : "more"}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between">
        {regions.length > 0 ? (
          <span className="text-[11px] text-text-secondary capitalize">
            {regions.join(", ")}
          </span>
        ) : (
          <span />
        )}
        <span className="text-[11px] text-text-tertiary">
          {alert.cities.length} {isHe ? "ערים" : (alert.cities.length === 1 ? "city" : "cities")}
        </span>
      </div>
    </button>
  );
}
