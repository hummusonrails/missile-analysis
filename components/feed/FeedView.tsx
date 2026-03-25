"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useAlertFeed } from "../../lib/hooks/use-alerts";
import { usePreAlerts } from "../../lib/hooks/use-pre-alerts";
import { useCityCoords } from "../../lib/hooks/use-city-coords";
import { FeedSearch } from "./FeedSearch";
import { FeedItem } from "./FeedItem";
import { PreAlertFeedItem } from "./PreAlertFeedItem";
import type { Alert, PreAlert, FilterState } from "../../lib/types";
import { useI18n } from "../../lib/i18n";

interface FeedViewProps {
  filter: FilterState;
  onAlertTap: (alert: Alert) => void;
}

export function FeedView({ filter, onAlertTap }: FeedViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const [showPreAlerts, setShowPreAlerts] = useState(true);
  const { alerts, loading, hasMore, loadMore } = useAlertFeed(filter);
  const { preAlerts } = usePreAlerts(filter);
  const { coords: cityCoords } = useCityCoords();
  const { lang, t } = useI18n();

  // Initial load on mount
  useEffect(() => {
    loadMore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Infinite scroll handler
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || loading || !hasMore) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceFromBottom < 200) {
      loadMore();
    }
  }, [loading, hasMore, loadMore]);

  // Client-side filtering: search + region
  const filteredAlerts = alerts.filter((alert) => {
    // Region filter from filter state
    if (filter.regionId) {
      const hasRegion = alert.cities.some(
        (city) => cityCoords.get(city)?.region_id === filter.regionId
      );
      if (!hasRegion) return false;
    }

    // Search filter (bilingual)
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const matchesCity = alert.cities.some((city) => {
        const coord = cityCoords.get(city);
        const hebrewName = city.toLowerCase();
        const englishName = (coord?.city_name_en ?? "").toLowerCase();
        return hebrewName.includes(q) || englishName.includes(q);
      });
      const matchesRegion = alert.cities.some((city) => {
        const regionId = (cityCoords.get(city)?.region_id ?? "").toLowerCase();
        return regionId.includes(q);
      });
      if (!matchesCity && !matchesRegion) return false;
    }

    return true;
  });

  // Merge alerts and pre-alerts into a unified chronological feed
  type FeedEntry =
    | { kind: "alert"; data: Alert }
    | { kind: "pre_alert"; data: PreAlert };

  const mergedFeed = useMemo(() => {
    const entries: FeedEntry[] = filteredAlerts.map((a) => ({ kind: "alert" as const, data: a }));

    if (showPreAlerts) {
      for (const pa of preAlerts) {
        // Region filter for pre-alerts
        if (filter.regionId && pa.regions.length > 0) {
          if (!pa.regions.includes(filter.regionId)) continue;
        }
        entries.push({ kind: "pre_alert" as const, data: pa });
      }
    }

    entries.sort((a, b) => b.data.timestamp - a.data.timestamp);
    return entries;
  }, [filteredAlerts, preAlerts, showPreAlerts, filter.regionId]);

  return (
    <div className="h-full flex flex-col">
      {/* Search bar + pre-alert toggle */}
      <div className="flex-shrink-0 pt-2 space-y-2">
        <FeedSearch value={searchQuery} onChange={setSearchQuery} />
        {preAlerts.length > 0 && (
          <div className="px-4">
            <button
              onClick={() => setShowPreAlerts((v) => !v)}
              className={[
                "text-[11px] px-2.5 py-1 rounded-full border transition-colors",
                showPreAlerts
                  ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                  : "bg-bg-surface text-text-tertiary border-border",
              ].join(" ")}
            >
              {lang === "he" ? "התרעות מוקדמות" : "Pre-Alerts"}{" "}
              ({preAlerts.length})
            </button>
          </div>
        )}
      </div>

      {/* Scrollable alert list */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto"
      >
        <div className="px-4 pb-4 flex flex-col gap-2">
          {mergedFeed.map((entry) =>
            entry.kind === "alert" ? (
              <FeedItem
                key={entry.data.id}
                alert={entry.data}
                cityCoords={cityCoords}
                onTap={onAlertTap}
              />
            ) : (
              <PreAlertFeedItem
                key={entry.data.id}
                preAlert={entry.data}
              />
            )
          )}

          {/* Loading indicator */}
          {loading && (
            <div className="flex justify-center py-6">
              <div className="flex items-center gap-2 text-text-tertiary text-[12px]">
                <svg
                  className="animate-spin w-3.5 h-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                  />
                </svg>
                Loading alerts…
              </div>
            </div>
          )}

          {/* End of feed */}
          {!loading && !hasMore && filteredAlerts.length > 0 && (
            <div className="flex justify-center py-6">
              <span className="text-[11px] text-text-tertiary">
                {lang === "he" ? "סוף ההתרעות" : "End of alerts"}
              </span>
            </div>
          )}

          {/* Empty state */}
          {!loading && filteredAlerts.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <span className="text-[13px] text-text-secondary">{lang === "he" ? "לא נמצאו התרעות" : "No alerts found"}</span>
              {searchQuery && (
                <span className="text-[11px] text-text-tertiary">
                  {lang === "he" ? "נסו מונח חיפוש אחר" : "Try a different search term"}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
