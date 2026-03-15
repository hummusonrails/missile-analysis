"use client";

import type { Alert, CityCoord } from "../../lib/types";
import { useI18n } from "../../lib/i18n";

interface BottomSheetProps {
  alert: Alert | null;
  cityCoords: Map<string, CityCoord>;
  onClose: () => void;
  onShowInFeed: () => void;
}

const THREAT_LABELS: Record<number, { en: string; he: string }> = {
  0: { en: "Rockets", he: "רקטות" },
  2: { en: "Infiltration", he: "חדירה" },
  3: { en: "Earthquake", he: "רעידת אדמה" },
  5: { en: "Hostile Aircraft", he: "כלי טיס עוין" },
  7: { en: "Non-conv. Missile", he: "טיל לא קונבנציונלי" },
  8: { en: "General Alert", he: "התרעה כללית" },
};

function threatColor(threat: number): string {
  switch (threat) {
    case 0: return "text-accent-red";
    case 5: return "text-accent-amber";
    case 2: return "text-accent-blue";
    default: return "text-text-secondary";
  }
}

export function BottomSheet({ alert, cityCoords, onClose, onShowInFeed }: BottomSheetProps) {
  const { lang, t } = useI18n();
  const isHe = lang === "he";

  if (!alert) return null;

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

  const displayCities = alert.cities.slice(0, 5);
  const remaining = alert.cities.length - displayCities.length;
  const threatInfo = THREAT_LABELS[alert.threat] || { en: "Alert", he: "התרעה" };

  return (
    <>
      <div className="absolute inset-0 z-[999]" onClick={onClose} />
      <div className="absolute bottom-0 left-0 right-0 z-[1000] bg-bg-surface/95 backdrop-blur-xl rounded-t-2xl border-t border-border shadow-2xl">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-border-active rounded-full" />
        </div>
        <div className="px-5 pb-6 pt-2">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="text-[11px] text-text-tertiary font-medium uppercase tracking-widest mb-0.5">
                {isHe ? "התרעה" : "Alert"}
              </div>
              <div className="font-mono text-[13px] text-text-secondary">
                {timeAgo(alert.timestamp)}
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-text-tertiary hover:text-text-secondary w-7 h-7 flex items-center justify-center rounded-full border border-border"
              aria-label={t("sheet.close")}
            >
              ✕
            </button>
          </div>

          <div className="mb-3">
            <div className="text-[10px] text-text-tertiary uppercase tracking-widest font-medium mb-1.5">
              {isHe ? "ערים" : "Cities"}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {displayCities.map((city) => (
                <span
                  key={city}
                  className="bg-bg-elevated border border-border rounded-lg px-2 py-0.5 text-[12px] text-text-primary"
                >
                  {isHe ? city : (cityCoords.get(city)?.city_name_en ?? city)}
                </span>
              ))}
              {remaining > 0 && (
                <span className="bg-bg-elevated border border-border rounded-lg px-2 py-0.5 text-[12px] text-text-tertiary">
                  +{remaining} {isHe ? "נוספים" : "more"}
                </span>
              )}
            </div>
          </div>

          <div className="flex gap-4 mb-4">
            {regions.length > 0 && (
              <div>
                <div className="text-[10px] text-text-tertiary uppercase tracking-widest font-medium mb-1">
                  {isHe ? "אזור" : "Region"}
                </div>
                <div className="text-[13px] text-text-primary capitalize">
                  {regions.join(", ")}
                </div>
              </div>
            )}
            <div>
              <div className="text-[10px] text-text-tertiary uppercase tracking-widest font-medium mb-1">
                {isHe ? "סוג" : "Type"}
              </div>
              <div className={`text-[13px] font-medium ${threatColor(alert.threat)}`}>
                {isHe ? threatInfo.he : threatInfo.en}
              </div>
            </div>
          </div>

          <button
            onClick={onShowInFeed}
            className="w-full bg-accent-blue/10 hover:bg-accent-blue/20 border border-accent-blue/30 text-accent-blue rounded-xl py-2.5 text-[13px] font-medium transition-colors"
          >
            {t("sheet.showInFeed")}
          </button>
        </div>
      </div>
    </>
  );
}
