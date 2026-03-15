"use client";

import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet.markercluster";
import type { Alert, CityCoord } from "../../lib/types";

interface AlertMarkersProps {
  alerts: Alert[];
  cityCoords: Map<string, CityCoord>;
  onAlertSelect: (alert: Alert) => void;
}

export const THREAT_COLORS: Record<number, string> = {
  0: "#EF4444",  // Rockets — Red
  2: "#3B82F6",  // Infiltration — Blue
  3: "#10B981",  // Earthquake — Green
  5: "#F59E0B",  // Hostile Aircraft — Amber
  7: "#8B5CF6",  // Non-conventional — Purple
  8: "#6B7280",  // General — Gray
};

function getMarkerStyle(timestamp: number, threat: number): { color: string; radius: number; opacity: number; glow: boolean } {
  const ageMs = Date.now() - timestamp;
  const ageHours = ageMs / (1000 * 60 * 60);
  const color = THREAT_COLORS[threat] ?? "#6B7280";

  if (ageHours < 1) {
    return { color, radius: 10, opacity: 1.0, glow: true };
  } else if (ageHours < 6) {
    return { color, radius: 8, opacity: 0.8, glow: false };
  } else {
    return { color, radius: 6, opacity: 0.5, glow: false };
  }
}

function createClusterIcon(count: number): L.DivIcon {
  const size = count > 99 ? 44 : count > 9 ? 38 : 32;
  return L.divIcon({
    html: `<div style="
      width: ${size}px;
      height: ${size}px;
      background: rgba(239,68,68,0.85);
      border: 2px solid rgba(239,68,68,0.4);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'JetBrains Mono', monospace;
      font-size: ${count > 99 ? 11 : 13}px;
      font-weight: 700;
      color: #fff;
      box-shadow: 0 0 12px rgba(239,68,68,0.5);
    ">${count}</div>`,
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

export function AlertMarkers({ alerts, cityCoords, onAlertSelect }: AlertMarkersProps) {
  const map = useMap();
  const clusterGroupRef = useRef<L.MarkerClusterGroup | null>(null);

  useEffect(() => {
    // Create cluster group
    const clusterGroup = L.markerClusterGroup({
      maxClusterRadius: 50,
      iconCreateFunction: (cluster) => createClusterIcon(cluster.getChildCount()),
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      spiderfyOnMaxZoom: true,
    });
    clusterGroupRef.current = clusterGroup;

    // Build a map: city -> alerts (to avoid duplicate markers per city)
    const cityAlertMap = new Map<string, Alert>();

    for (const alert of alerts) {
      for (const city of alert.cities) {
        // Keep the most recent alert per city location
        const existing = cityAlertMap.get(city);
        if (!existing || alert.timestamp > existing.timestamp) {
          cityAlertMap.set(city, alert);
        }
      }
    }

    // Add circle markers
    for (const [city, alert] of cityAlertMap.entries()) {
      const coord = cityCoords.get(city);
      if (!coord) continue;

      const { color, radius, opacity, glow } = getMarkerStyle(alert.timestamp, alert.threat);

      const marker = L.circleMarker([coord.lat, coord.lng], {
        radius,
        fillColor: color,
        fillOpacity: opacity,
        color: glow ? color : "rgba(255,255,255,0.15)",
        weight: glow ? 2 : 1,
        className: glow ? "alert-marker-glow" : "",
      });

      marker.on("click", () => {
        onAlertSelect(alert);
      });

      clusterGroup.addLayer(marker);
    }

    map.addLayer(clusterGroup);

    return () => {
      map.removeLayer(clusterGroup);
      clusterGroup.clearLayers();
    };
  }, [alerts, cityCoords, map, onAlertSelect]);

  return null;
}
