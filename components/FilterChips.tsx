"use client";

import { useState } from "react";
import type { TimeRange } from "../lib/types";

interface FilterChipsProps {
  activeRange: TimeRange;
  onRangeChange: (range: TimeRange) => void;
  onCustomRange: (start: number, end: number) => void;
  regionId: string | null;
  onRegionChange: (regionId: string | null) => void;
  alertCount?: number;
  loading?: boolean;
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
  onCustomRange,
  regionId,
  onRegionChange,
  alertCount,
  loading,
}: FilterChipsProps) {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  function handleChipClick(value: TimeRange) {
    if (value === "custom") {
      setShowDatePicker(true);
    } else {
      setShowDatePicker(false);
      onRangeChange(value);
    }
  }

  function handleApplyCustom() {
    if (startDate && endDate) {
      const start = new Date(startDate).getTime();
      const end = new Date(endDate).getTime() + 86400000; // end of day
      onCustomRange(start, end);
      setShowDatePicker(false);
    }
  }

  return (
    <div className="flex-shrink-0">
      <div className="overflow-x-auto scrollbar-hide">
        <div className="flex items-center gap-2 px-4 py-2.5 w-max">
          {TIME_RANGES.map(({ value, label }) => {
            const active = activeRange === value;
            return (
              <button
                key={value}
                onClick={() => handleChipClick(value)}
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

          {/* Alert count indicator */}
          {alertCount !== undefined && (
            <>
              <div className="w-px h-4 bg-border mx-1 flex-shrink-0" />
              <span className={`text-[11px] font-mono font-medium ${loading ? "text-text-tertiary animate-pulse" : "text-text-secondary"}`}>
                {loading ? "..." : `${alertCount.toLocaleString()} alerts`}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Custom date range picker */}
      {showDatePicker && (
        <div className="flex items-center gap-2 px-4 pb-2.5">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="bg-bg-surface border border-border rounded-lg px-3 py-1.5 text-[11px] text-text-primary outline-none focus:border-accent-blue/50"
          />
          <span className="text-text-tertiary text-[11px]">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="bg-bg-surface border border-border rounded-lg px-3 py-1.5 text-[11px] text-text-primary outline-none focus:border-accent-blue/50"
          />
          <button
            onClick={handleApplyCustom}
            disabled={!startDate || !endDate}
            className="px-3 py-1.5 rounded-lg text-[11px] font-medium bg-accent-blue text-white disabled:opacity-30 transition-opacity"
          >
            Apply
          </button>
          <button
            onClick={() => setShowDatePicker(false)}
            className="px-2 py-1.5 text-[11px] text-text-tertiary"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
