"use client";

import { useState, useEffect } from "react";
import { queryAnalytics } from "../turso-cache";

export function useAnalytics<T = unknown>(key: string, regionId: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const effectiveKey = regionId ? `${key}::${regionId}` : key;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    queryAnalytics(effectiveKey)
      .then((result) => {
        if (cancelled) return;
        setData(result as T);
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
