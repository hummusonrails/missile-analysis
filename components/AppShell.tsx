"use client";

import { useState, useMemo, useEffect } from "react";
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
import { Footer } from "./Footer";
import { useI18n } from "../lib/i18n";
import { useAI } from "./ai/AIProvider";
import { AITab } from "./ai/AITab";

type Tab = "map" | "analytics" | "feed" | "ai";

// Dynamically import AlertMap with SSR disabled — Leaflet requires browser APIs
const AlertMap = dynamic(() => import("./map/AlertMap"), { ssr: false });

export function AppShell() {
  const [activeTab, setActiveTab] = useState<Tab>("map");
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [pendingAIQuestion, setPendingAIQuestion] = useState<string | undefined>();
  const { t } = useI18n();
  const { available: aiAvailable, clearMessages } = useAI();

  const { filter, setTimeRange, setCustomRange, setRegion } = useFilterState();
  const { alerts: allAlerts } = useAlerts(filter);
  const { coords: cityCoords } = useCityCoords();

  // Filter alerts by region (client-side since cities are stored as JSON)
  const alerts = useMemo(() => {
    if (!filter.regionId) return allAlerts;
    return allAlerts.filter((alert) =>
      alert.cities.some((city) => cityCoords.get(city)?.region_id === filter.regionId)
    );
  }, [allAlerts, filter.regionId, cityCoords]);

  // Compute stats from filtered alerts
  const { alertCount, regionCount, lastAlertMinutes, mappedCount } = useMemo(() => {
    const count = alerts.length;

    const regions = new Set<string>();
    let mapped = 0;
    for (const alert of alerts) {
      let alertMapped = false;
      for (const city of alert.cities) {
        const coord = cityCoords.get(city);
        if (coord?.region_id) {
          regions.add(coord.region_id);
          alertMapped = true;
        }
      }
      if (alertMapped) mapped++;
    }

    let minutes: number | null = null;
    if (alerts.length > 0) {
      const latestTs = alerts[0].timestamp;
      minutes = Math.floor((Date.now() - latestTs) / 60_000);
    }

    return { alertCount: count, regionCount: regions.size, lastAlertMinutes: minutes, mappedCount: mapped };
  }, [alerts, cityCoords]);

  // Clear AI messages when filter changes
  useEffect(() => {
    clearMessages();
  }, [filter, clearMessages]);

  function handleTabChange(tab: Tab) {
    if (activeTab === "ai" && tab !== "ai") {
      setPendingAIQuestion(undefined);
    }
    setActiveTab(tab);
  }

  function handleAskAI(question: string) {
    setPendingAIQuestion(question);
    setActiveTab("ai");
  }

  function handleShowInFeed() {
    setSelectedAlert(null);
    handleTabChange("feed");
  }

  function handleShowOnMap(alert: Alert) {
    setSelectedAlert(alert);
    handleTabChange("map");
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
        onCustomRange={setCustomRange}
        regionId={filter.regionId}
        onRegionChange={setRegion}
        alertCount={alertCount}
        loading={false}
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
              mappedCount={mappedCount}
              regionCount={regionCount}
              lastAlertMinutes={lastAlertMinutes}
              timeRange={filter.timeRange}
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

        {activeTab === "analytics" && (
          <AnalyticsView
            alerts={alerts}
            cityCoords={cityCoords}
            regionId={filter.regionId}
            onAskAI={aiAvailable ? handleAskAI : undefined}
          />
        )}

        {activeTab === "feed" && (
          <FeedView filter={filter} onAlertTap={handleShowOnMap} />
        )}

        {activeTab === "ai" && (
          <AITab alerts={alerts} cityCoords={cityCoords} filter={filter} initialQuestion={pendingAIQuestion} />
        )}
      </main>

      {/* Footer */}
      <Footer />

      {/* Tab bar */}
      <TabBar activeTab={activeTab} onTabChange={handleTabChange} aiAvailable={aiAvailable} />
    </div>
  );
}
