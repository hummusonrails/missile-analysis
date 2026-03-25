"use client";

import { useMemo } from "react";
import type { Alert, PreAlert, CityCoord } from "../types";

export interface PreAlertAnalytics {
  totalWarnings: number;
  totalExits: number;
  avgLeadTimeMinutes: number | null;
  coveragePercent: number | null;
  leadTimes: number[];  // individual lead times in minutes for chart
  regionBreakdown: { region: string; warnings: number; covered: number }[];
}

/**
 * Compute pre-alert analytics by cross-referencing pre-alerts with actual siren alerts.
 *
 * Lead time: For each early_warning, find the first siren alert in the same region
 * within 30 minutes after the warning. The gap is the lead time.
 *
 * Coverage: What % of siren event groups were preceded by a pre-alert in the same
 * region within the preceding 30 minutes?
 */
export function usePreAlertAnalytics(
  alerts: Alert[],
  preAlerts: PreAlert[],
  cityCoords: Map<string, CityCoord>
): PreAlertAnalytics | null {
  return useMemo(() => {
    if (preAlerts.length === 0) return null;

    const warnings = preAlerts.filter((pa) => pa.alert_type === "early_warning");
    const exits = preAlerts.filter((pa) => pa.alert_type === "exit_notification");

    // Build a region → sorted timestamps map for siren alerts
    const alertsByRegion = new Map<string, number[]>();
    for (const alert of alerts) {
      for (const city of alert.cities) {
        const coord = cityCoords.get(city);
        if (coord?.region_id) {
          const existing = alertsByRegion.get(coord.region_id) || [];
          existing.push(alert.timestamp);
          alertsByRegion.set(coord.region_id, existing);
        }
      }
    }
    for (const [region, timestamps] of alertsByRegion) {
      alertsByRegion.set(region, timestamps.sort((a, b) => a - b));
    }

    // Compute lead times for each warning
    const leadTimes: number[] = [];
    const WINDOW_MS = 30 * 60_000; // 30 minute window

    for (const warning of warnings) {
      const regions = warning.regions.length > 0
        ? warning.regions
        : Array.from(alertsByRegion.keys()); // nationwide if no specific regions

      for (const region of regions) {
        const regionTimestamps = alertsByRegion.get(region);
        if (!regionTimestamps) continue;

        // Find first siren after this warning within 30 min
        const firstSirenAfter = regionTimestamps.find(
          (ts) => ts > warning.timestamp && ts - warning.timestamp <= WINDOW_MS
        );

        if (firstSirenAfter) {
          leadTimes.push(Math.round((firstSirenAfter - warning.timestamp) / 60_000));
          break; // count once per warning, not per region
        }
      }
    }

    // Average lead time
    const avgLeadTimeMinutes = leadTimes.length > 0
      ? Math.round((leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length) * 10) / 10
      : null;

    // Coverage: % of alert groups that had a preceding pre-alert
    const groupTimestamps = new Map<string, { ts: number; regions: Set<string> }>();
    for (const alert of alerts) {
      const groupId = alert.id.split("_")[0];
      const existing = groupTimestamps.get(groupId);
      const alertRegions = new Set<string>();
      for (const city of alert.cities) {
        const coord = cityCoords.get(city);
        if (coord?.region_id) alertRegions.add(coord.region_id);
      }

      if (!existing || alert.timestamp < existing.ts) {
        groupTimestamps.set(groupId, {
          ts: alert.timestamp,
          regions: existing ? new Set([...existing.regions, ...alertRegions]) : alertRegions,
        });
      } else {
        for (const r of alertRegions) existing.regions.add(r);
      }
    }

    let coveredGroups = 0;
    for (const group of groupTimestamps.values()) {
      const hadWarning = warnings.some((w) => {
        const timeDiff = group.ts - w.timestamp;
        if (timeDiff < 0 || timeDiff > WINDOW_MS) return false;
        if (w.regions.length === 0) return true; // nationwide
        return w.regions.some((r) => group.regions.has(r));
      });
      if (hadWarning) coveredGroups++;
    }

    const coveragePercent = groupTimestamps.size > 0
      ? Math.round((coveredGroups / groupTimestamps.size) * 100)
      : null;

    // Region breakdown
    const regionStats = new Map<string, { warnings: number; covered: number }>();
    for (const warning of warnings) {
      for (const region of warning.regions) {
        const stat = regionStats.get(region) || { warnings: 0, covered: 0 };
        stat.warnings++;
        regionStats.set(region, stat);
      }
    }
    for (const [groupId, group] of groupTimestamps) {
      for (const region of group.regions) {
        const hadWarningInRegion = warnings.some((w) => {
          const timeDiff = group.ts - w.timestamp;
          return timeDiff >= 0 && timeDiff <= WINDOW_MS && w.regions.includes(region);
        });
        if (hadWarningInRegion) {
          const stat = regionStats.get(region) || { warnings: 0, covered: 0 };
          stat.covered++;
          regionStats.set(region, stat);
        }
      }
    }

    const regionBreakdown = Array.from(regionStats.entries())
      .map(([region, stat]) => ({ region, ...stat }))
      .sort((a, b) => b.warnings - a.warnings);

    return {
      totalWarnings: warnings.length,
      totalExits: exits.length,
      avgLeadTimeMinutes,
      coveragePercent,
      leadTimes,
      regionBreakdown,
    };
  }, [alerts, preAlerts, cityCoords]);
}
