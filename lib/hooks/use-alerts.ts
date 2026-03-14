"use client";

import { useState, useEffect, useCallback } from "react";
import { queryAlerts, queryAlertsFeed } from "../turso-cache";
import type { Alert, FilterState } from "../types";

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

export function useAlerts(filter: FilterState) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const params = buildParams(filter);
    params.set("limit", "5000");

    queryAlerts(params.toString())
      .then((result) => {
        if (cancelled) return;
        setAlerts(result as Alert[]);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [filter.timeRange, filter.customStart, filter.customEnd, filter.regionId]);

  return { alerts, loading };
}

export function useAlertFeed(filter: FilterState) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);

    const params = buildParams(filter);
    params.set("limit", "50");
    const cursor = alerts.length > 0 ? alerts[alerts.length - 1].timestamp : Date.now();
    params.set("cursor", String(cursor));

    const newAlerts = (await queryAlertsFeed(params.toString())) as Alert[];

    setAlerts((prev) => [...prev, ...newAlerts]);
    setHasMore(newAlerts.length === 50);
    setLoading(false);
  }, [alerts, loading, hasMore, filter]);

  useEffect(() => {
    setAlerts([]);
    setHasMore(true);
  }, [filter.timeRange, filter.customStart, filter.customEnd, filter.regionId]);

  return { alerts, loading, hasMore, loadMore };
}
