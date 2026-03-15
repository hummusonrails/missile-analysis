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
| Calm | CALM | שקט | Green (#10B981) | `currentRate === 0` (no alerts in last hour) |
| Elevated | ELEVATED | מוגבר | Yellow (#F59E0B) | `currentRate > 0` AND `multiplier <= 2` (or `baseline === 0`) |
| High | HIGH | גבוה | Orange (#F97316) | `multiplier > 2` AND `multiplier <= 4` |
| Critical | CRITICAL | קריטי | Red (#EF4444, pulsing) | `multiplier > 4` |

### Edge Cases
- When `baseline === 0` AND `currentRate > 0`: treat as ELEVATED (activity exists but no historical baseline to compare)
- When `baseline === 0` AND `currentRate === 0`: CALM

### Data Source
- `escalation_patterns.multiplier`, `escalation_patterns.currentRate`, `escalation_patterns.baseline` from `useClientAnalytics`

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

### Region Name Resolution
`regional_heatmap.regions` is keyed by `region_id` (e.g., `"south"`). The component must map region IDs to display names using the existing `REGIONS` array from `FilterChips.tsx`. Extract this array to a shared location (e.g., `lib/regions.ts`) so both FilterChips and SituationBrief can use it.

### Escalation Status Text
- `currentRate === 0`: "Currently quiet" / "שקט כרגע"
- `multiplier > 2`: "Escalation: {multiplier}x baseline" / "הסלמה: פי {multiplier} מהממוצע"
- else: "Activity normal" / "פעילות רגילה"

### Data Source
- `totalAlerts`, `regional_heatmap.regions`, `hourly_histogram.peakHour`, `escalation_patterns` from `useClientAnalytics`

### Implementation
- New component: `components/map/SituationBrief.tsx`
- New shared file: `lib/regions.ts` — extract REGIONS array from FilterChips
- Receives analytics + filter as props
- Renders below MapStats in the map view section of AppShell
- Single line, `text-xs`, `text-text-secondary`, truncated with ellipsis on small screens
- Add translations to `lib/i18n.tsx`

## Feature 3: Notification Bell with Intelligence Findings

### What
A bell icon in the header next to the threat badge, with a red count badge. Clicking opens a dropdown panel with severity-tagged computed findings.

### Finding Types
| Finding | Severity | Condition | Data Source |
|---------|----------|-----------|-------------|
| Escalation detected | CRITICAL | `escalation_patterns.multiplier > 2` | Direct from analytics |
| Monthly trend surge | HIGH | `monthly_trends.monthOverMonthDelta > 50` (i.e., >50% increase) AND current month has 7+ days of data | Direct from analytics |
| Shabbat pattern shift | MEDIUM | `shabbat_vs_weekday.multiplier > 2` OR `shabbat_vs_weekday.multiplier < 0.5` | Direct from analytics |
| High activity | HIGH | `escalation_patterns.currentRate >= 10` (10+ alerts in last hour) | Direct from analytics |

**Deliberately excluded from v1** (would require new computation not available from `useClientAnalytics`):
- "New region activated" — requires per-region gap analysis across time
- "Multi-region barrage" — requires 30-min windowed multi-region detection
- "Unusual quiet broken" — requires tracking the *most recent* quiet period, not the longest historical one

These can be added later by extending `useClientAnalytics` or `use-findings.ts`.

### Finding ID Format
Each finding gets a stable ID: `{type}:{dateDayBucket}` (e.g., `escalation:2026-03-15`). Day-level granularity prevents duplicates while being easy to parse for pruning.

### Persistence
- localStorage key: `sirenwise-seen-findings`
- Stores array of seen finding IDs as strings
- Badge count = active findings count minus seen findings count
- Opening the panel marks all current findings as seen
- On load, prune seen IDs where the date portion is older than 7 days (parse date from the ID string after the colon)

### Implementation
- New component: `components/NotificationBell.tsx` — bell icon + count badge + dropdown panel
- New hook: `lib/hooks/use-findings.ts` — computes findings from analytics, manages seen state in localStorage
- Finding cards in dropdown show: severity pill (CRITICAL/HIGH/MEDIUM), title, short description
- Dropdown: absolute positioned, z-50, max-h with overflow scroll, dark theme matching app
- Add translations to `lib/i18n.tsx`

## Feature 4: Shareable URL State

### What
Encode current filter state and active tab into URL search params. On mount, hydrate state from URL. Include a "copy link" button.

### URL Params
| Param | Example | Valid Values | Maps to |
|-------|---------|-------------|---------|
| `timeRange` | `7d` | `24h`, `7d`, `30d`, `custom` | `filter.timeRange` |
| `region` | `south` | Any valid region ID from REGIONS array, or omitted for all | `filter.regionId` |
| `tab` | `analytics` | `map`, `analytics`, `feed`, `ai` | `activeTab` |
| `customStart` | `1710460800000` | Unix ms timestamp (only if timeRange=custom) | `filter.customStart` |
| `customEnd` | `1710547200000` | Unix ms timestamp (only if timeRange=custom) | `filter.customEnd` |

### Validation & Fallbacks
- Invalid `timeRange` → fall back to `"24h"`
- Invalid `region` (not in REGIONS array) → fall back to `null` (all regions)
- Invalid `tab` → fall back to `"map"`
- Invalid `customStart`/`customEnd` → ignore, fall back to non-custom range
- Missing params → use defaults (24h, null region, map tab)

### Behavior
- On state change: `window.history.replaceState()` to update URL without navigation
- On mount: read `URLSearchParams` from `window.location.search` to set initial state
- URL params override default state

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
| any other | Unknown | Gray (#6B7280) |

Note: The `Alert.threat` field is typed as `number` in the codebase. Known IDs from the data source are 0, 2, 3, 5, 7, 8. The default/unknown case handles any unexpected values defensively.

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
- Bilingual labels from a threat name map (EN/HE)

### Implementation
- Modify `components/map/AlertMarkers.tsx`: update `getMarkerStyle()` to accept both `timestamp` and `threat` level, return threat-based color + recency-based size/opacity. The current recency-only logic is fully replaced.
- New component: `components/map/MapLegend.tsx` — legend strip
- Legend receives the set of active threat types from the filtered alerts

## Architecture Note: Analytics in AppShell

AppShell currently does NOT call `useClientAnalytics`. To provide analytics data to ThreatBadge, SituationBrief, and NotificationBell, AppShell must:

1. Call `useClientAnalytics(alerts, cityCoords)` — same as AITab and AnalyticsView already do
2. Pass the result to the new header components and SituationBrief
3. Guard renders with `analytics !== null` checks (analytics is null while alerts are loading)

This is the same computation already running in the analytics and AI tabs — it just needs to also run in AppShell so the header components have data.

## File Changes Summary

### New Files
- `components/ThreatBadge.tsx`
- `components/NotificationBell.tsx`
- `components/ShareButton.tsx`
- `components/map/SituationBrief.tsx`
- `components/map/MapLegend.tsx`
- `lib/hooks/use-findings.ts`
- `lib/regions.ts` — shared REGIONS array (extracted from FilterChips)

### Modified Files
- `components/AppShell.tsx` — call `useClientAnalytics`; add ThreatBadge, NotificationBell, ShareButton to header; add SituationBrief to map view; read tab from URL; update URL on tab/filter change
- `components/map/AlertMarkers.tsx` — `getMarkerStyle()` now uses threat type for color + recency for size/opacity
- `components/FilterChips.tsx` — import REGIONS from `lib/regions.ts` instead of inline array
- `lib/hooks/use-filter-state.ts` — URL param read/write with validation
- `lib/i18n.tsx` — new translation keys for all 5 features
- `lib/types.ts` — export `Tab` type if not already exported

### No Changes Needed
- Database schema (all data is already available)
- API routes (all computation is client-side)
- GitHub Actions / ingestion pipeline
