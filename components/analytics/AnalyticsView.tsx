"use client";

import { useState } from "react";
import { ANALYTICS_PANELS } from "../../lib/types";
import type { Alert, CityCoord } from "../../lib/types";
import { useClientAnalytics } from "../../lib/hooks/use-client-analytics";
import { AnalyticsCard } from "./AnalyticsCard";
import { Footer } from "../Footer";

interface AnalyticsViewProps {
  alerts: Alert[];
  cityCoords: Map<string, CityCoord>;
  regionId: string | null;
}

const DEFAULT_PANELS = new Set(["shabbat_vs_weekday", "hourly_histogram", "morning_vs_evening", "day_of_week"]);

export function AnalyticsView({ alerts, cityCoords, regionId }: AnalyticsViewProps) {
  const [activePanels, setActivePanels] = useState<Set<string>>(DEFAULT_PANELS);
  const analytics = useClientAnalytics(alerts, cityCoords);

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
        No alert data available for selected range
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-bg-primary">
      {regionId && (
        <div className="mx-4 mt-3 mb-1 flex items-center gap-2 px-3 py-2 bg-accent-blue/5 border border-accent-blue/15 rounded-[10px]">
          <div className="w-1.5 h-1.5 bg-accent-blue rounded-full" />
          <span className="text-[11px] text-accent-blue font-mono">Filtered to region: {regionId}</span>
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
              {panel.labelEn}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-1 pb-6 space-y-2.5">
        {activePanels.size === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2">
            <span className="text-[13px] text-text-tertiary font-mono">No panels selected</span>
          </div>
        ) : (
          <>
            {activePanels.has("shabbat_vs_weekday") && (
              <AnalyticsCard title="Shabbat vs Weekday" badge={{ label: `${analytics.shabbat_vs_weekday.multiplier}x`, direction: analytics.shabbat_vs_weekday.multiplier > 1 ? "up" : "down" }}>
                <div className="flex gap-2 px-4 py-3">
                  <div className="flex-1 text-center">
                    <div className="text-[9px] uppercase tracking-widest text-text-tertiary font-medium mb-1.5">Avg per Shabbat day</div>
                    <div className="font-mono text-2xl font-bold text-accent-amber tracking-tight">{analytics.shabbat_vs_weekday.avgPerShabbatDay}</div>
                  </div>
                  <div className="w-px bg-border my-1" />
                  <div className="flex-1 text-center">
                    <div className="text-[9px] uppercase tracking-widest text-text-tertiary font-medium mb-1.5">Avg per Weekday</div>
                    <div className="font-mono text-2xl font-bold text-accent-blue tracking-tight">{analytics.shabbat_vs_weekday.avgPerWeekday}</div>
                  </div>
                </div>
                <div className="px-4 pb-2 flex justify-between text-[10px] text-text-tertiary font-mono">
                  <span>Total Shabbat: {analytics.shabbat_vs_weekday.shabbatCount}</span>
                  <span>Total Weekday: {analytics.shabbat_vs_weekday.weekdayCount}</span>
                </div>
                <div className="mx-4 mb-3.5 p-3 bg-accent-blue/5 border border-accent-blue/10 rounded-[10px] text-[12px] text-text-secondary leading-relaxed">
                  On average, a Shabbat day sees <strong className="text-accent-amber font-semibold">{analytics.shabbat_vs_weekday.avgPerShabbatDay} alerts</strong> vs <strong className="text-accent-blue font-semibold">{analytics.shabbat_vs_weekday.avgPerWeekday}</strong> on a typical weekday ({analytics.shabbat_vs_weekday.multiplier}x).
                </div>
              </AnalyticsCard>
            )}

            {activePanels.has("hourly_histogram") && (
              <AnalyticsCard title="Hourly Pattern" badge={{ label: `Peak: ${analytics.hourly_histogram.peakHour}:00`, direction: "neutral" }}>
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
                  Peak hour is <strong className="text-accent-blue font-semibold">{analytics.hourly_histogram.peakHour}:00</strong>, quietest at {analytics.hourly_histogram.quietestHour}:00.
                </div>
              </AnalyticsCard>
            )}

            {activePanels.has("morning_vs_evening") && (
              <AnalyticsCard title="Morning vs Evening" badge={{ label: `${analytics.morning_vs_evening.eveningPercent}% PM`, direction: analytics.morning_vs_evening.eveningPercent > 50 ? "up" : "down" }}>
                <div className="px-4 py-3">
                  <div className="flex gap-1 h-6 rounded-full overflow-hidden">
                    <div className="bg-accent-blue/60 rounded-l-full" style={{ width: `${100 - analytics.morning_vs_evening.eveningPercent}%` }} />
                    <div className="bg-accent-amber rounded-r-full" style={{ width: `${analytics.morning_vs_evening.eveningPercent}%` }} />
                  </div>
                  <div className="flex justify-between mt-2">
                    <span className="text-[10px] text-text-secondary">AM: {analytics.morning_vs_evening.morningCount}</span>
                    <span className="text-[10px] text-text-secondary">PM: {analytics.morning_vs_evening.eveningCount}</span>
                  </div>
                </div>
              </AnalyticsCard>
            )}

            {activePanels.has("day_of_week") && (
              <AnalyticsCard title="Day of Week" badge={{ label: `Busiest: ${analytics.day_of_week.busiestDay}`, direction: "neutral" }}>
                <div className="px-4 py-3">
                  <div className="flex items-end gap-1 h-16">
                    {analytics.day_of_week.days.map((d) => {
                      const max = Math.max(...analytics.day_of_week.days.map((x) => x.count), 1);
                      const height = Math.max(3, (d.count / max) * 100);
                      const isBusiest = d.name === analytics.day_of_week.busiestDay;
                      const isShabbat = d.day === 5 || d.day === 6;
                      return (
                        <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                          <div
                            className={`w-full rounded-t-sm ${isBusiest ? "bg-accent-red" : isShabbat ? "bg-accent-amber" : "bg-accent-blue/60"}`}
                            style={{ height: `${height}%` }}
                          />
                          <span className={`text-[8px] font-mono ${isShabbat ? "text-accent-amber" : "text-text-tertiary"}`}>{d.name}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </AnalyticsCard>
            )}

            {activePanels.has("threat_distribution") && (
              <AnalyticsCard title="Threat Levels" badge={{ label: `Most: L${analytics.threat_distribution.mostCommonLevel}`, direction: "neutral" }}>
                <div className="px-4 py-3 space-y-2">
                  {[0, 1, 2, 3].map((level) => {
                    const count = analytics.threat_distribution.counts[level] || 0;
                    const total = Object.values(analytics.threat_distribution.counts).reduce((a, b) => a + b, 0);
                    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                    const colors = ["bg-text-tertiary", "bg-accent-green", "bg-accent-amber", "bg-accent-red"];
                    const labels = ["Unknown", "Low", "Medium", "High"];
                    return (
                      <div key={level} className="flex items-center gap-2">
                        <span className="text-[10px] text-text-tertiary w-14">{labels[level]}</span>
                        <div className="flex-1 h-3 bg-bg-elevated rounded-full overflow-hidden">
                          <div className={`h-full ${colors[level]} rounded-full`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[10px] font-mono text-text-secondary w-10 text-right">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </AnalyticsCard>
            )}

            {activePanels.has("time_between_alerts") && (
              <AnalyticsCard title="Alert Gaps" badge={{ label: `${analytics.time_between_alerts.medianGapMinutes}m median`, direction: "neutral" }}>
                <div className="px-4 py-3">
                  <div className="font-mono text-3xl font-bold text-accent-blue tracking-tight text-center mb-2">
                    {analytics.time_between_alerts.medianGapMinutes}m
                  </div>
                  <div className="text-[10px] text-text-tertiary text-center">median gap between alerts</div>
                </div>
              </AnalyticsCard>
            )}

            {activePanels.has("quiet_vs_active") && (
              <AnalyticsCard title="Quiet Periods" badge={{ label: `${analytics.quiet_vs_active.longestQuietHours}h longest`, direction: "down" }}>
                <div className="px-4 py-3">
                  <div className="font-mono text-3xl font-bold text-accent-green tracking-tight text-center mb-2">
                    {analytics.quiet_vs_active.longestQuietHours}h
                  </div>
                  <div className="text-[10px] text-text-tertiary text-center">longest quiet period</div>
                </div>
              </AnalyticsCard>
            )}

            {activePanels.has("monthly_trends") && (
              <AnalyticsCard title="Monthly Trends">
                <div className="px-4 py-3 space-y-1.5">
                  {analytics.monthly_trends.months.map((m) => (
                    <div key={m.month} className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-text-tertiary w-16">{m.month}</span>
                      <div className="flex-1 h-3 bg-bg-elevated rounded-full overflow-hidden">
                        <div className="h-full bg-accent-blue/60 rounded-full" style={{ width: `${Math.min(100, (m.count / Math.max(...analytics.monthly_trends.months.map((x) => x.count), 1)) * 100)}%` }} />
                      </div>
                      <span className="text-[10px] font-mono text-text-secondary w-10 text-right">{m.count}</span>
                    </div>
                  ))}
                </div>
              </AnalyticsCard>
            )}

            {activePanels.has("escalation_patterns") && (
              <AnalyticsCard title="Escalation">
                <div className="px-4 py-3 text-center">
                  <div className="text-[12px] text-text-secondary">Based on {analytics.totalAlerts} alerts in selected range</div>
                </div>
              </AnalyticsCard>
            )}

            {activePanels.has("multi_city_correlation") && (
              <AnalyticsCard title="Multi-Region">
                <div className="px-4 py-3 text-center">
                  <div className="text-[12px] text-text-secondary">Based on {analytics.totalAlerts} alerts in selected range</div>
                </div>
              </AnalyticsCard>
            )}

            {activePanels.has("geographic_spread") && (
              <AnalyticsCard title="Geo Spread">
                <div className="px-4 py-3 text-center">
                  <div className="text-[12px] text-text-secondary">Based on {analytics.totalAlerts} alerts in selected range</div>
                </div>
              </AnalyticsCard>
            )}
          </>
        )}
        <Footer />
      </div>
    </div>
  );
}
