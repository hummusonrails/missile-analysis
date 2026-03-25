"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

type Lang = "en" | "he";

const translations: Record<Lang, Record<string, string>> = {
  en: {
    "app.title": "SirenWise",
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
    "ai.input.placeholder": "Ask about alert patterns...",
    "ai.powered": "Powered by on-device AI",
    "threat.calm": "CALM",
    "threat.elevated": "ELEVATED",
    "threat.high": "HIGH",
    "threat.critical": "CRITICAL",
    "brief.quiet": "Currently quiet",
    "brief.normal": "Activity normal",
    "brief.escalation": "Escalation",
    "findings.title": "Intelligence Findings",
    "findings.empty": "No findings",
    "findings.escalation": "Escalation detected",
    "findings.escalation.desc": "Alert rate exceeds 2x the 7-day baseline",
    "findings.highActivity": "High activity",
    "findings.highActivity.desc": "10+ alerts detected in the last hour",
    "findings.monthlyTrend": "Monthly trend surge",
    "findings.monthlyTrend.desc": "Month-over-month increase exceeds 50%",
    "findings.shabbatShift": "Shabbat pattern shift",
    "findings.shabbatShift.desc": "Significant difference between Shabbat and weekday alert rates",
    "findings.activeAlerts": "Active alerts",
    "findings.activeAlerts.desc": "Alerts detected in the last hour",
    "findings.peakHour": "Peak activity pattern",
    "findings.peakHour.desc": "Alert data reveals distinct hourly patterns",
    "findings.nightDominance": "Night-heavy activity",
    "findings.nightDominance.desc": "Over 60% of alerts occur during evening/night hours",
    "findings.regionalConcentration": "Regional concentration",
    "findings.regionalConcentration.desc": "One region accounts for 40%+ of all alerts",
    "findings.longQuiet": "Extended quiet period",
    "findings.longQuiet.desc": "A 12+ hour gap detected between alert events",
    "share.copied": "Link copied!",
    "threat.type.rockets": "Rockets",
    "threat.type.infiltration": "Infiltration",
    "threat.type.earthquake": "Earthquake",
    "threat.type.aircraft": "Hostile Aircraft",
    "threat.type.nonconventional": "Non-conventional",
    "threat.type.general": "General",
    "threat.type.unknown": "Unknown",
    "prealert.earlyWarning": "Early Warning",
    "prealert.allClear": "All Clear",
    "prealert.badge": "PRE-ALERT",
    "prealert.nationwide": "Nationwide",
    "prealert.toggle": "Pre-Alerts",
    "prealert.leadTime": "Warning Lead Time",
    "prealert.leadTime.desc": "Average time between pre-alert and first siren in the same region",
    "prealert.coverage": "Warning Coverage",
    "prealert.coverage.desc": "Percentage of siren events preceded by a pre-alert in the same region",
    "prealert.summary": "Pre-Alert Summary",
    "prealert.warnings": "Warnings",
    "prealert.allClears": "All-Clears",
    "prealert.avgLead": "Avg Lead",
    "prealert.noData": "No pre-alert data yet",
    "prealert.mapActive": "Active pre-alert",
    "stats.preAlerts": "Pre-Alerts",
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
    "ai.input.placeholder": "שאלו על דפוסי התרעות...",
    "ai.powered": "מופעל על ידי AI מקומי",
    "threat.calm": "שקט",
    "threat.elevated": "מוגבר",
    "threat.high": "גבוה",
    "threat.critical": "קריטי",
    "brief.quiet": "שקט כרגע",
    "brief.normal": "פעילות רגילה",
    "brief.escalation": "הסלמה",
    "findings.title": "ממצאי מודיעין",
    "findings.empty": "אין ממצאים",
    "findings.escalation": "זוהתה הסלמה",
    "findings.escalation.desc": "קצב ההתרעות חורג מפי 2 מהממוצע השבועי",
    "findings.highActivity": "פעילות גבוהה",
    "findings.highActivity.desc": "יותר מ-10 התרעות בשעה האחרונה",
    "findings.monthlyTrend": "עלייה חודשית חדה",
    "findings.monthlyTrend.desc": "עלייה של מעל 50% ביחס לחודש הקודם",
    "findings.shabbatShift": "שינוי בדפוס השבת",
    "findings.shabbatShift.desc": "הבדל משמעותי בין קצב ההתרעות בשבת לבין ימי חול",
    "findings.activeAlerts": "התרעות פעילות",
    "findings.activeAlerts.desc": "זוהו התרעות בשעה האחרונה",
    "findings.peakHour": "דפוס שעת שיא",
    "findings.peakHour.desc": "נתוני ההתרעות חושפים דפוסים שעתיים ברורים",
    "findings.nightDominance": "פעילות לילית דומיננטית",
    "findings.nightDominance.desc": "מעל 60% מההתרעות מתרחשות בשעות הערב והלילה",
    "findings.regionalConcentration": "ריכוז אזורי",
    "findings.regionalConcentration.desc": "אזור אחד מהווה מעל 40% מכלל ההתרעות",
    "findings.longQuiet": "תקופת שקט ממושכת",
    "findings.longQuiet.desc": "זוהה פער של מעל 12 שעות בין אירועי התרעה",
    "share.copied": "!הקישור הועתק",
    "threat.type.rockets": "רקטות",
    "threat.type.infiltration": "חדירה",
    "threat.type.earthquake": "רעידת אדמה",
    "threat.type.aircraft": "כלי טיס עוין",
    "threat.type.nonconventional": "לא קונבנציונלי",
    "threat.type.general": "כללי",
    "threat.type.unknown": "לא ידוע",
    "prealert.earlyWarning": "אזהרה מוקדמת",
    "prealert.allClear": "סיום אירוע",
    "prealert.badge": "התרעה מוקדמת",
    "prealert.nationwide": "כל הארץ",
    "prealert.toggle": "התרעות מוקדמות",
    "prealert.leadTime": "זמן אזהרה מוקדמת",
    "prealert.leadTime.desc": "ממוצע הזמן בין התרעה מוקדמת לצפירה ראשונה באותו אזור",
    "prealert.coverage": "כיסוי אזהרות",
    "prealert.coverage.desc": "אחוז אירועי הצפירה שקדמה להם התרעה מוקדמת באותו אזור",
    "prealert.summary": "סיכום התרעות מוקדמות",
    "prealert.warnings": "אזהרות",
    "prealert.allClears": "סיומי אירוע",
    "prealert.avgLead": "ממוצע הקדמה",
    "prealert.noData": "אין עדיין נתוני התרעות מוקדמות",
    "prealert.mapActive": "התרעה מוקדמת פעילה",
    "stats.preAlerts": "התרעות מוקדמות",
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
