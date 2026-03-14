import { describe, it, expect } from "vitest";
import {
  computeHourlyHistogram,
  computeShabbatVsWeekday,
  computeMorningVsEvening,
  computeDayOfWeek,
} from "../compute-analytics";
import type { Alert } from "../../../lib/types";

function makeAlert(overrides: Partial<Alert> & { timestamp: number }): Alert {
  return {
    id: `test_${overrides.timestamp}`,
    cities: ["test"],
    threat: 1,
    created_at: Date.now(),
    ...overrides,
  };
}

describe("computeHourlyHistogram", () => {
  it("counts alerts by hour 0-23", () => {
    const alerts = [
      makeAlert({ timestamp: new Date("2024-01-15T08:00:00Z").getTime() }),
      makeAlert({ timestamp: new Date("2024-01-15T08:30:00Z").getTime() }),
      makeAlert({ timestamp: new Date("2024-01-15T21:00:00Z").getTime() }),
    ];
    const result = computeHourlyHistogram(alerts);
    expect(result.hours).toHaveLength(24);
    const total = result.hours.reduce((sum: number, h: { count: number }) => sum + h.count, 0);
    expect(total).toBe(3);
  });
});

describe("computeShabbatVsWeekday", () => {
  it("separates Shabbat (Fri evening - Sat evening) from weekdays", () => {
    const alerts = [
      makeAlert({ timestamp: new Date("2024-01-19T18:00:00Z").getTime() }),
      makeAlert({ timestamp: new Date("2024-01-15T08:00:00Z").getTime() }),
      makeAlert({ timestamp: new Date("2024-01-16T08:00:00Z").getTime() }),
    ];
    const result = computeShabbatVsWeekday(alerts);
    expect(result.shabbatCount).toBeGreaterThanOrEqual(1);
    expect(result.weekdayCount).toBeGreaterThanOrEqual(1);
    expect(result.multiplier).toBeGreaterThan(0);
  });
});

describe("computeMorningVsEvening", () => {
  it("splits at 06:00/18:00 Israel time", () => {
    const alerts = [
      makeAlert({ timestamp: new Date("2024-01-15T05:00:00Z").getTime() }),
      makeAlert({ timestamp: new Date("2024-01-15T19:00:00Z").getTime() }),
    ];
    const result = computeMorningVsEvening(alerts);
    expect(result.morningCount + result.eveningCount).toBe(2);
    expect(result.eveningPercent).toBeGreaterThan(0);
  });
});

describe("computeDayOfWeek", () => {
  it("counts alerts by day of week", () => {
    const alerts = [
      makeAlert({ timestamp: new Date("2024-01-15T10:00:00Z").getTime() }), // Mon
      makeAlert({ timestamp: new Date("2024-01-16T10:00:00Z").getTime() }), // Tue
      makeAlert({ timestamp: new Date("2024-01-16T14:00:00Z").getTime() }), // Tue
    ];
    const result = computeDayOfWeek(alerts);
    expect(result.days).toHaveLength(7);
    const total = result.days.reduce((sum, d) => sum + d.count, 0);
    expect(total).toBe(3);
  });
});
