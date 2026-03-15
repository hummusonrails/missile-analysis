"use client";

import { Sparkles } from "lucide-react";
import { useI18n } from "../lib/i18n";

type Tab = "map" | "analytics" | "feed" | "ai";

interface TabBarProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  aiAvailable?: boolean;
}

function MapIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={active ? { filter: "drop-shadow(0 2px 6px currentColor)" } : undefined}
    >
      <path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3V6z" />
      <path d="M9 3v15M15 6v15" />
    </svg>
  );
}

function AnalyticsIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={active ? { filter: "drop-shadow(0 2px 6px currentColor)" } : undefined}
    >
      <rect x="4" y="14" width="4" height="7" rx="1" />
      <rect x="10" y="9" width="4" height="12" rx="1" />
      <rect x="16" y="4" width="4" height="17" rx="1" />
    </svg>
  );
}

function FeedIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={active ? { filter: "drop-shadow(0 2px 6px currentColor)" } : undefined}
    >
      <line x1="4" y1="7" x2="20" y2="7" />
      <line x1="4" y1="12" x2="17" y2="12" />
      <line x1="4" y1="17" x2="14" y2="17" />
      <line x1="4" y1="22" x2="11" y2="22" />
    </svg>
  );
}

const allTabIds: Tab[] = ["map", "analytics", "feed", "ai"];
const tabKeys: Record<Tab, string> = {
  map: "tab.map",
  analytics: "tab.analytics",
  feed: "tab.feed",
  ai: "ai",
};

export function TabBar({ activeTab, onTabChange, aiAvailable }: TabBarProps) {
  const { t } = useI18n();

  const tabIds = allTabIds.filter((id) => id !== "ai" || aiAvailable);

  return (
    <nav className="h-[72px] bg-bg-elevated border-t border-border flex-shrink-0 flex items-center">
      {tabIds.map((id) => {
        const active = activeTab === id;
        return (
          <button
            key={id}
            onClick={() => onTabChange(id)}
            className={`flex-1 flex flex-col items-center justify-center gap-1 h-full transition-colors ${
              active ? "text-accent-blue" : "text-text-tertiary"
            }`}
          >
            {id === "map" && <MapIcon active={active} />}
            {id === "analytics" && <AnalyticsIcon active={active} />}
            {id === "feed" && <FeedIcon active={active} />}
            {id === "ai" && <Sparkles size={20} />}
            <span className="text-[10px] font-medium uppercase tracking-wider">
              {id === "ai" ? "AI" : t(tabKeys[id])}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
