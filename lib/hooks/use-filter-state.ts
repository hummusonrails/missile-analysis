"use client";

import { useState, useCallback } from "react";
import type { FilterState, TimeRange } from "../types";

export function useFilterState() {
  const [filter, setFilter] = useState<FilterState>({
    timeRange: "24h",
    regionId: null,
  });

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
