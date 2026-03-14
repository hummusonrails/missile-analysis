"use client";

import { MapContainer, TileLayer } from "react-leaflet";
import { AlertMarkers } from "./AlertMarkers";
import type { Alert, CityCoord } from "../../lib/types";

// Fix Leaflet default marker icon paths broken by webpack
import L from "leaflet";
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

interface AlertMapProps {
  alerts: Alert[];
  cityCoords: Map<string, CityCoord>;
  onAlertSelect: (alert: Alert) => void;
}

const ISRAEL_CENTER: [number, number] = [31.5, 34.8];
const DEFAULT_ZOOM = 7;
const TILE_URL = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

export default function AlertMap({ alerts, cityCoords, onAlertSelect }: AlertMapProps) {
  return (
    <MapContainer
      center={ISRAEL_CENTER}
      zoom={DEFAULT_ZOOM}
      zoomControl={false}
      scrollWheelZoom={true}
      style={{ width: "100%", height: "100%" }}
      className="bg-bg-primary"
    >
      <TileLayer
        url={TILE_URL}
        attribution={TILE_ATTRIBUTION}
        subdomains={["a", "b", "c", "d"]}
        maxZoom={19}
      />
      <AlertMarkers
        alerts={alerts}
        cityCoords={cityCoords}
        onAlertSelect={onAlertSelect}
      />
    </MapContainer>
  );
}
