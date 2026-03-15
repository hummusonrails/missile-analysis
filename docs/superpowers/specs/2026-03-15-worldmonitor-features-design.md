# SirenWise Feature Pack: World Monitor-Inspired Enhancements

**Date:** 2026-03-15
**Status:** Approved

## Overview

Five features inspired by World Monitor's global intelligence dashboard, adapted for SirenWise's mobile-first, bilingual (EN/HE) missile alert platform.

## Feature 1: Threat Level Badge

### What
A color-coded pill in the AppShell header (between title and language toggle) showing computed alert severity.

### Levels
| Level | EN | HE | Color | Condition |
|-------|----|----|-------|-----------|
| Calm | CALM | שקט | Green (#10B981) | Multiplier < 1 or 0 alerts in last hour |
| Elevated | ELEVATED | מוגבר | Yellow (#F59E0B) | Multiplier 1–2x baseline |
| High | HIGH | גבוה | Orange (#F97316) | Multiplier 2–4x baseline |
| Critical | CRITICAL | קריטי | Red (#EF4444, pulsing) | Multiplier > 4x OR multi-region barrage (3+ regions in last 30 min) |

### Data Source
- `escalation_patterns.multiplier` and `escalation_patterns.currentRate` from `useClientAnalytics`
- `multi_city_correlation.multiRegionCount` for barrage detection

### Implementation
- New component: `components/ThreatBadge.tsx`
- Receives analytics object as prop from AppShell
- Renders a small pill with background color, text label, and optional pulse animation for CRITICAL
- Add translations to `lib/i18n.tsx`

## Feature 2: Situation Brief on Map View

### What
A single-line auto-generated text strip below MapStats on the map tab. Templated from existing analytics — no AI engine needed.

### Template (EN)
> "{totalAlerts} alerts in {timeRange}. {topRegion} most active. Peak hour: {peakHour}:00. {escalationStatus}."

### Template (HE)
> "{totalAlerts} התרעות ב-{timeRange}. {topRegion} הכי פעיל. שעת שיא: {peakHour}:00. {escalationStatus}."

### Escalation Status Text
- currentRate === 0: "Currently quiet"
- multiplier > 2: "Escalation: {multiplier}x baseline"
- else: "Activity normal"

### Data Source
- `totalAlerts`, `regional_heatmap.regions`, `hourly_histogram.peakHour`, `escalation_patterns` from `useClientAnalytics`

### Implementation
- New component: `components/map/SituationBrief.tsx`
- Receives analytics + filter as props
- Renders below MapStats in the map view section of AppShell
- Single line, `text-xs`, `text-text-secondary`, truncated with ellipsis on small screens
- Add translations to `lib/i18n.tsx`

## Feature 3: Notification Bell with Intelligence Findings

### What
A bell icon in the header next to the threat badge, with a red count badge. Clicking opens a dropdown panel with severity-tagged computed findings.

### Finding Types
| Finding | Severity | Condition |
|---------|----------|-----------|
| Escalation detected | CRITICAL | `escalation_patterns.multiplier > 2` |
| Multi-region barrage | CRITICAL | 15+ alerts in 30 min across 3+ regions |
| New region activated | HIGH | First alert in a region after 48h gap (computed from alerts array) |
| Monthly trend surge | HIGH | `monthly_trends.monthOverMonthDelta > 50` |
| Unusual quiet broken | MEDIUM | `quiet_vs_active.longestQuietHours > 12` and new alert arrived |
| Shabbat pattern shift | MEDIUM | Shabbat avg differs from weekday avg by > 2x |

### Finding ID Format
Each finding gets a stable ID: `{type}:{timeHourBucket}` (e.g., `escalation:2026-03-15T14`). This ensures findings are unique per hour and don't duplicate.

### Persistence
- localStorage key: `sirenwise-seen-findings`
- Stores array of seen finding IDs
- Badge count = active findings - seen findings
- Opening the panel marks all current findings as seen
- Prune seen IDs older than 7 days on load

### Implementation
- New component: `components/NotificationBell.tsx` — bell icon + count badge + dropdown panel
- New hook: `lib/hooks/use-findings.ts` — computes findings from analytics, manages seen state in localStorage
- Finding cards in dropdown show: severity pill (CRITICAL/HIGH/MEDIUM), title, short description, relative time
- Dropdown: absolute positioned, z-50, max-h with overflow scroll, dark theme matching app
- Add translations to `lib/i18n.tsx`

## Feature 4: Shareable URL State

### What
Encode current filter state and active tab into URL search params. On mount, hydrate state from URL. Include a "copy link" button.

### URL Params
| Param | Example | Maps to |
|-------|---------|---------|
| `timeRange` | `7d` | `filter.timeRange` |
| `region` | `south` | `filter.regionId` |
| `tab` | `analytics` | `activeTab` |
| `customStart` | `1710460800000` | `filter.customStart` (only if timeRange=custom) |
| `customEnd` | `1710547200000` | `filter.customEnd` (only if timeRange=custom) |

### Behavior
- On state change: `window.history.replaceState()` to update URL without navigation
- On mount: read `URLSearchParams` from `window.location.search` to set initial state
- URL params override default state (24h, null region, map tab)

### Copy Link
- Small link/share icon in the header area
- On click: copy `window.location.href` to clipboard via `navigator.clipboard.writeText()`
- Brief toast: "Link copied!" / "!הקישור הועתק" — auto-dismiss after 2s

### Implementation
- Modify `lib/hooks/use-filter-state.ts`: read URL params on init, write to URL on changes
- Modify `AppShell.tsx`: read `tab` param for initial activeTab, update URL on tab change
- New component: `components/ShareButton.tsx` — icon button + toast
- Add translations to `lib/i18n.tsx`

## Feature 5: Map Legend with Threat Type Colors

### What
Replace recency-only marker coloring with dual encoding: color = threat type, size + opacity = recency.

### Threat Type Colors
| Threat ID | Name | Color |
|-----------|------|-------|
| 0 | Rockets/Missiles | Red (#EF4444) |
| 2 | Infiltration | Blue (#3B82F6) |
| 3 | Earthquake | Green (#10B981) |
| 5 | Hostile Aircraft | Amber (#F59E0B) |
| 7 | Non-conventional | Purple (#8B5CF6) |
| 8 | General Alert | Gray (#6B7280) |
| default | Unknown | Gray (#6B7280) |

### Recency Encoding (Size + Opacity)
| Age | Radius | Opacity |
|-----|--------|---------|
| < 1 hour | 10 | 1.0 (+ glow) |
| 1–6 hours | 8 | 0.8 |
| > 6 hours | 6 | 0.5 |

### Legend Strip
- Horizontal strip at bottom of map, above attribution
- Shows colored circles with labels for each active threat type (only types present in current data)
- Semi-transparent dark background, small text, fits mobile width

### Implementation
- Modify `components/map/AlertMarkers.tsx`: update `getMarkerStyle()` to accept threat level, return threat-based color + recency-based size/opacity
- New component: `components/map/MapLegend.tsx` — legend strip
- Legend receives the set of active threat types from the filtered alerts

## File Changes Summary

### New Files
- `components/ThreatBadge.tsx`
- `components/NotificationBell.tsx`
- `components/ShareButton.tsx`
- `components/map/SituationBrief.tsx`
- `components/map/MapLegend.tsx`
- `lib/hooks/use-findings.ts`

### Modified Files
- `components/AppShell.tsx` — add ThreatBadge, NotificationBell, ShareButton to header; add SituationBrief to map view; read tab from URL
- `components/map/AlertMarkers.tsx` — threat-based colors + recency sizing
- `lib/hooks/use-filter-state.ts` — URL param read/write
- `lib/i18n.tsx` — new translation keys
- `lib/types.ts` — add Tab type export if needed

### No Changes Needed
- Database schema (all data is already available)
- API routes (all computation is client-side)
- GitHub Actions / ingestion pipeline
