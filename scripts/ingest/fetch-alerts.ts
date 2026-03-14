import type { Alert } from "../../lib/types";

interface RawAlert {
  time?: number;
  cities?: string[];
  threat?: number;
  isDrill?: boolean;
}

interface RawGroup {
  id?: number;
  alerts?: RawAlert[];
}

export function parseRawAlerts(raw: RawGroup[]): Alert[] {
  const alerts: Alert[] = [];
  const now = Date.now();

  for (const group of raw) {
    if (!group.id || !Array.isArray(group.alerts)) continue;

    for (const alert of group.alerts) {
      if (!alert.time || !Array.isArray(alert.cities) || alert.cities.length === 0) continue;
      if (alert.isDrill) continue;

      alerts.push({
        id: `${group.id}_${alert.time * 1000}`,
        timestamp: alert.time * 1000,
        cities: alert.cities,
        threat: alert.threat ?? 0,
        created_at: now,
      });
    }
  }

  return alerts;
}

export function deduplicateAlerts(alerts: Alert[], existingIds: Set<string>): Alert[] {
  return alerts.filter((a) => !existingIds.has(a.id));
}

const API_URL = "https://api.tzevaadom.co.il/alerts-history";

export async function fetchRawAlerts(): Promise<RawGroup[]> {
  const res = await fetch(API_URL, {
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`API returned ${res.status}: ${res.statusText}`);
  }

  const data = await res.json();

  if (!Array.isArray(data)) {
    throw new Error("API response is not an array");
  }

  return data;
}
