/**
 * Translates Hebrew pre-alert body text to English.
 *
 * Pre-alert messages from Pikud HaOref follow predictable patterns.
 * This maps known Hebrew phrases to English equivalents.
 */

// Region name translations (Hebrew → English)
const REGION_NAMES: Record<string, string> = {
  "ערבה": "Arava",
  "גליל עליון": "Upper Galilee",
  "גליל תחתון": "Lower Galilee",
  "חיפה והקריות": "Haifa & Krayot",
  "עמק יזרעאל": "Jezreel Valley",
  "רמת הגולן": "Golan Heights",
  "השרון": "Sharon",
  "תל אביב וגוש דן": "Tel Aviv & Gush Dan",
  "השפלה": "Shfela",
  "ירושלים": "Jerusalem",
  "חוף אשקלון": "Ashkelon Coast",
  "הנגב": "Negev",
  "עוטף עזה": "Gaza Envelope",
  "אילת והערבה": "Eilat & Arava",
  "יהודה ושומרון": "Judea & Samaria",
  "מרכז הארץ": "Central Israel",
  "דרום הארץ": "Southern Israel",
  "צפון הארץ": "Northern Israel",
  "הדרום": "the South",
  "הצפון": "the North",
  "המרכז": "the Center",
  "גוש דן": "Gush Dan",
  "נגב מערבי": "Western Negev",
  "לכיש": "Lakhish",
  "עמק בית שאן": "Beit She'an Valley",
  "מנשה": "Menashe",
  "ואדי ערה": "Wadi Ara",
  "העמקים": "HaAmakim",
  "המפרץ": "HaMifratz",
  "הכרמל": "HaCarmel",
  "קו העימות": "Confrontation Line",
};

// Phrase translations
const PHRASE_MAP: [RegExp, string][] = [
  [/בעקבות זיהוי שיגורים/g, "Following launch detection"],
  [/זיהוי שיגורים/g, "Launch detection"],
  [/שיגורים לעבר ישראל/g, "launches toward Israel"],
  [/בדקות הקרובות צפויות להתקבל התרעות/g, "sirens may be activated in the coming minutes"],
  [/בדקות הקרובות ייתכן ויופעלו התרעות/g, "sirens may be activated in the coming minutes"],
  [/ייתכן ויופעלו התרעות/g, "sirens may be activated"],
  [/צפויות להתקבל התרעות/g, "sirens may be activated"],
  [/האירוע הסתיים באזורים הבאים/g, "The event has concluded in the following areas"],
  [/האירוע הסתיים באזורים/g, "The event has concluded in the areas of"],
  [/הסתיים באזורים/g, "concluded in the areas of"],
  [/האירוע הסתיים/g, "The event has concluded"],
  [/באזורים/g, "in the areas of"],
  [/באזור/g, "in the area of"],
  [/לרשימת הישובים המלאה/g, ""], // boilerplate, omit
  [/יש להיכנס למרחב מוגן/g, "Enter a protected space"],
  [/יש להישאר במרחב מוגן/g, "Remain in the protected space"],
  [/ולהישאר בו/g, "and remain there"],
  [/עד להודעה נוספת/g, "until further notice"],
  [/מבזק פיקוד העורף/g, "Home Front Command Flash"],
  [/עדכון פיקוד העורף/g, "Home Front Command Update"],
  [/פיקוד העורף/g, "Home Front Command"],
];

/**
 * Translate a Hebrew pre-alert body to English.
 * Falls back to the original Hebrew if no patterns match.
 */
export function translatePreAlertBody(bodyHe: string): string {
  let text = bodyHe.trim();

  // Replace known region names
  for (const [he, en] of Object.entries(REGION_NAMES)) {
    text = text.replaceAll(he, en);
  }

  // Replace known phrases (order matters — longer phrases first)
  for (const [pattern, replacement] of PHRASE_MAP) {
    text = text.replace(pattern, replacement);
  }

  // Clean up: remove trailing periods/dots that are doubled, trim whitespace
  text = text
    .replace(/\s+/g, " ")
    .replace(/\.\s*\./g, ".")
    .trim();

  // Remove trailing empty content from boilerplate removal
  text = text.replace(/[,.\s]+$/, "").trim();

  // If the result still has significant Hebrew, return both
  const hebrewCharCount = (text.match(/[\u0590-\u05FF]/g) || []).length;
  if (hebrewCharCount > text.length * 0.3) {
    // Mostly untranslated — return original
    return bodyHe.trim();
  }

  // Capitalize first letter
  if (text.length > 0) {
    text = text.charAt(0).toUpperCase() + text.slice(1);
  }

  return text;
}

/**
 * Translate a Hebrew pre-alert title to English.
 */
export function translatePreAlertTitle(titleHe: string): string {
  if (titleHe.includes("מבזק פיקוד העורף")) return "Home Front Command Flash";
  if (titleHe.includes("עדכון פיקוד העורף")) return "Home Front Command Update";
  if (titleHe.includes("פיקוד העורף")) return "Home Front Command";
  return titleHe;
}
