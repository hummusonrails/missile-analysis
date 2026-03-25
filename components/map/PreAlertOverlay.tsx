"use client";

import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import type { PreAlert, CityCoord } from "../../lib/types";

interface PreAlertOverlayProps {
  preAlerts: PreAlert[];
  cityCoords: Map<string, CityCoord>;
}

// Region center coordinates (approximate centroids for visual overlay)
const REGION_CENTERS: Record<string, [number, number]> = {
  "upper-galilee": [33.05, 35.5],
  "lower-galilee": [32.75, 35.35],
  "haifa-krayot": [32.8, 35.0],
  "jezreel-valley": [32.6, 35.3],
  "golan-heights": [33.0, 35.75],
  "sharon": [32.3, 34.9],
  "tel-aviv-gush-dan": [32.08, 34.78],
  "shfela": [31.75, 34.85],
  "jerusalem": [31.77, 35.21],
  "ashkelon-coast": [31.62, 34.56],
  "negev": [31.25, 34.79],
  "gaza-envelope": [31.38, 34.4],
  "eilat-arava": [29.95, 35.0],
  "yehuda-vshomron": [32.0, 35.25],
};

export function PreAlertOverlay({ preAlerts, cityCoords }: PreAlertOverlayProps) {
  const map = useMap();
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    const layerGroup = L.layerGroup();
    layerGroupRef.current = layerGroup;

    // Only show early warnings from the last 30 minutes
    const cutoff = Date.now() - 30 * 60_000;
    const activeWarnings = preAlerts.filter(
      (pa) => pa.alert_type === "early_warning" && pa.timestamp > cutoff
    );

    // Collect all active regions
    const activeRegions = new Set<string>();
    for (const pa of activeWarnings) {
      for (const region of pa.regions) {
        activeRegions.add(region);
      }
    }

    // If no specific regions, but there are active warnings, it's nationwide
    if (activeWarnings.length > 0 && activeRegions.size === 0) {
      for (const regionId of Object.keys(REGION_CENTERS)) {
        activeRegions.add(regionId);
      }
    }

    // Create pulsing circle overlays for each active region
    for (const regionId of activeRegions) {
      const center = REGION_CENTERS[regionId];
      if (!center) continue;

      // Outer pulsing ring
      const pulseCircle = L.circle(center, {
        radius: 15000,
        color: "#F59E0B",
        weight: 2,
        opacity: 0.6,
        fillColor: "#F59E0B",
        fillOpacity: 0.08,
        className: "pre-alert-pulse",
      });

      // Inner solid indicator
      const innerCircle = L.circle(center, {
        radius: 5000,
        color: "#F59E0B",
        weight: 1.5,
        opacity: 0.8,
        fillColor: "#F59E0B",
        fillOpacity: 0.15,
      });

      // Tooltip
      const latestWarning = activeWarnings.find((pa) => pa.regions.includes(regionId)) || activeWarnings[0];
      if (latestWarning) {
        const minutesAgo = Math.floor((Date.now() - latestWarning.timestamp) / 60_000);
        innerCircle.bindTooltip(
          `⚠ Pre-Alert: ${regionId.replace(/-/g, " ")}<br/>${minutesAgo}m ago`,
          { direction: "top", className: "pre-alert-tooltip" }
        );
      }

      layerGroup.addLayer(pulseCircle);
      layerGroup.addLayer(innerCircle);
    }

    layerGroup.addTo(map);

    return () => {
      map.removeLayer(layerGroup);
      layerGroup.clearLayers();
    };
  }, [preAlerts, cityCoords, map]);

  return null;
}
