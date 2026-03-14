"use client";

import { useState, useEffect, useCallback } from "react";
import { cachedQuery, directQuery } from "../turso-cache";
import type { Alert, FilterState } from "../types";

function buildWhereClause(filter: FilterState): { sql: string; args: unknown[] } {
  const conditions: string[] = [];
  const args: unknown[] = [];
  const now = Date.now();

  switch (filter.timeRange) {
    case "24h":
      conditions.push("timestamp > ?");
      args.push(now - 24 * 60 * 60 * 1000);
      break;
    case "7d":
      conditions.push("timestamp > ?");
      args.push(now - 7 * 24 * 60 * 60 * 1000);
      break;
    case "30d":
      conditions.push("timestamp > ?");
      args.push(now - 30 * 24 * 60 * 60 * 1000);
      break;
    case "custom":
      if (filter.customStart) {
        conditions.push("timestamp > ?");
        args.push(filter.customStart);
      }
      if (filter.customEnd) {
        conditions.push("timestamp < ?");
        args.push(filter.customEnd);
      }
      break;
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  return { sql: where, args };
}

export function useAlerts(filter: FilterState) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const { sql: where, args } = buildWhereClause(filter);
    cachedQuery(
      `SELECT id, timestamp, cities, threat, created_at FROM alerts ${where} ORDER BY timestamp DESC LIMIT 500`,
      args
    ).then((result) => {
      if (cancelled) return;
      setAlerts(
        result.rows.map((r) => ({
          id: r.id as string,
          timestamp: r.timestamp as number,
          cities: JSON.parse(r.cities as string),
          threat: r.threat as number,
          created_at: r.created_at as number,
        }))
      );
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

    const cursor = alerts.length > 0 ? alerts[alerts.length - 1].timestamp : Date.now();
    const { sql: where, args } = buildWhereClause(filter);
    const cursorCondition = where ? ` AND timestamp < ?` : `WHERE timestamp < ?`;

    const result = await directQuery(
      `SELECT id, timestamp, cities, threat, created_at FROM alerts ${where}${cursorCondition} ORDER BY timestamp DESC LIMIT 50`,
      [...args, cursor]
    );

    const newAlerts = result.rows.map((r) => ({
      id: r.id as string,
      timestamp: r.timestamp as number,
      cities: JSON.parse(r.cities as string),
      threat: r.threat as number,
      created_at: r.created_at as number,
    }));

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
