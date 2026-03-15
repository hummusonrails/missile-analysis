"use client";

import { useState } from "react";
import { ANALYTICS_PANELS } from "../../lib/types";
import type { Alert, CityCoord } from "../../lib/types";
import { useClientAnalytics } from "../../lib/hooks/use-client-analytics";
import { useI18n } from "../../lib/i18n";
import { AnalyticsCard } from "./AnalyticsCard";
import { METHODOLOGIES } from "../../lib/methodology";
import { AIPromptBar } from "../ai/AIPromptBar";

interface AnalyticsViewProps {
  alerts: Alert[];
  cityCoords: Map<string, CityCoord>;
  regionId: string | null;
  onAskAI?: (question: string) => void;
}

const DEFAULT_PANELS = new Set(["shabbat_vs_weekday", "hourly_histogram", "morning_vs_evening", "day_of_week"]);

export function AnalyticsView({ alerts, cityCoords, regionId, onAskAI }: AnalyticsViewProps) {
  const [activePanels, setActivePanels] = useState<Set<string>>(DEFAULT_PANELS);
  const analytics = useClientAnalytics(alerts, cityCoords);
  const { lang } = useI18n();
  const isHe = lang === "he";

  function togglePanel(key: string) {
    setActivePanels((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  if (!analytics) {
    return (
      <div className="h-full flex items-center justify-center text-text-tertiary text-[13px]">
        {isHe ? "אין נתוני התרעות לטווח הנבחר" : "No alert data available for selected range"}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-bg-primary">
      {regionId && (
        <div className="mx-4 mt-3 mb-1 flex items-center gap-2 px-3 py-2 bg-accent-blue/5 border border-accent-blue/15 rounded-[10px]">
          <div className="w-1.5 h-1.5 bg-accent-blue rounded-full" />
          <span className="text-[11px] text-accent-blue font-mono">{isHe ? `מסונן לאזור: ${regionId}` : `Filtered to region: ${regionId}`}</span>
        </div>
      )}

      {onAskAI && (
        <div className="px-4 pt-3">
          <AIPromptBar onSubmit={onAskAI} placeholder={isHe ? "שאלו את ה-AI..." : "Ask AI..."} />
        </div>
      )}

      <div className="flex-shrink-0 px-4 pt-3 pb-2">
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1">
          {ANALYTICS_PANELS.map((panel) => (
            <button
              key={panel.key}
              onClick={() => togglePanel(panel.key)}
              className={`flex-shrink-0 text-[11px] font-mono font-medium px-3 py-1.5 rounded-full border transition-all ${
                activePanels.has(panel.key)
                  ? "bg-accent-blue/15 border-accent-blue/30 text-accent-blue"
                  : "bg-bg-surface border-border text-text-tertiary hover:text-text-secondary hover:border-border-active"
              }`}
            >
              {isHe ? panel.labelHe : panel.labelEn}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-1 pb-6 space-y-2.5">
        {activePanels.size === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2">
            <span className="text-[13px] text-text-tertiary font-mono">{isHe ? "לא נבחרו לוחות" : "No panels selected"}</span>
          </div>
        ) : (
          <>
            {activePanels.has("shabbat_vs_weekday") && (
              <AnalyticsCard title={isHe ? "שבת מול ימי חול" : "Shabbat vs Weekday"} methodology={METHODOLOGIES.shabbat_vs_weekday} badge={{ label: `${analytics.shabbat_vs_weekday.multiplier}x`, direction: analytics.shabbat_vs_weekday.multiplier > 1 ? "up" : "down" }}>
                <div className="flex gap-2 px-4 py-3">
                  <div className="flex-1 text-center">
                    <div className="text-[9px] uppercase tracking-widest text-text-tertiary font-medium mb-1.5">{isHe ? "ממוצע ליום שבת" : "Avg per Shabbat day"}</div>
                    <div className="font-mono text-2xl font-bold text-accent-amber tracking-tight">{analytics.shabbat_vs_weekday.avgPerShabbatDay}</div>
                  </div>
                  <div className="w-px bg-border my-1" />
                  <div className="flex-1 text-center">
                    <div className="text-[9px] uppercase tracking-widest text-text-tertiary font-medium mb-1.5">{isHe ? "ממוצע ליום חול" : "Avg per Weekday"}</div>
                    <div className="font-mono text-2xl font-bold text-accent-blue tracking-tight">{analytics.shabbat_vs_weekday.avgPerWeekday}</div>
                  </div>
                </div>
                <div className="px-4 pb-2 flex justify-between text-[10px] text-text-tertiary font-mono">
                  <span>{isHe ? "סה\"כ שבת" : "Total Shabbat"}: {analytics.shabbat_vs_weekday.shabbatCount}</span>
                  <span>{isHe ? "סה\"כ ימי חול" : "Total Weekday"}: {analytics.shabbat_vs_weekday.weekdayCount}</span>
                </div>
                <div className="mx-4 mb-3.5 p-3 bg-accent-blue/5 border border-accent-blue/10 rounded-[10px] text-[12px] text-text-secondary leading-relaxed">
                  {isHe
                    ? <>בממוצע, יום שבת רואה <strong className="text-accent-amber font-semibold">{analytics.shabbat_vs_weekday.avgPerShabbatDay} התרעות</strong> מול <strong className="text-accent-blue font-semibold">{analytics.shabbat_vs_weekday.avgPerWeekday}</strong> ביום חול טיפוסי ({analytics.shabbat_vs_weekday.multiplier}x).</>
                    : <>On average, a Shabbat day sees <strong className="text-accent-amber font-semibold">{analytics.shabbat_vs_weekday.avgPerShabbatDay} alerts</strong> vs <strong className="text-accent-blue font-semibold">{analytics.shabbat_vs_weekday.avgPerWeekday}</strong> on a typical weekday ({analytics.shabbat_vs_weekday.multiplier}x).</>
                  }
                </div>
              </AnalyticsCard>
            )}

            {activePanels.has("hourly_histogram") && (
              <AnalyticsCard title={isHe ? "דפוס שעתי" : "Hourly Pattern"} methodology={METHODOLOGIES.hourly_histogram} badge={{ label: `${isHe ? "שיא" : "Peak"}: ${analytics.hourly_histogram.peakHour}:00`, direction: "neutral" }}>
                <div className="px-4 py-3">
                  <div className="flex items-end gap-[2px] h-16">
                    {analytics.hourly_histogram.hours.map((h) => {
                      const max = Math.max(...analytics.hourly_histogram.hours.map((x) => x.count), 1);
                      const height = Math.max(3, (h.count / max) * 100);
                      const isPeak = h.hour === analytics.hourly_histogram.peakHour;
                      return (
                        <div
                          key={h.hour}
                          className={`flex-1 rounded-t-sm ${isPeak ? "bg-accent-amber" : "bg-accent-blue/60"}`}
                          style={{ height: `${height}%` }}
                        />
                      );
                    })}
                  </div>
                  <div className="flex justify-between mt-1.5">
                    <span className="text-[8px] font-mono text-text-tertiary">0:00</span>
                    <span className="text-[8px] font-mono text-text-tertiary">6:00</span>
                    <span className="text-[8px] font-mono text-text-tertiary">12:00</span>
                    <span className="text-[8px] font-mono text-text-tertiary">18:00</span>
                    <span className="text-[8px] font-mono text-text-tertiary">23:00</span>
                  </div>
                </div>
                <div className="mx-4 mb-3.5 p-3 bg-accent-blue/5 border border-accent-blue/10 rounded-[10px] text-[12px] text-text-secondary leading-relaxed">
                  {isHe
                    ? <>התרעות שכיחות ביותר סביב השעה <strong className="text-accent-amber font-semibold">{analytics.hourly_histogram.peakHour}:00</strong> בשעון ישראל. החלון השקט ביותר הוא סביב {analytics.hourly_histogram.quietestHour}:00.</>
                    : <>Alerts are most frequent around <strong className="text-accent-amber font-semibold">{analytics.hourly_histogram.peakHour}:00</strong> Israel time. The quietest window is around {analytics.hourly_histogram.quietestHour}:00.</>
                  }
                </div>
              </AnalyticsCard>
            )}

            {activePanels.has("morning_vs_evening") && (() => {
              const { morningCount, eveningCount, eveningPercent, peakHour, quietestHour } = analytics.morning_vs_evening;
              const morningPercent = 100 - eveningPercent;
              const dominant = eveningPercent > 50 ? (isHe ? "שעות הערב והלילה" : "evening and nighttime") : (isHe ? "שעות היום" : "daytime");
              return (
                <AnalyticsCard title={isHe ? "בוקר מול ערב" : "Morning vs Evening"} methodology={METHODOLOGIES.morning_vs_evening} badge={{ label: `${eveningPercent}% ${isHe ? "ערב" : "evening"}`, direction: eveningPercent > 60 ? "up" : "neutral" }}>
                  <div className="px-4 py-3">
                    <div className="flex gap-1 h-6 rounded-full overflow-hidden">
                      <div className="bg-accent-blue/60 rounded-l-full" style={{ width: `${morningPercent}%` }} />
                      <div className="bg-accent-amber rounded-r-full" style={{ width: `${eveningPercent}%` }} />
                    </div>
                    <div className="flex justify-between mt-2">
                      <span className="text-[10px] text-text-secondary">6:00–18:00: {morningCount} ({morningPercent}%)</span>
                      <span className="text-[10px] text-text-secondary">18:00–6:00: {eveningCount} ({eveningPercent}%)</span>
                    </div>
                  </div>
                  <div className="mx-4 mb-3.5 p-3 bg-accent-blue/5 border border-accent-blue/10 rounded-[10px] text-[12px] text-text-secondary leading-relaxed">
                    {isHe
                      ? <>רוב ההתרעות מתרחשות ב{dominant}. השעה הפעילה ביותר היא <strong className="text-accent-blue font-semibold">{peakHour}:00</strong>, בעוד <strong className="text-accent-green font-semibold">{quietestHour}:00</strong> נוטה להיות השקטה ביותר.</>
                      : <>Most alerts occur during {dominant} hours. The single most active hour is <strong className="text-accent-blue font-semibold">{peakHour}:00</strong>, while <strong className="text-accent-green font-semibold">{quietestHour}:00</strong> tends to be quietest.</>
                    }
                  </div>
                </AnalyticsCard>
              );
            })()}

            {activePanels.has("day_of_week") && (
              <AnalyticsCard title={isHe ? "ממוצע התרעות ליום בשבוע" : "Avg Alerts Per Day of Week"} methodology={METHODOLOGIES.day_of_week} badge={{ label: `${isHe ? "עמוס" : "Busiest"}: ${analytics.day_of_week.busiestDay}`, direction: "neutral" }}>
                <div className="px-4 py-3">
                  <div className="flex items-end gap-1 h-16">
                    {analytics.day_of_week.days.map((d: { day: number; name: string; count: number }) => {
                      const max = Math.max(...analytics.day_of_week.days.map((x: { count: number }) => x.count), 1);
                      const height = Math.max(3, (d.count / max) * 100);
                      const isBusiest = d.name === analytics.day_of_week.busiestDay;
                      const isShabbat = d.day === 5 || d.day === 6;
                      return (
                        <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                          <span className="text-[8px] font-mono text-text-tertiary">{d.count}</span>
                          <div
                            className={`w-full rounded-t-sm ${isBusiest ? "bg-accent-red" : isShabbat ? "bg-accent-amber" : "bg-accent-blue/60"}`}
                            style={{ height: `${height}%` }}
                          />
                          <span className={`text-[8px] font-mono ${isShabbat ? "text-accent-amber" : "text-text-tertiary"}`}>{d.name}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mx-0 mt-3 p-3 bg-accent-blue/5 border border-accent-blue/10 rounded-[10px] text-[12px] text-text-secondary leading-relaxed">
                    <strong className="text-accent-blue font-semibold">{analytics.day_of_week.busiestDay}</strong> has the highest average alert count per day. Values are normalized — each bar shows the average for that weekday, accounting for how many of each appear in the selected range.
                  </div>
                </div>
              </AnalyticsCard>
            )}

            {activePanels.has("threat_distribution") && (() => {
              const threatTypes: { code: number; label: string; color: string }[] = [
                { code: 0, label: "Rockets", color: "bg-accent-red" },
                { code: 5, label: "Hostile Aircraft", color: "bg-accent-amber" },
                { code: 2, label: "Infiltration", color: "bg-accent-blue" },
                { code: 3, label: "Earthquake", color: "bg-accent-green" },
                { code: 7, label: "Non-conv. Missile", color: "bg-purple-500" },
                { code: 8, label: "General Alert", color: "bg-text-tertiary" },
              ];
              const total = Object.values(analytics.threat_distribution.counts).reduce((a: number, b: number) => a + b, 0);
              const activeTypes = threatTypes.filter((t) => (analytics.threat_distribution.counts[t.code] || 0) > 0);
              const topType = activeTypes.length > 0 ? activeTypes.reduce((max, t) => (analytics.threat_distribution.counts[t.code] || 0) > (analytics.threat_distribution.counts[max.code] || 0) ? t : max, activeTypes[0]) : null;

              return (
                <AnalyticsCard title={isHe ? "סוגי התרעות" : "Alert Types"} methodology={METHODOLOGIES.threat_distribution} badge={topType ? { label: topType.label, direction: "neutral" } : undefined}>
                  <div className="px-4 py-3 space-y-2">
                    {activeTypes.map((t) => {
                      const count = analytics.threat_distribution.counts[t.code] || 0;
                      const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                      return (
                        <div key={t.code} className="flex items-center gap-2">
                          <span className="text-[10px] text-text-secondary w-24 truncate">{t.label}</span>
                          <div className="flex-1 h-3 bg-bg-elevated rounded-full overflow-hidden">
                            <div className={`h-full ${t.color} rounded-full`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-[10px] font-mono text-text-secondary w-16 text-right">{count} ({pct}%)</span>
                        </div>
                      );
                    })}
                  </div>
                  {topType && (
                    <div className="mx-4 mb-3.5 p-3 bg-accent-blue/5 border border-accent-blue/10 rounded-[10px] text-[12px] text-text-secondary leading-relaxed">
                      <strong className="text-accent-blue font-semibold">{topType.label}</strong> alerts account for {Math.round(((analytics.threat_distribution.counts[topType.code] || 0) / total) * 100)}% of all alerts in this period.
                      {activeTypes.length > 1 && ` ${activeTypes.length} different alert types have been triggered.`}
                    </div>
                  )}
                </AnalyticsCard>
              );
            })()}

            {activePanels.has("time_between_alerts") && (() => {
              const median = analytics.time_between_alerts.medianGapMinutes;
              const formatted = median < 60 ? `${median} minutes` : `${Math.round(median / 60 * 10) / 10} hours`;
              return (
                <AnalyticsCard title={isHe ? "זמן בין התרעות" : "Time Between Alerts"} methodology={METHODOLOGIES.time_between_alerts} badge={{ label: `${median}m ${isHe ? "חציון" : "median"}`, direction: "neutral" }}>
                  <div className="px-4 py-3">
                    <div className="font-mono text-3xl font-bold text-accent-blue tracking-tight text-center mb-2">
                      {median < 60 ? `${median}m` : `${Math.round(median / 60 * 10) / 10}h`}
                    </div>
                    <div className="text-[10px] text-text-tertiary text-center">median time between consecutive alerts</div>
                  </div>
                  <div className="mx-4 mb-3.5 p-3 bg-accent-blue/5 border border-accent-blue/10 rounded-[10px] text-[12px] text-text-secondary leading-relaxed">
                    Half of all alert gaps are shorter than <strong className="text-accent-blue font-semibold">{formatted}</strong>. This gives a sense of how relentless or spaced-out the alert pattern is.
                  </div>
                </AnalyticsCard>
              );
            })()}

            {activePanels.has("quiet_vs_active") && (
              <AnalyticsCard title={isHe ? "תקופות שקט ופעילות" : "Quiet & Active Periods"} methodology={METHODOLOGIES.quiet_vs_active}>
                <div className="flex gap-2 px-4 py-3">
                  <div className="flex-1 text-center">
                    <div className="text-[9px] uppercase tracking-widest text-text-tertiary font-medium mb-1.5">{isHe ? "שקט ארוך ביותר" : "Longest quiet"}</div>
                    <div className="font-mono text-2xl font-bold text-accent-green tracking-tight">{analytics.quiet_vs_active.longestQuietHours}h</div>
                  </div>
                  <div className="w-px bg-border my-1" />
                  <div className="flex-1 text-center">
                    <div className="text-[9px] uppercase tracking-widest text-text-tertiary font-medium mb-1.5">{isHe ? "פעיל ארוך ביותר" : "Longest active"}</div>
                    <div className="font-mono text-2xl font-bold text-accent-red tracking-tight">{analytics.quiet_vs_active.longestActiveHours}h</div>
                  </div>
                </div>
                <div className="mx-4 mb-3.5 p-3 bg-accent-blue/5 border border-accent-blue/10 rounded-[10px] text-[12px] text-text-secondary leading-relaxed">
                  The longest stretch without any alerts was <strong className="text-accent-green font-semibold">{analytics.quiet_vs_active.longestQuietHours} hours</strong>. The longest sustained barrage (alerts within 30 min of each other) lasted <strong className="text-accent-red font-semibold">{analytics.quiet_vs_active.longestActiveHours} hours</strong>.
                </div>
              </AnalyticsCard>
            )}

            {activePanels.has("monthly_trends") && (
              <AnalyticsCard title={isHe ? "מגמות חודשיות" : "Monthly Trends"} methodology={METHODOLOGIES.monthly_trends} badge={analytics.monthly_trends.monthOverMonthDelta !== 0 ? { label: `${analytics.monthly_trends.monthOverMonthDelta > 0 ? "+" : ""}${analytics.monthly_trends.monthOverMonthDelta}%`, direction: analytics.monthly_trends.monthOverMonthDelta > 0 ? "up" : "down" } : undefined}>
                <div className="px-4 py-3 space-y-1.5">
                  {analytics.monthly_trends.months.map((m: { month: string; count: number }) => (
                    <div key={m.month} className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-text-tertiary w-16">{m.month}</span>
                      <div className="flex-1 h-3 bg-bg-elevated rounded-full overflow-hidden">
                        <div className="h-full bg-accent-blue/60 rounded-full" style={{ width: `${Math.min(100, (m.count / Math.max(...analytics.monthly_trends.months.map((x: { count: number }) => x.count), 1)) * 100)}%` }} />
                      </div>
                      <span className="text-[10px] font-mono text-text-secondary w-10 text-right">{m.count}</span>
                    </div>
                  ))}
                </div>
              </AnalyticsCard>
            )}

            {activePanels.has("escalation_patterns") && (() => {
              const { currentRate, baseline, multiplier } = analytics.escalation_patterns;
              const isElevated = multiplier > 2;
              const isQuiet = currentRate === 0;
              const badgeLabel = isQuiet ? "quiet" : isElevated ? "↑ elevated" : "normal";
              const badgeDir = isQuiet ? "down" as const : isElevated ? "up" as const : "neutral" as const;

              let insight: string;
              if (isQuiet) {
                insight = `No alerts in the last hour. The average over the selected period is ${baseline} alerts/hour.`;
              } else if (isElevated) {
                insight = `Alert rate is elevated — ${currentRate} alerts in the last hour vs an average of ${baseline}/hour (${multiplier}x higher).`;
              } else {
                insight = `${currentRate} alert${currentRate !== 1 ? "s" : ""} in the last hour, in line with the average of ${baseline}/hour.`;
              }

              return (
                <AnalyticsCard title={isHe ? "הסלמה נוכחית" : "Current Escalation"} methodology={METHODOLOGIES.escalation_patterns} badge={{ label: badgeLabel, direction: badgeDir }}>
                  <div className="flex gap-2 px-4 py-3">
                    <div className="flex-1 text-center">
                      <div className="text-[9px] uppercase tracking-widest text-text-tertiary font-medium mb-1.5">{isHe ? "שעה אחרונה" : "Last hour"}</div>
                      <div className={`font-mono text-2xl font-bold tracking-tight ${isQuiet ? "text-accent-green" : isElevated ? "text-accent-red" : "text-accent-amber"}`}>{currentRate}</div>
                    </div>
                    <div className="w-px bg-border my-1" />
                    <div className="flex-1 text-center">
                      <div className="text-[9px] uppercase tracking-widest text-text-tertiary font-medium mb-1.5">{isHe ? "ממוצע/שעה" : "Avg/hour"}</div>
                      <div className="font-mono text-2xl font-bold text-accent-blue tracking-tight">{baseline}</div>
                    </div>
                  </div>
                  <div className="mx-4 mb-3.5 p-3 bg-accent-blue/5 border border-accent-blue/10 rounded-[10px] text-[12px] text-text-secondary leading-relaxed">
                    {insight}
                  </div>
                </AnalyticsCard>
              );
            })()}

            {activePanels.has("multi_city_correlation") && (
              <AnalyticsCard title={isHe ? "אירועים רב-אזוריים" : "Multi-Region Events"} methodology={METHODOLOGIES.multi_city_correlation} badge={{ label: `${analytics.multi_city_correlation.multiRegionCount} ${isHe ? "אירועים" : "events"}`, direction: "neutral" }}>
                <div className="flex gap-2 px-4 py-3">
                  <div className="flex-1 text-center">
                    <div className="text-[9px] uppercase tracking-widest text-text-tertiary font-medium mb-1.5">{isHe ? "אירועי 3+ אזורים" : "3+ region events"}</div>
                    <div className="font-mono text-2xl font-bold text-accent-red tracking-tight">{analytics.multi_city_correlation.multiRegionCount}</div>
                  </div>
                  <div className="w-px bg-border my-1" />
                  <div className="flex-1 text-center">
                    <div className="text-[9px] uppercase tracking-widest text-text-tertiary font-medium mb-1.5">{isHe ? "ממוצע אזורים/אירוע" : "Avg regions/event"}</div>
                    <div className="font-mono text-2xl font-bold text-accent-amber tracking-tight">{analytics.multi_city_correlation.avgRegions}</div>
                  </div>
                </div>
                <div className="mx-4 mb-3.5 p-3 bg-accent-blue/5 border border-accent-blue/10 rounded-[10px] text-[12px] text-text-secondary leading-relaxed">
                  Out of {analytics.multi_city_correlation.totalGroups} total alert groups, {analytics.multi_city_correlation.multiRegionCount} hit 3 or more regions simultaneously.
                </div>
              </AnalyticsCard>
            )}

            {activePanels.has("geographic_spread") && (
              <AnalyticsCard title={isHe ? "פיזור גיאוגרפי" : "Geographic Spread"} methodology={METHODOLOGIES.geographic_spread} badge={{ label: `${analytics.geographic_spread.avgRegionsPerGroup} ${isHe ? "ממוצע" : "avg"}`, direction: "neutral" }}>
                <div className="px-4 py-3 text-center">
                  <div className="font-mono text-3xl font-bold text-accent-blue tracking-tight mb-1">
                    {analytics.geographic_spread.avgRegionsPerGroup}
                  </div>
                  <div className="text-[10px] text-text-tertiary">{isHe ? "ממוצע אזורים לקבוצת התרעה" : "avg regions per alert group"}</div>
                  <div className="text-[10px] text-text-tertiary mt-1">{analytics.geographic_spread.totalGroups} {isHe ? "קבוצות התרעה" : "total alert groups"}</div>
                </div>
              </AnalyticsCard>
            )}
          </>
        )}
      </div>
    </div>
  );
}
