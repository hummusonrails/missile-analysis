# World Monitor-Inspired Features Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 5 features to SirenWise inspired by World Monitor: threat level badge, situation brief, notification bell, shareable URL state, and threat-type map legend.

**Architecture:** All features are client-side only — no API or DB changes. A shared `lib/regions.ts` is extracted first, then each feature is an independent component wired into AppShell. Analytics computation (`useClientAnalytics`) is hoisted into AppShell so header components have data.

**Tech Stack:** React 19, Next.js 16, TypeScript 5, Tailwind CSS 4, Leaflet

**Spec:** `docs/superpowers/specs/2026-03-15-worldmonitor-features-design.md`

---

## Task 1: Extract Shared Regions Array

**Files:**
- Create: `lib/regions.ts`
- Modify: `components/FilterChips.tsx`

This is a prerequisite for Tasks 2 and 3. Extract the `REGIONS` array from FilterChips into a shared module.

- [ ] **Step 1: Create `lib/regions.ts`**

```typescript
// lib/regions.ts
export const REGIONS = [
  { id: "western-galilee", en: "Western Galilee", he: "גליל מערבי" },
  { id: "upper-galilee", en: "Upper Galilee", he: "גליל עליון" },
  { id: "lower-galilee", en: "Lower Galilee", he: "גליל תחתון" },
  { id: "haifa-krayot", en: "Haifa & Krayot", he: "חיפה והקריות" },
  { id: "jezreel-valley", en: "Jezreel Valley", he: "עמק יזרעאל" },
  { id: "golan-heights", en: "Golan Heights", he: "רמת הגולן" },
  { id: "sharon", en: "Sharon", he: "השרון" },
  { id: "tel-aviv-gush-dan", en: "Tel Aviv & Gush Dan", he: "תל אביב וגוש דן" },
  { id: "central", en: "Central", he: "מרכז" },
  { id: "jerusalem", en: "Jerusalem", he: "ירושלים" },
  { id: "shfela", en: "Shfela", he: "שפלה" },
  { id: "ashkelon-coast", en: "Ashkelon Coast", he: "חוף אשקלון" },
  { id: "negev", en: "Negev", he: "נגב" },
  { id: "gaza-envelope", en: "Gaza Envelope", he: "עוטף עזה" },
  { id: "eilat-arava", en: "Eilat & Arava", he: "אילת והערבה" },
  { id: "yehuda-vshomron", en: "Judea & Samaria", he: "יהודה ושומרון" },
];

export const VALID_REGION_IDS = new Set(REGIONS.map((r) => r.id));
```

- [ ] **Step 2: Update FilterChips to import from shared module**

In `components/FilterChips.tsx`, remove the inline `REGIONS` array (lines 7-24) and replace with:

```typescript
import { REGIONS } from "../lib/regions";
```

Everything else in FilterChips stays the same.

- [ ] **Step 3: Verify build passes**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add lib/regions.ts components/FilterChips.tsx
git commit -m "refactor: extract shared REGIONS array to lib/regions.ts"
```

---

## Task 2: Threat Level Badge (Feature 1)

**Files:**
- Create: `components/ThreatBadge.tsx`
- Modify: `lib/i18n.tsx` (add translations)
- Modify: `components/AppShell.tsx` (add to header, add useClientAnalytics)

**Dependencies:** None (can run in parallel with Tasks 3-6 after Task 1)

- [ ] **Step 1: Add translations to `lib/i18n.tsx`**

Add these keys to the `en` object (after `"ai.powered"`):

```typescript
"threat.calm": "CALM",
"threat.elevated": "ELEVATED",
"threat.high": "HIGH",
"threat.critical": "CRITICAL",
```

Add these keys to the `he` object (after `"ai.powered"`):

```typescript
"threat.calm": "שקט",
"threat.elevated": "מוגבר",
"threat.high": "גבוה",
"threat.critical": "קריטי",
```

- [ ] **Step 2: Create `components/ThreatBadge.tsx`**

```tsx
"use client";

