"use client";

import { useState, useEffect } from "react";
import { queryPreAlerts } from "../turso-cache";
import type { PreAlert, FilterState } from "../types";

const REFRESH_INTERVAL = 30_000; // 30 seconds — pre-alerts are more time-sensitive

function buildParams(filter: FilterState): URLSearchParams {
  const params = new URLSearchParams();
  const now = Date.now();

  switch (filter.timeRange) {
    case "24h":
      params.set("since", String(now - 24 * 60 * 60 * 1000));
      break;
    case "7d":
      params.set("since", String(now - 7 * 24 * 60 * 60 * 1000));
      break;
    case "30d":
      params.set("since", String(now - 30 * 24 * 60 * 60 * 1000));
      break;
    case "custom":
      if (filter.customStart) params.set("since", String(filter.customStart));
      if (filter.customEnd) params.set("cursor", String(filter.customEnd));
      break;
  }

  return params;
}

export function usePreAlerts(filter: FilterState) {
  const [preAlerts, setPreAlerts] = useState<PreAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    function fetchPreAlerts() {
      setLoading(true);
      const params = buildParams(filter);
      params.set("limit", "200");

      queryPreAlerts(params.toString())
        .then((result) => {
          if (cancelled) return;
          setPreAlerts(result as PreAlert[]);
          setLoading(false);
        })
        .catch(() => {
          if (cancelled) return;
          setLoading(false);
        });
    }

    fetchPreAlerts();
    const interval = setInterval(fetchPreAlerts, REFRESH_INTERVAL);

    return () => { cancelled = true; clearInterval(interval); };
  }, [filter.timeRange, filter.customStart, filter.customEnd, filter.regionId]);

  return { preAlerts, loading };
}
