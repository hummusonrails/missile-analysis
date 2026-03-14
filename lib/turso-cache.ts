"use client";

// Client-side data layer that fetches from our API routes instead of Turso directly.
// This avoids browser URL/token issues and keeps credentials server-side.

interface CacheEntry {
  data: unknown;
  fetchedAt: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 60_000; // 60 seconds

async function fetchFromApi(endpoint: string): Promise<unknown> {
  const cached = cache.get(endpoint);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return cached.data;
  }

  const res = await fetch(endpoint);
  if (!res.ok) {
    throw new Error(`API ${endpoint} returned ${res.status}`);
  }

  const data = await res.json();
  cache.set(endpoint, { data, fetchedAt: Date.now() });
  return data;
}

export async function queryAnalytics(key: string): Promise<unknown> {
  return fetchFromApi(`/api/analytics?key=${encodeURIComponent(key)}`);
}

export async function queryAlerts(params: string): Promise<unknown> {
  return fetchFromApi(`/api/alerts?${params}`);
}

export async function queryAlertsFeed(params: string): Promise<unknown> {
  // Feed queries are not cached (each page is unique)
  const res = await fetch(`/api/alerts?${params}`);
  if (!res.ok) throw new Error(`API returned ${res.status}`);
  return res.json();
}

export async function queryCityCoords(): Promise<unknown> {
  return fetchFromApi("/api/cities");
}
