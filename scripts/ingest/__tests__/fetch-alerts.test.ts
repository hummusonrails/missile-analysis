import { describe, it, expect } from "vitest";
import { parseRawAlerts, deduplicateAlerts } from "../fetch-alerts";

describe("parseRawAlerts", () => {
  it("converts upstream format to Alert[]", () => {
    const raw = [
      {
        id: 123,
        alerts: [
          { time: 1710000000, cities: ["אשקלון", "שדרות"], threat: 2, isDrill: false },
        ],
      },
    ];
    const result = parseRawAlerts(raw);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("123_1710000000000");
    expect(result[0].timestamp).toBe(1710000000000);
    expect(result[0].cities).toEqual(["אשקלון", "שדרות"]);
    expect(result[0].threat).toBe(2);
  });

  it("filters out drills", () => {
    const raw = [
      {
        id: 1,
        alerts: [
          { time: 1710000000, cities: ["תל אביב"], threat: 1, isDrill: true },
          { time: 1710000001, cities: ["חיפה"], threat: 1, isDrill: false },
        ],
      },
    ];
    const result = parseRawAlerts(raw);
    expect(result).toHaveLength(1);
    expect(result[0].cities).toEqual(["חיפה"]);
  });

  it("skips alerts missing required fields", () => {
    const raw = [
      {
        id: 1,
        alerts: [
          { time: 1710000000, threat: 1, isDrill: false },
          { cities: ["חיפה"], threat: 1, isDrill: false },
        ],
      },
    ];
    const result = parseRawAlerts(raw);
    expect(result).toHaveLength(0);
  });
});

describe("deduplicateAlerts", () => {
  it("returns only alerts not in existing IDs set", () => {
    const alerts = [
      { id: "1_1000", timestamp: 1000, cities: ["a"], threat: 1, created_at: 0 },
      { id: "2_2000", timestamp: 2000, cities: ["b"], threat: 2, created_at: 0 },
    ];
    const existingIds = new Set(["1_1000"]);
    const result = deduplicateAlerts(alerts, existingIds);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("2_2000");
  });
});
