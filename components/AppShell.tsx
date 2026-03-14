"use client";

import { useState } from "react";
import { TabBar } from "./TabBar";
import { FilterChips } from "./FilterChips";
import { useFilterState } from "../lib/hooks/use-filter-state";

type Tab = "map" | "analytics" | "feed";

export function AppShell() {
  const [activeTab, setActiveTab] = useState<Tab>("map");
  const { filter, setTimeRange, setCustomRange, setRegion } = useFilterState();

  return (
    <div className="h-dvh flex flex-col bg-bg-primary">
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-accent-red rounded-full shadow-[0_0_8px_theme(colors.accent-red/40)] animate-pulse" />
          <h1 className="font-serif text-[17px] tracking-tight text-text-primary">Alert Map</h1>
        </div>
        <button className="text-[11px] text-text-tertiary font-medium px-2 py-1 rounded-md border border-border">
          EN · עב
        </button>
      </header>

      {/* Filters */}
      <FilterChips
        activeRange={filter.timeRange}
        onRangeChange={setTimeRange}
        regionId={filter.regionId}
        onRegionChange={setRegion}
      />

      {/* Content area */}
      <main className="flex-1 overflow-hidden">
        {activeTab === "map" && (
          <div className="h-full flex items-center justify-center text-text-tertiary">
            Map View (Task 9)
          </div>
        )}
        {activeTab === "analytics" && (
          <div className="h-full flex items-center justify-center text-text-tertiary">
            Analytics View (Task 10)
          </div>
        )}
        {activeTab === "feed" && (
          <div className="h-full flex items-center justify-center text-text-tertiary">
            Feed View (Task 11)
          </div>
        )}
      </main>

      {/* Tab bar */}
      <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}
