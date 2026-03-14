"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

type Lang = "en" | "he";

const translations: Record<Lang, Record<string, string>> = {
  en: {
    "app.title": "Alert Map",
    "tab.map": "Map",
    "tab.analytics": "Analytics",
    "tab.feed": "Feed",
    "filter.24h": "Last 24h",
    "filter.7d": "7 days",
    "filter.30d": "30 days",
    "filter.custom": "Custom",
    "filter.allRegions": "All Regions",
    "stats.today": "Today",
    "stats.regions": "Regions",
    "stats.lastAlert": "Last Alert",
    "feed.search": "Search cities or regions...",
    "feed.loading": "Loading...",
    "feed.end": "End of alerts",
    "status.stale": "Data may be stale",
    "sheet.showInFeed": "Show in Feed →",
    "sheet.close": "Close",
    "analytics.filtered": "Filtered",
  },
  he: {
    "app.title": "מפת התרעות",
    "tab.map": "מפה",
    "tab.analytics": "ניתוח",
    "tab.feed": "עדכונים",
    "filter.24h": "24 שעות",
    "filter.7d": "7 ימים",
    "filter.30d": "30 ימים",
    "filter.custom": "מותאם",
    "filter.allRegions": "כל האזורים",
    "stats.today": "היום",
    "stats.regions": "אזורים",
    "stats.lastAlert": "התרעה אחרונה",
    "feed.search": "חיפוש ערים או אזורים...",
    "feed.loading": "טוען...",
    "feed.end": "סוף ההתרעות",
    "status.stale": "הנתונים עשויים להיות לא עדכניים",
    "sheet.showInFeed": "← הצג בעדכונים",
    "sheet.close": "סגור",
    "analytics.filtered": "מסונן",
  },
};

interface I18nContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string) => string;
  dir: "ltr" | "rtl";
}

const I18nContext = createContext<I18nContextType>({
  lang: "en",
  setLang: () => {},
  t: (key) => key,
  dir: "ltr",
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  const setLang = useCallback((newLang: Lang) => {
    setLangState(newLang);
    if (typeof document !== "undefined") {
      document.documentElement.dir = newLang === "he" ? "rtl" : "ltr";
      document.documentElement.lang = newLang;
    }
  }, []);

  const t = useCallback((key: string): string => {
    return translations[lang][key] ?? key;
  }, [lang]);

  const dir = lang === "he" ? "rtl" : "ltr";

  return (
    <I18nContext.Provider value={{ lang, setLang, t, dir }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
