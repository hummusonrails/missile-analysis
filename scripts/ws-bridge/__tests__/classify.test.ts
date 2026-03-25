import { describe, it, expect } from "vitest";
import { classifySystemMessage, generatePreAlertId } from "../classify";

describe("classifySystemMessage", () => {
  it("classifies early warning with title + body as high confidence", () => {
    const result = classifySystemMessage(
      "מבזק פיקוד העורף",
      "בדקות הקרובות ייתכן ויופעלו התרעות באזור הדרום"
    );
    expect(result).toEqual({ type: "early_warning", confidence: "high" });
  });

  it("classifies early warning with body only as medium confidence", () => {
    const result = classifySystemMessage(
      "הודעה כללית",
      "בעקבות זיהוי שיגורים לעבר ישראל ייתכן התרעות"
    );
    expect(result).toEqual({ type: "early_warning", confidence: "medium" });
  });

  it("classifies exit notification with title + body as high confidence", () => {
    const result = classifySystemMessage(
      "עדכון פיקוד העורף",
      "האירוע הסתיים באזורים הבאים"
    );
    expect(result).toEqual({ type: "exit_notification", confidence: "high" });
  });

  it("classifies exit notification with body only as medium confidence", () => {
    const result = classifySystemMessage(
      "הודעה",
      "האירוע הסתיים באזורים הבאים: דרום, שפלה"
    );
    expect(result).toEqual({ type: "exit_notification", confidence: "medium" });
  });

  it("classifies title-only early warning as medium confidence", () => {
    const result = classifySystemMessage("מבזק פיקוד העורף", "תוכן כללי");
    expect(result).toEqual({ type: "early_warning", confidence: "medium" });
  });

  it("classifies title-only exit as medium confidence", () => {
    const result = classifySystemMessage("עדכון פיקוד העורף", "פרטים נוספים");
    expect(result).toEqual({ type: "exit_notification", confidence: "medium" });
  });

  it("returns null for unrelated messages", () => {
    const result = classifySystemMessage("הודעת מערכת", "בדיקת תקינות");
    expect(result).toBeNull();
  });

  it("returns null for empty strings", () => {
    const result = classifySystemMessage("", "");
    expect(result).toBeNull();
  });

  it("prioritizes early warning over exit when both match body", () => {
    // Early warning keywords checked first
    const result = classifySystemMessage(
      "מבזק פיקוד העורף",
      "בדקות הקרובות ייתכן התרעות"
    );
    expect(result?.type).toBe("early_warning");
  });

  it("handles launch detection keyword", () => {
    const result = classifySystemMessage(
      "מבזק פיקוד העורף",
      "זיהוי שיגורים מרצועת עזה"
    );
    expect(result).toEqual({ type: "early_warning", confidence: "high" });
  });

  it("handles 'launches toward Israel' keyword", () => {
    const result = classifySystemMessage(
      "מבזק פיקוד העורף",
      "שיגורים לעבר ישראל מלבנון"
    );
    expect(result).toEqual({ type: "early_warning", confidence: "high" });
  });
});

describe("generatePreAlertId", () => {
  it("generates deterministic IDs", () => {
    const id1 = generatePreAlertId(1000, "title", "body");
    const id2 = generatePreAlertId(1000, "title", "body");
    expect(id1).toBe(id2);
  });

  it("generates different IDs for different content", () => {
    const id1 = generatePreAlertId(1000, "title1", "body");
    const id2 = generatePreAlertId(1000, "title2", "body");
    expect(id1).not.toBe(id2);
  });

  it("generates different IDs for different timestamps", () => {
    const id1 = generatePreAlertId(1000, "title", "body");
    const id2 = generatePreAlertId(2000, "title", "body");
    expect(id1).not.toBe(id2);
  });

  it("starts with pre_ prefix", () => {
    const id = generatePreAlertId(1000, "title", "body");
    expect(id).toMatch(/^pre_\d+_[0-9a-f]{8}$/);
  });
});