import { useI18n } from "../lib/i18n";

interface EscalationData {
  currentRate: number;
  baseline: number;
  multiplier: number;
}

type ThreatLevelId = "calm" | "elevated" | "high" | "critical";

interface ThreatLevelConfig {
  id: ThreatLevelId;
  color: string;
  bg: string;
  pulse: boolean;
}

const LEVELS: Record<ThreatLevelId, ThreatLevelConfig> = {
  calm:     { id: "calm",     color: "text-emerald-400", bg: "bg-emerald-400/15 border-emerald-400/30", pulse: false },
  elevated: { id: "elevated", color: "text-yellow-400",  bg: "bg-yellow-400/15 border-yellow-400/30",  pulse: false },
  high:     { id: "high",     color: "text-orange-400",  bg: "bg-orange-400/15 border-orange-400/30",  pulse: false },
  critical: { id: "critical", color: "text-red-400",     bg: "bg-red-400/15 border-red-400/30",        pulse: true },
};

function computeLevel(esc: EscalationData): ThreatLevelId {
  if (esc.currentRate === 0) return "calm";
  if (esc.baseline === 0) return "elevated";
  if (esc.multiplier > 4) return "critical";
  if (esc.multiplier > 2) return "high";
  return "elevated";
}

interface ThreatBadgeProps {
  escalation: EscalationData;
}

export function ThreatBadge({ escalation }: ThreatBadgeProps) {
  const { t } = useI18n();
  const levelId = computeLevel(escalation);
  const level = LEVELS[levelId];

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9px] font-bold tracking-wider uppercase ${level.bg} ${level.color} ${level.pulse ? "animate-pulse" : ""}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${level.pulse ? "bg-red-400" : levelId === "calm" ? "bg-emerald-400" : levelId === "elevated" ? "bg-yellow-400" : "bg-orange-400"}`} />
      {t(`threat.${levelId}`)}
    </span>
  );
}
```

- [ ] **Step 3: Add `useClientAnalytics` to AppShell and wire ThreatBadge into header**

In `components/AppShell.tsx`:

Add import at the top:
```typescript
import { useClientAnalytics } from "../lib/hooks/use-client-analytics";
import { ThreatBadge } from "./ThreatBadge";
```

After the existing `useMemo` block for stats (around line 72), add:
```typescript
const analytics = useClientAnalytics(alerts, cityCoords);
```

Update the header section (lines 104-110). Replace:
```tsx
<header className="flex items-center justify-between px-5 py-3 flex-shrink-0">
  <div className="flex items-center gap-2">
    <div className="w-1.5 h-1.5 bg-accent-red rounded-full shadow-[0_0_8px_theme(colors.accent-red/40)] animate-pulse" />
    <h1 className="font-serif text-[17px] tracking-tight text-text-primary">{t("app.title")}</h1>
  </div>
  <LanguageToggle />
</header>
```

With:
```tsx
<header className="flex items-center justify-between px-5 py-3 flex-shrink-0">
  <div className="flex items-center gap-2">
    <div className="w-1.5 h-1.5 bg-accent-red rounded-full shadow-[0_0_8px_theme(colors.accent-red/40)] animate-pulse" />
    <h1 className="font-serif text-[17px] tracking-tight text-text-primary">{t("app.title")}</h1>
  </div>
  <div className="flex items-center gap-2">
    {analytics && <ThreatBadge escalation={analytics.escalation_patterns} />}
    <LanguageToggle />
  </div>
</header>
```

