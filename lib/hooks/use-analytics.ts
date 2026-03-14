"use client";

import { useState, useEffect } from "react";
import { cachedQuery } from "../turso-cache";

export function useAnalytics<T = unknown>(key: string, regionId: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const effectiveKey = regionId ? `${key}::${regionId}` : key;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    cachedQuery("SELECT data, computed_at FROM analytics_cache WHERE key = ?", [effectiveKey])
      .then((result) => {
        if (cancelled) return;
        if (result.rows.length > 0) {
          setData(JSON.parse(result.rows[0].data as string));
        } else {
          setData(null);
        }
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err);
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [effectiveKey]);

  return { data, loading, error };
}
