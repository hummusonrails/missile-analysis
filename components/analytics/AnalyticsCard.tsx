"use client";

import React from "react";

interface AnalyticsCardProps {
  title: string;
  badge?: {
    label: string;
    direction?: "up" | "down" | "neutral";
  };
  children: React.ReactNode;
}

const BADGE_COLORS = {
  up: "text-accent-green bg-accent-green/10 border-accent-green/20",
  down: "text-accent-red bg-accent-red/10 border-accent-red/20",
  neutral: "text-text-secondary bg-bg-elevated border-border",
};

export function AnalyticsCard({ title, badge, children }: AnalyticsCardProps) {
  return (
    <div className="bg-bg-surface border border-border rounded-[14px] overflow-hidden mb-2.5">
      <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
        <span className="text-[11px] font-mono font-medium text-text-tertiary uppercase tracking-wider">
          {title}
        </span>
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
  );
}