- [ ] **Step 4: Verify build passes**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add components/ThreatBadge.tsx lib/i18n.tsx components/AppShell.tsx
git commit -m "feat: add threat level badge to header"
```

---

## Task 3: Situation Brief on Map View (Feature 2)

**Files:**
- Create: `components/map/SituationBrief.tsx`
- Modify: `lib/i18n.tsx` (add translations)
- Modify: `components/AppShell.tsx` (add below MapStats)

**Dependencies:** Task 1 (needs `lib/regions.ts`), Task 2 (needs `analytics` in AppShell)

- [ ] **Step 1: Add translations to `lib/i18n.tsx`**

Add to `en`:
```typescript
"brief.quiet": "Currently quiet",
"brief.normal": "Activity normal",
"brief.escalation": "Escalation",
```

Add to `he`:
```typescript
"brief.quiet": "שקט כרגע",
"brief.normal": "פעילות רגילה",
"brief.escalation": "הסלמה",
```

- [ ] **Step 2: Create `components/map/SituationBrief.tsx`**

```tsx
"use client";

import { useI18n } from "../../lib/i18n";
import { REGIONS } from "../../lib/regions";
import type { FilterState } from "../../lib/types";

interface SituationBriefProps {
  analytics: {
    totalAlerts: number;
    regional_heatmap: { regions: Record<string, number> };
    hourly_histogram: { peakHour: number };
    escalation_patterns: { currentRate: number; multiplier: number };
  };
  filter: FilterState;
}

const TIME_RANGE_LABELS: Record<string, { en: string; he: string }> = {
  "24h": { en: "24h", he: "24 שעות" },
  "7d": { en: "7d", he: "7 ימים" },
  "30d": { en: "30d", he: "30 ימים" },
  custom: { en: "range", he: "טווח" },
};

function getTopRegion(regions: Record<string, number>, lang: string): string {
  const entries = Object.entries(regions);
  if (entries.length === 0) return lang === "he" ? "לא ידוע" : "Unknown";
  const [topId] = entries.sort(([, a], [, b]) => b - a)[0];
  const region = REGIONS.find((r) => r.id === topId);
  return region ? (lang === "he" ? region.he : region.en) : topId;
}

