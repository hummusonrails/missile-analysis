/**
 * Classifies Tzofar WebSocket SYSTEM_MESSAGE events as early warnings
 * or exit notifications based on Hebrew keyword matching.
 */

export type PreAlertType = "early_warning" | "exit_notification";

// Keywords that indicate an early warning (missile launches detected, sirens may follow)
const EARLY_WARNING_KEYWORDS = [
  "בדקות הקרובות",           // "in the coming minutes"
  "צפויות להתקבל התרעות",    // "alerts expected to be received"
  "ייתכן ויופעלו התרעות",    // "alerts may be activated"
  "זיהוי שיגורים",           // "launch detection"
  "שיגורים לעבר ישראל",      // "launches toward Israel"
  "בעקבות זיהוי שיגורים",    // "following launch detection"
];

// Keywords that indicate an exit notification (event concluded)
const EXIT_KEYWORDS = [
  "האירוע הסתיים",           // "the event concluded"
  "הסתיים באזורים",          // "concluded in areas"
];

// Title patterns
const EARLY_WARNING_TITLE = "מבזק פיקוד העורף";  // "Home Front Command flash"
const EXIT_TITLE = "עדכון פיקוד העורף";           // "Home Front Command update"

export interface ClassificationResult {
  type: PreAlertType;
  confidence: "high" | "medium";
}

/**
 * Classify a SYSTEM_MESSAGE as early_warning or exit_notification.
 * Returns null if the message doesn't match either category.
 */
export function classifySystemMessage(
  titleHe: string,
  bodyHe: string
): ClassificationResult | null {
  const title = titleHe.trim();
  const body = bodyHe.trim();

  // Check early warning first (higher priority)
  const isEarlyWarningTitle = title.includes(EARLY_WARNING_TITLE);
  const earlyWarningBodyMatch = EARLY_WARNING_KEYWORDS.some((kw) => body.includes(kw));

  if (isEarlyWarningTitle && earlyWarningBodyMatch) {
    return { type: "early_warning", confidence: "high" };
  }
  if (earlyWarningBodyMatch) {
    return { type: "early_warning", confidence: "medium" };
  }

  // Check exit notification
  const isExitTitle = title.includes(EXIT_TITLE);
  const exitBodyMatch = EXIT_KEYWORDS.some((kw) => body.includes(kw));

  if (isExitTitle && exitBodyMatch) {
    return { type: "exit_notification", confidence: "high" };
  }
  if (exitBodyMatch) {
    return { type: "exit_notification", confidence: "medium" };
  }

  // Title-only matches (lower confidence)
  if (isEarlyWarningTitle) {
    return { type: "early_warning", confidence: "medium" };
  }
  if (isExitTitle) {
    return { type: "exit_notification", confidence: "medium" };
  }

  return null;
}

/**
 * Generate a deterministic ID for a pre-alert based on content.
 * Uses timestamp + first 8 chars of a simple hash of title+body.
 */
export function generatePreAlertId(timestamp: number, titleHe: string, bodyHe: string): string {
  const content = `${timestamp}:${titleHe}:${bodyHe}`;
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  const hexHash = Math.abs(hash).toString(16).padStart(8, "0");
  return `pre_${timestamp}_${hexHash}`;
}
