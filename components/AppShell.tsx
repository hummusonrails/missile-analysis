"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { TabBar } from "./TabBar";
import { FilterChips } from "./FilterChips";
import { MapStats } from "./map/MapStats";
import { BottomSheet } from "./map/BottomSheet";
import { useFilterState } from "../lib/hooks/use-filter-state";
import { useAlerts } from "../lib/hooks/use-alerts";
import { useCityCoords } from "../lib/hooks/use-city-coords";
import type { Alert } from "../lib/types";
import { AnalyticsView } from "./analytics/AnalyticsView";
import { FeedView } from "./feed/FeedView";
import { LanguageToggle } from "./LanguageToggle";
import { StatusBanner } from "./StatusBanner";
import { useI18n } from "../lib/i18n";

type Tab = "map" | "analytics" | "feed";

// Dynamically import AlertMap with SSR disabled — Leaflet requires browser APIs
const AlertMap = dynamic(() => import("./map/AlertMap"), { ssr: false });

export function AppShell() {
  const [activeTab, setActiveTab] = useState<Tab>("map");
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const { t } = useI18n();

  const { filter, setTimeRange, setCustomRange, setRegion } = useFilterState();
  const { alerts } = useAlerts(filter);
  const { coords: cityCoords } = useCityCoords();

  // Compute stats
  const { alertCount, regionCount, lastAlertMinutes } = useMemo(() => {
    const count = alerts.length;

    // Unique regions from all cities across all alerts
    const regions = new Set<string>();
    for (const alert of alerts) {
      for (const city of alert.cities) {
        const coord = cityCoords.get(city);
        if (coord?.region_id) regions.add(coord.region_id);
      }
    }

    // Minutes since the most recent alert
    let minutes: number | null = null;
    if (alerts.length > 0) {
      const latestTs = alerts[0].timestamp; // already sorted DESC
      minutes = Math.floor((Date.now() - latestTs) / 60_000);
    }

    return { alertCount: count, regionCount: regions.size, lastAlertMinutes: minutes };
  }, [alerts, cityCoords]);

  function handleShowInFeed() {
    setSelectedAlert(null);
    setActiveTab("feed");
  }

  function handleShowOnMap(alert: Alert) {
    setSelectedAlert(alert);
    setActiveTab("map");
  }

  return (
    <div className="h-dvh flex flex-col bg-bg-primary">
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-accent-red rounded-full shadow-[0_0_8px_theme(colors.accent-red/40)] animate-pulse" />
          <h1 className="font-serif text-[17px] tracking-tight text-text-primary">{t("app.title")}</h1>
        </div>
        <LanguageToggle />
      </header>

      {/* Filters */}
      <FilterChips
        activeRange={filter.timeRange}
        onRangeChange={setTimeRange}
        regionId={filter.regionId}
        onRegionChange={setRegion}
      />

      {/* System status */}
      <StatusBanner />

      {/* Content area */}
      <main className="flex-1 overflow-hidden">
        {activeTab === "map" && (
          <div className="h-full flex flex-col">
            {/* Stats strip */}
            <MapStats
              alertCount={alertCount}
              regionCount={regionCount}
              lastAlertMinutes={lastAlertMinutes}
            />

            {/* Map container */}
            <div className="flex-1 relative overflow-hidden">
              <AlertMap
                alerts={alerts}
                cityCoords={cityCoords}
                onAlertSelect={setSelectedAlert}
              />

              {/* Bottom sheet */}
              {selectedAlert && (
                <BottomSheet
                  alert={selectedAlert}
                  cityCoords={cityCoords}
                  onClose={() => setSelectedAlert(null)}
                  onShowInFeed={handleShowInFeed}
                />
              )}
            </div>
          </div>
        )}

        {activeTab === "analytics" && <AnalyticsView regionId={filter.regionId} />}

        {activeTab === "feed" && (
          <FeedView filter={filter} onAlertTap={handleShowOnMap} />
        )}
      </main>

      {/* Tab bar */}
      <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}
