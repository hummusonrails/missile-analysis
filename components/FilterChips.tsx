"use client";

import { useState, useRef, useEffect } from "react";
import type { TimeRange } from "../lib/types";
import { useI18n } from "../lib/i18n";

const REGIONS = [
  { id: "western-galilee", label: "Western Galilee" },
  { id: "upper-galilee", label: "Upper Galilee" },
  { id: "lower-galilee", label: "Lower Galilee" },
  { id: "haifa-krayot", label: "Haifa & Krayot" },
  { id: "jezreel-valley", label: "Jezreel Valley" },
  { id: "golan-heights", label: "Golan Heights" },
  { id: "sharon", label: "Sharon" },
  { id: "tel-aviv-gush-dan", label: "Tel Aviv & Gush Dan" },
  { id: "central", label: "Central" },
  { id: "jerusalem", label: "Jerusalem" },
  { id: "shfela", label: "Shfela" },
  { id: "ashkelon-coast", label: "Ashkelon Coast" },
  { id: "negev", label: "Negev" },
  { id: "gaza-envelope", label: "Gaza Envelope" },
  { id: "eilat-arava", label: "Eilat & Arava" },
];

interface FilterChipsProps {
  activeRange: TimeRange;
  onRangeChange: (range: TimeRange) => void;
  onCustomRange: (start: number, end: number) => void;
  regionId: string | null;
  onRegionChange: (regionId: string | null) => void;
  alertCount?: number;
  loading?: boolean;
}

const TIME_RANGE_KEYS: { value: TimeRange; key: string }[] = [
  { value: "24h", key: "filter.24h" },
  { value: "7d", key: "filter.7d" },
  { value: "30d", key: "filter.30d" },
  { value: "custom", key: "filter.custom" },
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
  const { t } = useI18n();
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showRegionPicker, setShowRegionPicker] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const regionRef = useRef<HTMLDivElement>(null);

  // Close region dropdown on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (regionRef.current && !regionRef.current.contains(e.target as Node)) {
        setShowRegionPicker(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

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
          {TIME_RANGE_KEYS.map(({ value, key }) => {
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
                {t(key)}
              </button>
            );
          })}

          <div className="w-px h-4 bg-border mx-1 flex-shrink-0" />

          <div className="relative" ref={regionRef}>
            <button
              onClick={() => setShowRegionPicker((prev) => !prev)}
              className={`px-3.5 py-1.5 rounded-lg text-[11px] font-medium border transition-colors whitespace-nowrap flex items-center gap-1 ${
                regionId !== null
                  ? "bg-accent-blue/15 text-accent-blue border-accent-blue/25"
                  : "bg-bg-surface text-text-secondary border-border"
              }`}
            >
              {regionId !== null ? (
                <>
                  <span>{REGIONS.find((r) => r.id === regionId)?.label ?? regionId}</span>
                  <span
                    role="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRegionChange(null);
                      setShowRegionPicker(false);
                    }}
                    className="ml-0.5 opacity-70 hover:opacity-100"
                  >
                    ✕
                  </span>
                </>
              ) : (
                <span>{t("filter.allRegions")} ↓</span>
              )}
            </button>

            {showRegionPicker && (
              <div className="absolute top-full left-0 mt-1 z-50 bg-bg-elevated border border-border-active rounded-xl shadow-2xl overflow-hidden min-w-[200px] max-h-[300px] overflow-y-auto">
                <button
                  onClick={() => { onRegionChange(null); setShowRegionPicker(false); }}
                  className={`w-full text-left px-3.5 py-2.5 text-[12px] transition-colors ${
                    regionId === null ? "bg-accent-blue/10 text-accent-blue font-medium" : "text-text-secondary hover:bg-bg-surface-hover"
                  }`}
                >
                  All Regions
                </button>
                {REGIONS.map((region) => (
                  <button
                    key={region.id}
                    onClick={() => { onRegionChange(region.id); setShowRegionPicker(false); }}
                    className={`w-full text-left px-3.5 py-2.5 text-[12px] border-t border-border transition-colors ${
                      regionId === region.id ? "bg-accent-blue/10 text-accent-blue font-medium" : "text-text-secondary hover:bg-bg-surface-hover"
                    }`}
                  >
                    {region.label}
                  </button>
                ))}
              </div>
            )}
          </div>

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
