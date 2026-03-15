"use client";

import React, { useState } from "react";
import { MethodologyModal } from "./MethodologyModal";
import type { Methodology } from "../../lib/methodology";

interface AnalyticsCardProps {
  title: string;
  badge?: {
    label: string;
    direction?: "up" | "down" | "neutral";
  };
  methodology?: Methodology;
  children: React.ReactNode;
}

const BADGE_COLORS = {
  up: "text-accent-green bg-accent-green/10 border-accent-green/20",
  down: "text-accent-red bg-accent-red/10 border-accent-red/20",
  neutral: "text-text-secondary bg-bg-elevated border-border",
};

export function AnalyticsCard({ title, badge, methodology, children }: AnalyticsCardProps) {
  const [showMethodology, setShowMethodology] = useState(false);

  return (
    <>
      <div className="bg-bg-surface border border-border rounded-[14px] overflow-hidden mb-2.5">
        <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono font-medium text-text-tertiary uppercase tracking-wider">
              {title}
            </span>
            {methodology && (
              <button
                onClick={() => setShowMethodology(true)}
                className="w-4 h-4 flex items-center justify-center rounded-full border border-border text-text-tertiary hover:text-accent-blue hover:border-accent-blue/30 transition-colors"
                aria-label="Methodology info"
              >
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4M12 8h.01" />
                </svg>
              </button>
            )}
          </div>
          {badge && (
            <span
              className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border ${
                BADGE_COLORS[badge.direction ?? "neutral"]
              }`}
            >
              {badge.label}
            </span>
          )}
        </div>
        {children}
      </div>

      {showMethodology && methodology && (
        <MethodologyModal
          title={title}
          methodology={methodology}
          onClose={() => setShowMethodology(false)}
        />
      )}
    </>
  );
}
