"use client";

import type { PreAlert } from "../../lib/types";
import { useI18n } from "../../lib/i18n";

interface PreAlertFeedItemProps {
  preAlert: PreAlert;
}

function alertTypeBadge(alertType: string, isHe: boolean): { label: string; className: string; icon: string } {
  if (alertType === "early_warning") {
    return {
      label: isHe ? "אזהרה מוקדמת" : "Early Warning",
      className: "bg-amber-500/10 text-amber-400 border-amber-500/20",
      icon: "⚠",
    };
  }
  return {
    label: isHe ? "סיום אירוע" : "All Clear",
    className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    icon: "✓",
  };
}

function borderColor(alertType: string): string {
  return alertType === "early_warning"
    ? "border-s-amber-500"
    : "border-s-emerald-500";
}

export function PreAlertFeedItem({ preAlert }: PreAlertFeedItemProps) {
  const { lang, t } = useI18n();
  const isHe = lang === "he";

  const badge = alertTypeBadge(preAlert.alert_type, isHe);
  const isRecent = Date.now() - preAlert.timestamp < 60 * 60_000;

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

  const displayRegions = preAlert.regions.slice(0, 4);
  const remainingRegions = preAlert.regions.length - displayRegions.length;

  return (
    <div
      className={[
        "w-full text-left border rounded-xl p-3.5 border-s-[3px]",
        preAlert.alert_type === "early_warning"
          ? "bg-amber-950/20 border-amber-500/15"
          : "bg-emerald-950/20 border-emerald-500/15",
        borderColor(preAlert.alert_type),
        isRecent && preAlert.alert_type === "early_warning"
          ? "shadow-[inset_3px_0_8px_rgba(245,158,11,0.25)]"
          : "",
      ].join(" ")}
    >
      {/* Header: time + badge */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[13px]">{badge.icon}</span>
          <span
            className={`font-mono text-[12px] font-medium ${
              preAlert.alert_type === "early_warning" ? "text-amber-400" : "text-emerald-400"
            }`}
          >
            {timeAgo(preAlert.timestamp)}
          </span>
        </div>
        <span
          className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${badge.className}`}
        >
          {badge.label}
        </span>
      </div>

      {/* Body text (always RTL since it's Hebrew) */}
      <p className="text-[12px] text-text-primary mb-2.5 leading-relaxed" dir="rtl">
        {preAlert.body_he}
      </p>

      {/* Region chips */}
      {preAlert.regions.length > 0 ? (
        <div className="flex flex-wrap gap-1 mb-2">
          {displayRegions.map((region) => (
            <span
              key={region}
              className={`text-[11px] rounded-md px-1.5 py-0.5 capitalize ${
                preAlert.alert_type === "early_warning"
                  ? "text-amber-300 bg-amber-500/10 border border-amber-500/15"
                  : "text-emerald-300 bg-emerald-500/10 border border-emerald-500/15"
              }`}
            >
              {region.replace(/-/g, " ")}
            </span>
          ))}
          {remainingRegions > 0 && (
            <span className="text-[11px] text-text-tertiary bg-bg-elevated border border-border rounded-md px-1.5 py-0.5">
              +{remainingRegions} {isHe ? "נוספים" : "more"}
            </span>
          )}
        </div>
      ) : (
        <div className="mb-2">
          <span className={`text-[11px] rounded-md px-1.5 py-0.5 ${
            preAlert.alert_type === "early_warning"
              ? "text-amber-300 bg-amber-500/10 border border-amber-500/15"
              : "text-emerald-300 bg-emerald-500/10 border border-emerald-500/15"
          }`}>
            {t("prealert.nationwide")}
          </span>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-text-tertiary">
          {preAlert.city_ids.length} {isHe ? "ערים" : (preAlert.city_ids.length === 1 ? "city" : "cities")}
        </span>
        <span className={`text-[9px] uppercase tracking-widest font-medium ${
          preAlert.alert_type === "early_warning" ? "text-amber-500/50" : "text-emerald-500/50"
        }`}>
          {t("prealert.badge")}
        </span>
      </div>
    </div>
  );
}
