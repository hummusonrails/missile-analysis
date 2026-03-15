"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { FilterState, TimeRange } from "../types";
import { VALID_REGION_IDS } from "../regions";

const VALID_TIME_RANGES = new Set<TimeRange>(["24h", "7d", "30d", "custom"]);

function readInitialFilter(): FilterState {
  if (typeof window === "undefined") return { timeRange: "24h", regionId: null };

  const params = new URLSearchParams(window.location.search);

  const timeRangeParam = params.get("timeRange") as TimeRange | null;
  const timeRange = timeRangeParam && VALID_TIME_RANGES.has(timeRangeParam) ? timeRangeParam : "24h";

  const regionParam = params.get("region");
  const regionId = regionParam && VALID_REGION_IDS.has(regionParam) ? regionParam : null;

  const filter: FilterState = { timeRange, regionId };

  if (timeRange === "custom") {
    const start = Number(params.get("customStart"));
    const end = Number(params.get("customEnd"));
    if (start > 0 && end > 0 && end > start) {
      filter.customStart = start;
      filter.customEnd = end;
    } else {
      filter.timeRange = "24h";
    }
  }

  return filter;
}

function writeFilterToUrl(filter: FilterState, tab: string): void {
  if (typeof window === "undefined") return;

  const params = new URLSearchParams();
  if (filter.timeRange !== "24h") params.set("timeRange", filter.timeRange);
  if (filter.regionId) params.set("region", filter.regionId);
  if (tab !== "map") params.set("tab", tab);
  if (filter.timeRange === "custom" && filter.customStart && filter.customEnd) {
    params.set("customStart", String(filter.customStart));
    params.set("customEnd", String(filter.customEnd));
  }

  const qs = params.toString();
  const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
  window.history.replaceState(null, "", url);
}

export function useFilterState(tab?: string) {
  const [filter, setFilter] = useState<FilterState>(readInitialFilter);
  const tabRef = useRef(tab ?? "map");
  tabRef.current = tab ?? "map";

  useEffect(() => {
    writeFilterToUrl(filter, tabRef.current);
  }, [filter]);

  const setTimeRange = useCallback((range: TimeRange) => {
    setFilter((prev) => ({ ...prev, timeRange: range, customStart: undefined, customEnd: undefined }));
  }, []);

  const setCustomRange = useCallback((start: number, end: number) => {
    setFilter((prev) => ({ ...prev, timeRange: "custom" as TimeRange, customStart: start, customEnd: end }));
  }, []);

  const setRegion = useCallback((regionId: string | null) => {
    setFilter((prev) => ({ ...prev, regionId }));
  }, []);

  return { filter, setTimeRange, setCustomRange, setRegion };
}

export function readInitialTab(): string {
  if (typeof window === "undefined") return "map";
  const params = new URLSearchParams(window.location.search);
  const tab = params.get("tab");
  const valid = new Set(["map", "analytics", "feed", "ai"]);
  return tab && valid.has(tab) ? tab : "map";
}