export function SituationBrief({ analytics, filter }: SituationBriefProps) {
  const { t, lang } = useI18n();
  const isHe = lang === "he";

  const { totalAlerts, regional_heatmap, hourly_histogram, escalation_patterns } = analytics;
  const topRegion = getTopRegion(regional_heatmap.regions, lang);
  const rangeLabel = TIME_RANGE_LABELS[filter.timeRange]?.[lang] ?? filter.timeRange;
  const peakHour = `${String(hourly_histogram.peakHour).padStart(2, "0")}:00`;

  let status: string;
  if (escalation_patterns.currentRate === 0) {
    status = t("brief.quiet");
  } else if (escalation_patterns.multiplier > 2) {
    status = isHe
      ? `${t("brief.escalation")}: פי ${escalation_patterns.multiplier} מהממוצע`
      : `${t("brief.escalation")}: ${escalation_patterns.multiplier}x baseline`;
  } else {
    status = t("brief.normal");
  }

  const brief = isHe
    ? `${totalAlerts} התרעות ב-${rangeLabel}. ${topRegion} הכי פעיל. שעת שיא: ${peakHour}. ${status}.`
    : `${totalAlerts} alerts in ${rangeLabel}. ${topRegion} most active. Peak hour: ${peakHour}. ${status}.`;

  return (
    <div className="px-3 pb-1">
      <p className="text-[10px] text-text-tertiary text-center truncate font-mono">
        {brief}
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Wire SituationBrief into AppShell map view**

In `components/AppShell.tsx`, add import:
```typescript
import { SituationBrief } from "./map/SituationBrief";
```

In the map tab section, after `<MapStats ... />` (around line 137), add:
```tsx
{analytics && (
  <SituationBrief analytics={analytics} filter={filter} />
)}
```

- [ ] **Step 4: Verify build passes**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add components/map/SituationBrief.tsx lib/i18n.tsx components/AppShell.tsx
git commit -m "feat: add situation brief below map stats"
```

---

## Task 4: Notification Bell with Intelligence Findings (Feature 3)

**Files:**
- Create: `lib/hooks/use-findings.ts`
- Create: `components/NotificationBell.tsx`
- Modify: `lib/i18n.tsx` (add translations)
- Modify: `components/AppShell.tsx` (add to header)

**Dependencies:** Task 2 (needs `analytics` in AppShell)

- [ ] **Step 1: Add translations to `lib/i18n.tsx`**

Add to `en`:
```typescript
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
```

Add to `he`:
```typescript
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
```

- [ ] **Step 2: Create `lib/hooks/use-findings.ts`**

```typescript
"use client";

import { useMemo, useState, useCallback, useEffect } from "react";

type Severity = "CRITICAL" | "HIGH" | "MEDIUM";

export interface Finding {
  id: string;
  type: string;
  severity: Severity;
  titleKey: string;
  descKey: string;
}

interface AnalyticsInput {
  escalation_patterns: { currentRate: number; multiplier: number; baseline: number };
  monthly_trends: { months: Array<{ month: string; count: number }>; monthOverMonthDelta: number };
  shabbat_vs_weekday: { multiplier: number };
}

const LS_KEY = "sirenwise-seen-findings";

function todayBucket(): string {
  return new Date().toISOString().slice(0, 10);
}

function pruneOldSeen(seen: string[]): string[] {
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return seen.filter((id) => {
    const dateStr = id.split(":").slice(1).join(":");
    const ts = new Date(dateStr).getTime();
    return !isNaN(ts) && ts >= cutoff;
  });
}

function loadSeen(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return pruneOldSeen(parsed);
  } catch {
    return [];
  }
}

function saveSeen(seen: string[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LS_KEY, JSON.stringify(seen));
}

export function useFindings(analytics: AnalyticsInput | null) {
  const [seen, setSeen] = useState<string[]>([]);

  // Load seen on mount
  useEffect(() => {
    setSeen(loadSeen());
  }, []);

  const findings = useMemo<Finding[]>(() => {
    if (!analytics) return [];
    const bucket = todayBucket();
    const result: Finding[] = [];

    // Escalation detected
    if (analytics.escalation_patterns.multiplier > 2 && analytics.escalation_patterns.baseline > 0) {
      result.push({
        id: `escalation:${bucket}`,
        type: "escalation",
        severity: "CRITICAL",
        titleKey: "findings.escalation",
        descKey: "findings.escalation.desc",
      });
    }

    // High activity
    if (analytics.escalation_patterns.currentRate >= 10) {
      result.push({
        id: `highActivity:${bucket}`,
        type: "highActivity",
        severity: "HIGH",
        titleKey: "findings.highActivity",
        descKey: "findings.highActivity.desc",
      });
    }

    // Monthly trend surge (only if current month has 7+ days)
    const months = analytics.monthly_trends.months;
    if (months.length >= 2 && analytics.monthly_trends.monthOverMonthDelta > 50) {
      const currentMonth = months[months.length - 1].month;
      const currentDay = new Date().getDate();
      const isCurrentMonth = currentMonth === new Date().toISOString().slice(0, 7);
      if (!isCurrentMonth || currentDay >= 7) {
        result.push({
          id: `monthlyTrend:${bucket}`,
          type: "monthlyTrend",
          severity: "HIGH",
          titleKey: "findings.monthlyTrend",
          descKey: "findings.monthlyTrend.desc",
        });
      }
    }

    // Shabbat pattern shift
    if (analytics.shabbat_vs_weekday.multiplier > 2 || (analytics.shabbat_vs_weekday.multiplier > 0 && analytics.shabbat_vs_weekday.multiplier < 0.5)) {
      result.push({
        id: `shabbatShift:${bucket}`,
        type: "shabbatShift",
        severity: "MEDIUM",
        titleKey: "findings.shabbatShift",
        descKey: "findings.shabbatShift.desc",
      });
    }

    return result;
  }, [analytics]);

  const unseenCount = useMemo(() => {
    const seenSet = new Set(seen);
    return findings.filter((f) => !seenSet.has(f.id)).length;
  }, [findings, seen]);

  const markAllSeen = useCallback(() => {
    const ids = findings.map((f) => f.id);
    const merged = [...new Set([...seen, ...ids])];
    setSeen(merged);
    saveSeen(merged);
  }, [findings, seen]);

  return { findings, unseenCount, markAllSeen };
}
```

- [ ] **Step 3: Create `components/NotificationBell.tsx`**

```tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { useI18n } from "../lib/i18n";
import type { Finding } from "../lib/hooks/use-findings";

const SEVERITY_STYLES: Record<string, string> = {
  CRITICAL: "bg-red-500/20 text-red-400 border-red-500/30",
  HIGH: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  MEDIUM: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
};

interface NotificationBellProps {
  findings: Finding[];
  unseenCount: number;
  onOpen: () => void;
}

export function NotificationBell({ findings, unseenCount, onOpen }: NotificationBellProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleToggle() {
    const willOpen = !open;
    setOpen(willOpen);
    if (willOpen) onOpen();
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={handleToggle}
        className="relative p-1.5 rounded-lg hover:bg-bg-surface transition-colors"
        aria-label={t("findings.title")}
      >
        {/* Bell icon (SVG) */}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-secondary">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>

        {/* Badge count */}
        {unseenCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-accent-red text-white text-[9px] font-bold px-1">
            {unseenCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 max-h-80 overflow-y-auto bg-bg-elevated border border-border-active rounded-xl shadow-2xl z-50">
          <div className="px-3 py-2 border-b border-border">
            <span className="text-[11px] font-bold text-text-primary uppercase tracking-wider">
              {t("findings.title")}
            </span>
          </div>

          {findings.length === 0 ? (
            <div className="px-3 py-4 text-center text-text-tertiary text-[11px]">
              {t("findings.empty")}
            </div>
          ) : (
            findings.map((finding) => (
              <div key={finding.id} className="px-3 py-2.5 border-b border-border last:border-b-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold border ${SEVERITY_STYLES[finding.severity]}`}>
                    {finding.severity}
                  </span>
                  <span className="text-[11px] font-medium text-text-primary">
                    {t(finding.titleKey)}
                  </span>
                </div>
                <p className="text-[10px] text-text-tertiary">
                  {t(finding.descKey)}
                </p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Wire NotificationBell into AppShell header**

In `components/AppShell.tsx`, add imports:
```typescript
import { NotificationBell } from "./NotificationBell";
import { useFindings } from "../lib/hooks/use-findings";
```

After the `const analytics = ...` line, add:
```typescript
const { findings, unseenCount, markAllSeen } = useFindings(analytics);
```

In the header's right-side `<div>`, add NotificationBell before ThreatBadge:
```tsx
<div className="flex items-center gap-2">
  {analytics && (
    <NotificationBell findings={findings} unseenCount={unseenCount} onOpen={markAllSeen} />
  )}
  {analytics && <ThreatBadge escalation={analytics.escalation_patterns} />}
  <LanguageToggle />
</div>
```

- [ ] **Step 5: Verify build passes**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add lib/hooks/use-findings.ts components/NotificationBell.tsx lib/i18n.tsx components/AppShell.tsx
git commit -m "feat: add notification bell with intelligence findings"
```

---

## Task 5: Shareable URL State (Feature 4)

**Files:**
- Create: `components/ShareButton.tsx`
- Modify: `lib/hooks/use-filter-state.ts`
- Modify: `lib/i18n.tsx` (add translations)
- Modify: `components/AppShell.tsx` (URL-synced tab state, add ShareButton)

**Dependencies:** Task 1 (needs `VALID_REGION_IDS` from `lib/regions.ts`), Task 2 (for header layout)

- [ ] **Step 1: Add translations to `lib/i18n.tsx`**

Add to `en`:
```typescript
"share.copied": "Link copied!",
```

Add to `he`:
```typescript
"share.copied": "!הקישור הועתק",
```

- [ ] **Step 2: Update `lib/hooks/use-filter-state.ts` to read/write URL params**

Replace the entire file with:

```typescript
"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { FilterState, TimeRange } from "../types";
import { VALID_REGION_IDS } from "../regions";

const VALID_TIME_RANGES = new Set<TimeRange>(["24h", "7d", "30d", "custom"]);

function readInitialFilter(): FilterState {
  if (typeof window === "undefined") return { timeRange: "24h", regionId: null };

  const params = new URLSearchParams(window.location.search);

  const timeRangeParam = params.get("timeRange") as TimeRange | null;
  const timeRange = timeRangeParam && VALID_TIME_RANGES.has(timeRangeParam) ? timeRangeParam : "24h";

  const regionParam = params.get("region");
  const regionId = regionParam && VALID_REGION_IDS.has(regionParam) ? regionParam : null;

  const filter: FilterState = { timeRange, regionId };

  if (timeRange === "custom") {
    const start = Number(params.get("customStart"));
    const end = Number(params.get("customEnd"));
    if (start > 0 && end > 0 && end > start) {
      filter.customStart = start;
      filter.customEnd = end;
    } else {
      // Invalid custom range — fall back to 24h
      filter.timeRange = "24h";
    }
  }

  return filter;
}

function writeFilterToUrl(filter: FilterState, tab: string): void {
  if (typeof window === "undefined") return;

  const params = new URLSearchParams();
  if (filter.timeRange !== "24h") params.set("timeRange", filter.timeRange);
  if (filter.regionId) params.set("region", filter.regionId);
  if (tab !== "map") params.set("tab", tab);
  if (filter.timeRange === "custom" && filter.customStart && filter.customEnd) {
    params.set("customStart", String(filter.customStart));
    params.set("customEnd", String(filter.customEnd));
  }

  const qs = params.toString();
  const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
  window.history.replaceState(null, "", url);
}

export function useFilterState(tab?: string) {
  const [filter, setFilter] = useState<FilterState>(readInitialFilter);
  const tabRef = useRef(tab ?? "map");
  tabRef.current = tab ?? "map";

  // Sync filter changes to URL
  useEffect(() => {
    writeFilterToUrl(filter, tabRef.current);
  }, [filter]);

  const setTimeRange = useCallback((range: TimeRange) => {
    setFilter((prev) => ({ ...prev, timeRange: range, customStart: undefined, customEnd: undefined }));
  }, []);

  const setCustomRange = useCallback((start: number, end: number) => {
    setFilter((prev) => ({ ...prev, timeRange: "custom" as TimeRange, customStart: start, customEnd: end }));
  }, []);

  const setRegion = useCallback((regionId: string | null) => {
    setFilter((prev) => ({ ...prev, regionId }));
  }, []);

  return { filter, setTimeRange, setCustomRange, setRegion };
}

/** Read initial tab from URL (called once in AppShell) */
export function readInitialTab(): string {
  if (typeof window === "undefined") return "map";
  const params = new URLSearchParams(window.location.search);
  const tab = params.get("tab");
  const valid = new Set(["map", "analytics", "feed", "ai"]);
  return tab && valid.has(tab) ? tab : "map";
}
```

- [ ] **Step 3: Create `components/ShareButton.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useI18n } from "../lib/i18n";

export function ShareButton() {
  const { t } = useI18n();
  const [showToast, setShowToast] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = window.location.href;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2000);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={handleCopy}
        className="p-1.5 rounded-lg hover:bg-bg-surface transition-colors"
        aria-label="Share link"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-secondary">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
      </button>

      {showToast && (
        <div className="absolute right-0 top-full mt-2 px-3 py-1.5 rounded-lg bg-accent-green/20 border border-accent-green/30 text-accent-green text-[10px] font-medium whitespace-nowrap z-50">
          {t("share.copied")}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Wire URL-synced tab state and ShareButton into AppShell**

In `components/AppShell.tsx`, add imports:
```typescript
import { ShareButton } from "./ShareButton";
import { readInitialTab } from "../lib/hooks/use-filter-state";
```

Update the useFilterState call to pass the current tab:
```typescript
const { filter, setTimeRange, setCustomRange, setRegion } = useFilterState(activeTab);
```

Update the activeTab initial state to read from URL:
```typescript
const [activeTab, setActiveTab] = useState<Tab>(() => readInitialTab() as Tab);
```

Update `handleTabChange` to also sync URL:
```typescript
function handleTabChange(tab: Tab) {
  if (activeTab === "ai" && tab !== "ai") {
    setPendingAIQuestion(undefined);
  }
  setActiveTab(tab);
  // URL sync happens via useFilterState's useEffect
}
```

Add an effect to sync tab changes to URL:
```typescript
useEffect(() => {
  // Re-sync URL when tab changes (filter sync handles its own URL writing,
  // but we need to update the tab param too)
  const params = new URLSearchParams(window.location.search);
  if (activeTab !== "map") {
    params.set("tab", activeTab);
  } else {
    params.delete("tab");
  }
  const qs = params.toString();
  const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
  window.history.replaceState(null, "", url);
}, [activeTab]);
```

Add ShareButton to the header's right-side div:
```tsx
<div className="flex items-center gap-2">
  <ShareButton />
  {analytics && (
    <NotificationBell findings={findings} unseenCount={unseenCount} onOpen={markAllSeen} />
  )}
  {analytics && <ThreatBadge escalation={analytics.escalation_patterns} />}
  <LanguageToggle />
</div>
```

- [ ] **Step 5: Verify build passes**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add components/ShareButton.tsx lib/hooks/use-filter-state.ts lib/i18n.tsx components/AppShell.tsx
git commit -m "feat: add shareable URL state and copy link button"
```

---

## Task 6: Map Legend with Threat Type Colors (Feature 5)

**Files:**
- Create: `components/map/MapLegend.tsx`
- Modify: `components/map/AlertMarkers.tsx`
- Modify: `lib/i18n.tsx` (add threat name translations)
- Modify: `components/AppShell.tsx` (pass threat types to map, add legend)

**Dependencies:** None (can run in parallel with Tasks 2-5 after Task 1)

- [ ] **Step 1: Add threat name translations to `lib/i18n.tsx`**

Add to `en`:
```typescript
"threat.type.rockets": "Rockets",
"threat.type.infiltration": "Infiltration",
"threat.type.earthquake": "Earthquake",
"threat.type.aircraft": "Hostile Aircraft",
"threat.type.nonconventional": "Non-conventional",
"threat.type.general": "General",
"threat.type.unknown": "Unknown",
```

Add to `he`:
```typescript
"threat.type.rockets": "רקטות",
"threat.type.infiltration": "חדירה",
"threat.type.earthquake": "רעידת אדמה",
"threat.type.aircraft": "כלי טיס עוין",
"threat.type.nonconventional": "לא קונבנציונלי",
"threat.type.general": "כללי",
"threat.type.unknown": "לא ידוע",
```

- [ ] **Step 2: Update `components/map/AlertMarkers.tsx` with dual encoding**

Replace the existing `getMarkerStyle` function (lines 15-26) with:

```typescript
const THREAT_COLORS: Record<number, string> = {
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
```

Update the marker creation in the `useEffect` (around line 85). Change:
```typescript
const { color, radius, glow } = getMarkerStyle(alert.timestamp);
```
to:
```typescript
const { color, radius, opacity, glow } = getMarkerStyle(alert.timestamp, alert.threat);
```

Update the `L.circleMarker` options to use `opacity`:
```typescript
const marker = L.circleMarker([coord.lat, coord.lng], {
  radius,
  fillColor: color,
  fillOpacity: opacity,
  color: glow ? color : "rgba(255,255,255,0.15)",
  weight: glow ? 2 : 1,
  className: glow ? "alert-marker-glow" : "",
});
```

Also export `THREAT_COLORS` for use by MapLegend:
```typescript
export { THREAT_COLORS };
```

- [ ] **Step 3: Create `components/map/MapLegend.tsx`**

```tsx
"use client";

import { useI18n } from "../../lib/i18n";
import { THREAT_COLORS } from "./AlertMarkers";

const THREAT_LABELS: Record<number, string> = {
  0: "threat.type.rockets",
  2: "threat.type.infiltration",
  3: "threat.type.earthquake",
  5: "threat.type.aircraft",
  7: "threat.type.nonconventional",
  8: "threat.type.general",
};

interface MapLegendProps {
  activeThreatTypes: Set<number>;
}

export function MapLegend({ activeThreatTypes }: MapLegendProps) {
  const { t } = useI18n();

  if (activeThreatTypes.size === 0) return null;

  const entries = Array.from(activeThreatTypes)
    .sort((a, b) => a - b)
    .map((id) => ({
      id,
      color: THREAT_COLORS[id] ?? "#6B7280",
      label: t(THREAT_LABELS[id] ?? "threat.type.unknown"),
    }));

  return (
    <div className="absolute bottom-1 left-1/2 -translate-x-1/2 z-[400] flex items-center gap-3 px-3 py-1.5 rounded-lg bg-bg-primary/80 backdrop-blur-sm border border-border">
      {entries.map((e) => (
        <div key={e.id} className="flex items-center gap-1">
          <span
            className="w-2.5 h-2.5 rounded-full inline-block flex-shrink-0"
            style={{ backgroundColor: e.color }}
          />
          <span className="text-[9px] text-text-secondary font-medium whitespace-nowrap">
            {e.label}
          </span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Compute active threat types and add MapLegend to AppShell map view**

In `components/AppShell.tsx`, add import:
```typescript
import { MapLegend } from "./map/MapLegend";
```

After the existing `useMemo` for stats, add:
```typescript
const activeThreatTypes = useMemo(() => {
  const types = new Set<number>();
  for (const alert of alerts) {
    types.add(alert.threat);
  }
  return types;
}, [alerts]);
```

In the map view section, inside the map container `<div className="flex-1 relative overflow-hidden">`, add `<MapLegend>` after the `<AlertMap>` component:
```tsx
<div className="flex-1 relative overflow-hidden">
  <AlertMap
    alerts={alerts}
    cityCoords={cityCoords}
    onAlertSelect={setSelectedAlert}
  />

  <MapLegend activeThreatTypes={activeThreatTypes} />

  {/* Bottom sheet */}
  {selectedAlert && (
    <BottomSheet ... />
  )}
</div>
```

- [ ] **Step 5: Verify build passes**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add components/map/AlertMarkers.tsx components/map/MapLegend.tsx lib/i18n.tsx components/AppShell.tsx
git commit -m "feat: add threat type colors to map markers with legend"
```

---

## Task 7: Final Integration Verification

**Dependencies:** Tasks 1-6 all complete

- [ ] **Step 1: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Run tests**

Run: `npm test`
Expected: All 8 tests pass

- [ ] **Step 3: Run dev server and verify visually**

Run: `npm run dev`
Check: Header shows threat badge, notification bell, and share button. Map shows threat-colored markers with legend. Situation brief appears below stats. URL updates when changing filters/tabs.

- [ ] **Step 4: Final commit if any fixups needed**

```bash
git add -A
git commit -m "fix: integration fixups for world monitor features"
```

- [ ] **Step 5: Push**

```bash
git push
```
