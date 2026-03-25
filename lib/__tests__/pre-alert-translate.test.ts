import { describe, it, expect } from "vitest";
import { translatePreAlertBody, translatePreAlertTitle } from "../pre-alert-translate";

describe("translatePreAlertBody", () => {
  it("translates a typical early warning message", () => {
    const result = translatePreAlertBody(
      "בעקבות זיהוי שיגורים, בדקות הקרובות צפויות להתקבל התרעות באזור ערבה. לרשימת הישובים המלאה"
    );
    expect(result).toBe(
      "Following launch detection, sirens may be activated in the coming minutes in the area of Arava"
    );
  });

  it("translates exit notification", () => {
    const result = translatePreAlertBody("האירוע הסתיים באזורים הבאים");
    expect(result).toBe("The event has concluded in the following areas");
  });

  it("translates region names", () => {
    const result = translatePreAlertBody(
      "בדקות הקרובות ייתכן ויופעלו התרעות באזור גליל עליון"
    );
    expect(result).toContain("Upper Galilee");
    expect(result.toLowerCase()).toContain("sirens may be activated");
  });

  it("handles multiple regions", () => {
    const result = translatePreAlertBody(
      "האירוע הסתיים באזורים ערבה, הנגב"
    );
    expect(result).toContain("Arava");
    expect(result).toContain("Negev");
  });

  it("strips boilerplate text", () => {
    const result = translatePreAlertBody(
      "בעקבות זיהוי שיגורים באזור הדרום. לרשימת הישובים המלאה"
    );
    expect(result).not.toContain("לרשימת");
  });

  it("returns original Hebrew if mostly untranslatable", () => {
    const original = "הודעה מיוחדת שלא תואמת שום תבנית ידועה בשפה העברית";
    const result = translatePreAlertBody(original);
    expect(result).toBe(original);
  });

  it("capitalizes first letter of result", () => {
    const result = translatePreAlertBody("זיהוי שיגורים באזור ערבה");
    expect(result.charAt(0)).toMatch(/[A-Z]/);
  });
});

describe("translatePreAlertTitle", () => {
  it("translates flash title", () => {
    expect(translatePreAlertTitle("מבזק פיקוד העורף")).toBe("Home Front Command Flash");
  });

  it("translates update title", () => {
    expect(translatePreAlertTitle("עדכון פיקוד העורף")).toBe("Home Front Command Update");
  });

  it("returns original for unknown titles", () => {
    expect(translatePreAlertTitle("כותרת אחרת")).toBe("כותרת אחרת");
  });
});
