"use client";

import type { PreAlert } from "../../lib/types";
import { useI18n } from "../../lib/i18n";

interface PreAlertFeedItemProps {
  preAlert: PreAlert;
}

function alertTypeBadge(alertType: string, isHe: boolean): { label: string; className: string } {
  if (alertType === "early_warning") {
    return {
      label: isHe ? "אזהרה מוקדמת" : "Early Warning",
      className: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    };
  }
  return {
    label: isHe ? "סיום אירוע" : "All Clear",
    className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  };
}

function borderColor(alertType: string): string {
  return alertType === "early_warning"
    ? "border-s-amber-500"
    : "border-s-emerald-500";
}

export function PreAlertFeedItem({ preAlert }: PreAlertFeedItemProps) {
  const { lang } = useI18n();
  const isHe = lang === "he";

  const badge = alertTypeBadge(preAlert.alert_type, isHe);

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

  const isRecent = Date.now() - preAlert.timestamp < 60 * 60_000; // last hour

  return (
    <div
      className={[
        "w-full text-left bg-bg-surface border border-border rounded-xl p-3.5 border-s-[3px]",
        borderColor(preAlert.alert_type),
        isRecent && preAlert.alert_type === "early_warning"
          ? "shadow-[inset_3px_0_8px_rgba(245,158,11,0.25)]"
          : "",
      ].join(" ")}
    >
      <div className="flex items-center justify-between mb-2">
        <span
          className={`font-mono text-[12px] font-medium ${
            preAlert.alert_type === "early_warning" ? "text-amber-400" : "text-emerald-400"
          }`}
        >
          {timeAgo(preAlert.timestamp)}
        </span>
        <span
          className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${badge.className}`}
        >
          {badge.label}
        </span>
      </div>

      <p className="text-[12px] text-text-primary mb-2 leading-relaxed" dir="rtl">
        {preAlert.body_he}
      </p>

      <div className="flex items-center justify-between">
        {preAlert.regions.length > 0 ? (
          <span className="text-[11px] text-text-secondary capitalize">
            {preAlert.regions.join(", ")}
          </span>
        ) : (
          <span className="text-[11px] text-text-tertiary">
            {isHe ? "כל הארץ" : "Nationwide"}
          </span>
        )}
        <span className="text-[10px] text-text-tertiary uppercase tracking-wider">
          {isHe ? "התרעה מוקדמת" : "PRE-ALERT"}
        </span>
      </div>
    </div>
  );
}
