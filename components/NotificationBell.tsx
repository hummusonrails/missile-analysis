"use client";

import { useState, useRef, useEffect } from "react";
import { useI18n } from "../lib/i18n";
import type { Finding } from "../lib/hooks/use-findings";

const SEVERITY_STYLES: Record<string, string> = {
  CRITICAL: "bg-red-500/20 text-red-400 border-red-500/30",
  HIGH: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  MEDIUM: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
};

interface NotificationBellProps {
  findings: Finding[];
  unseenCount: number;
  onOpen: () => void;
}

export function NotificationBell({ findings, unseenCount, onOpen }: NotificationBellProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleToggle() {
    const willOpen = !open;
    setOpen(willOpen);
    if (willOpen) onOpen();
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={handleToggle}
        className="relative p-1.5 rounded-lg hover:bg-bg-surface transition-colors"
        aria-label={t("findings.title")}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-secondary">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>

        {unseenCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-accent-red text-white text-[9px] font-bold px-1">
            {unseenCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 max-h-80 overflow-y-auto bg-bg-elevated border border-border-active rounded-xl shadow-2xl z-50">
          <div className="px-3 py-2 border-b border-border">
            <span className="text-[11px] font-bold text-text-primary uppercase tracking-wider">
              {t("findings.title")}
            </span>
          </div>

          {findings.length === 0 ? (
            <div className="px-3 py-4 text-center text-text-tertiary text-[11px]">
              {t("findings.empty")}
            </div>
          ) : (
            findings.map((finding) => (
              <div key={finding.id} className="px-3 py-2.5 border-b border-border last:border-b-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold border ${SEVERITY_STYLES[finding.severity]}`}>
                    {finding.severity}
                  </span>
                  <span className="text-[11px] font-medium text-text-primary">
                    {t(finding.titleKey)}
                  </span>
                </div>
                <p className="text-[10px] text-text-tertiary">
                  {t(finding.descKey)}
                </p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
