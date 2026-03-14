"use client";

import type { TimeRange } from "../lib/types";

interface FilterChipsProps {
  activeRange: TimeRange;
  onRangeChange: (range: TimeRange) => void;
  regionId: string | null;
  onRegionChange: (regionId: string | null) => void;
}

const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: "24h", label: "Last 24h" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "custom", label: "Custom" },
];

export function FilterChips({
  activeRange,
  onRangeChange,
  regionId,
  onRegionChange,
}: FilterChipsProps) {
  return (
    <div className="flex-shrink-0 overflow-x-auto scrollbar-hide">
      <div className="flex items-center gap-2 px-4 py-2.5 w-max">
        {TIME_RANGES.map(({ value, label }) => {
          const active = activeRange === value;
          return (
            <button
              key={value}
              onClick={() => onRangeChange(value)}
              className={`px-3.5 py-1.5 rounded-lg text-[11px] font-medium border transition-colors whitespace-nowrap ${
                active
                  ? "bg-accent-blue/15 text-accent-blue border-accent-blue/25"
                  : "bg-bg-surface text-text-secondary border-border"
              }`}
            >
              {label}
            </button>
          );
        })}

        <div className="w-px h-4 bg-border mx-1 flex-shrink-0" />

        <button
          onClick={() => regionId !== null && onRegionChange(null)}
          className={`px-3.5 py-1.5 rounded-lg text-[11px] font-medium border transition-colors whitespace-nowrap flex items-center gap-1 ${
            regionId !== null
              ? "bg-accent-blue/15 text-accent-blue border-accent-blue/25"
              : "bg-bg-surface text-text-secondary border-border"
          }`}
        >
          {regionId !== null ? (
            <>
              <span>{regionId}</span>
              <span
                role="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRegionChange(null);
                }}
                className="ml-0.5 opacity-70 hover:opacity-100"
              >
                ✕
              </span>
            </>
          ) : (
            <span>All Regions ↓</span>
          )}
        </button>
      </div>
    </div>
  );
}
