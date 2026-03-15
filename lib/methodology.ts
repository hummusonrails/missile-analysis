// Data science methodology explanations for each analytics panel
// Used by the info tooltip modal in AnalyticsCard

export interface Methodology {
  en: string;
  he: string;
}

export const METHODOLOGIES: Record<string, Methodology> = {
  shabbat_vs_weekday: {
    en: `**Methodology:** Alerts are classified as "Shabbat" if their timestamp (Israel time, Asia/Jerusalem) falls between Friday 18:00 and Saturday 21:00. All other alerts are "Weekday."

**Normalization:** Raw counts are divided by the actual number of Shabbat days (Fri+Sat) and weekdays (Sun–Thu) present in the selected date range, producing a per-day average for each group. The multiplier is the ratio of these two averages.

**Why this matters:** Raw totals can be misleading if the date range contains unequal numbers of Shabbat vs weekday days. Per-day averaging ensures a fair comparison.`,
    he: `**מתודולוגיה:** התרעות מסווגות כ"שבת" אם חותמת הזמן שלהן (שעון ישראל) נופלת בין יום שישי 18:00 ליום שבת 21:00. כל שאר ההתרעות הן "ימי חול."

**נרמול:** הספירות הגולמיות מחולקות במספר ימי השבת (שישי+שבת) וימי החול (ראשון–חמישי) בפועל בטווח התאריכים הנבחר, ומייצרות ממוצע יומי לכל קבוצה. המכפיל הוא היחס בין שני הממוצעים.

**למה זה חשוב:** סכומים גולמיים עלולים להטעות אם טווח התאריכים מכיל מספר לא שווה של ימי שבת מול ימי חול.`,
  },

  hourly_histogram: {
    en: `**Methodology:** Each alert is assigned to an hour bucket (0–23) based on its timestamp converted to Israel time (Asia/Jerusalem timezone). The histogram shows the total count of alerts per hour across the entire selected date range.

**Peak/Quietest detection:** The hour with the maximum count is marked as peak; the hour with the minimum count is marked as quietest.

**Note:** This is an absolute count, not normalized by number of days. It reflects the overall distribution shape across the selected period.`,
    he: `**מתודולוגיה:** כל התרעה משויכת לדלי שעה (0–23) לפי חותמת הזמן שלה בשעון ישראל (אזור זמן Asia/Jerusalem). ההיסטוגרמה מציגה את הספירה הכוללת של התרעות לשעה לאורך כל טווח התאריכים הנבחר.

**זיהוי שיא/שקט:** השעה עם הספירה הגבוהה ביותר מסומנת כשיא; השעה עם הספירה הנמוכה ביותר מסומנת כשקטה ביותר.

**הערה:** זוהי ספירה מוחלטת, לא מנורמלת לפי מספר ימים. היא משקפת את צורת ההתפלגות הכוללת בתקופה הנבחרת.`,
  },

  morning_vs_evening: {
    en: `**Methodology:** Alerts are split into two bins based on Israel time: Morning (06:00–17:59) and Evening (18:00–05:59). The percentage represents each bin's share of total alerts.

**Peak/Quietest hours:** Derived from the same per-hour counts as the Hourly Pattern panel — the single hour with the highest and lowest counts respectively.

**Boundary choice:** 06:00/18:00 roughly corresponds to sunrise/sunset in Israel and aligns with common civilian daily rhythm.`,
    he: `**מתודולוגיה:** התרעות מחולקות לשני דליים לפי שעון ישראל: בוקר (06:00–17:59) וערב (18:00–05:59). האחוז מייצג את חלקו של כל דלי מסך ההתרעות.

**שעות שיא/שקט:** נגזרות מאותן ספירות לשעה כמו בלוח הדפוס השעתי — השעה הבודדת עם הספירה הגבוהה והנמוכה ביותר בהתאמה.

**בחירת גבול:** 06:00/18:00 מתאים בערך לזריחה/שקיעה בישראל ומיושר עם הקצב היומי האזרחי.`,
  },

  day_of_week: {
    en: `**Methodology:** Alerts are grouped by day of week (Sun–Sat) based on Israel time. Raw counts are then **normalized** by dividing each day's total by the number of times that weekday appears in the selected date range.

**Example:** If the range contains 5 Mondays but only 4 Tuesdays, dividing by 5 and 4 respectively gives a fair per-day average rather than a misleading raw total.

**Shabbat highlighting:** Friday and Saturday bars are highlighted in amber to visually distinguish Shabbat days.`,
    he: `**מתודולוגיה:** התרעות מקובצות לפי יום בשבוע (ראשון–שבת) לפי שעון ישראל. הספירות הגולמיות **מנורמלות** על ידי חלוקת הסכום של כל יום במספר הפעמים שיום חול זה מופיע בטווח התאריכים הנבחר.

**דוגמה:** אם הטווח מכיל 5 ימי שני אבל רק 4 ימי שלישי, חלוקה ב-5 ו-4 בהתאמה נותנת ממוצע יומי הוגן במקום סכום גולמי מטעה.

**הדגשת שבת:** עמודות יום שישי ושבת מודגשות בכתום לזיהוי חזותי של ימי שבת.`,
  },

  threat_distribution: {
    en: `**Methodology:** Each alert carries a numeric threat type from the Pikud HaOref API. These are mapped to human-readable categories:

- **0** → Rockets (rocket/missile fire)
- **2** → Infiltration (terrorist infiltration fear)
- **3** → Earthquake
- **5** → Hostile Aircraft (drone/UAV intrusion)
- **7** → Non-conventional Missile
- **8** → General Alert

**Calculation:** Simple frequency count per category, with percentage = (category count / total alerts) × 100. Only categories with at least one alert are displayed.`,
    he: `**מתודולוגיה:** כל התרעה נושאת סוג איום מספרי מ-API של פיקוד העורף. אלה ממופים לקטגוריות קריאות:

- **0** → רקטות (ירי רקטות/טילים)
- **2** → חדירה (חשש מחדירת מחבלים)
- **3** → רעידת אדמה
- **5** → כלי טיס עוין (חדירת רחפן/מל"ט)
- **7** → טיל לא קונבנציונלי
- **8** → התרעה כללית

**חישוב:** ספירת תדירות פשוטה לכל קטגוריה, עם אחוז = (ספירת קטגוריה / סה"כ התרעות) × 100. רק קטגוריות עם לפחות התרעה אחת מוצגות.`,
  },

  time_between_alerts: {
    en: `**Methodology:** Alerts are sorted chronologically. The time gap (in minutes) between each consecutive pair of alerts is computed. The **median** of all gaps is reported as the central tendency measure.

**Why median, not mean:** The mean is heavily skewed by long quiet periods (e.g., a 12-hour overnight gap). The median better represents the "typical" gap a person would experience.

**Interpretation:** A low median (e.g., 3 minutes) indicates dense, rapid-fire alert activity. A high median (e.g., 2 hours) indicates more spaced-out alerts.`,
    he: `**מתודולוגיה:** התרעות ממוינות כרונולוגית. פער הזמן (בדקות) בין כל זוג התרעות רצופות מחושב. **החציון** של כל הפערים מדווח כמדד הנטייה המרכזית.

**למה חציון ולא ממוצע:** הממוצע מוטה מאוד על ידי תקופות שקט ארוכות (למשל, פער לילי של 12 שעות). החציון מייצג טוב יותר את הפער ה"טיפוסי" שאדם יחווה.

**פרשנות:** חציון נמוך (למשל, 3 דקות) מעיד על פעילות התרעות צפופה ומהירה. חציון גבוה (למשל, שעתיים) מעיד על התרעות מרווחות יותר.`,
  },

  quiet_vs_active: {
    en: `**Methodology:** Alerts are sorted chronologically. Two metrics are computed:

**Longest quiet period:** The maximum time gap (in hours) between any two consecutive alerts. Represents the longest stretch with zero alert activity.

**Longest active period:** Consecutive alerts are grouped into "barrages" where each successive alert arrives within 30 minutes of the previous one. The longest such barrage duration (in hours) is reported.

**30-minute threshold:** Chosen because a 30-minute gap typically indicates a pause in a coordinated attack pattern, while gaps under 30 minutes suggest continuous activity.`,
    he: `**מתודולוגיה:** התרעות ממוינות כרונולוגית. שני מדדים מחושבים:

**תקופת שקט ארוכה ביותר:** פער הזמן המקסימלי (בשעות) בין כל שתי התרעות רצופות. מייצג את הפרק הארוך ביותר ללא פעילות התרעות.

**תקופת פעילות ארוכה ביותר:** התרעות רצופות מקובצות ל"מטחים" שבהם כל התרעה עוקבת מגיעה תוך 30 דקות מהקודמת. משך המטח הארוך ביותר (בשעות) מדווח.

**סף 30 דקות:** נבחר מכיוון שפער של 30 דקות בדרך כלל מעיד על הפסקה בדפוס תקיפה מתואם, בעוד פערים מתחת ל-30 דקות מרמזים על פעילות מתמשכת.`,
  },

  monthly_trends: {
    en: `**Methodology:** Alerts are grouped by calendar month (YYYY-MM) based on Israel time. Each bar shows the total count for that month.

**Month-over-month delta:** The percentage change between the last two complete months: ((current − previous) / previous) × 100. A positive delta indicates increasing alert frequency; negative indicates decreasing.

**Note:** Partial months (e.g., the current month) will show lower counts simply because the month isn't complete yet, not necessarily because activity decreased.`,
    he: `**מתודולוגיה:** התרעות מקובצות לפי חודש קלנדרי (YYYY-MM) לפי שעון ישראל. כל עמודה מציגה את הספירה הכוללת לאותו חודש.

**שינוי חודש-על-חודש:** שינוי באחוזים בין שני החודשים השלמים האחרונים: ((נוכחי − קודם) / קודם) × 100. דלתא חיובית מעידה על תדירות התרעות עולה; שלילית מעידה על ירידה.

**הערה:** חודשים חלקיים (למשל, החודש הנוכחי) יציגו ספירות נמוכות יותר פשוט מכיוון שהחודש עדיין לא הסתיים, לא בהכרח בגלל שהפעילות ירדה.`,
  },

  escalation_patterns: {
    en: `**Methodology:** Two rates are compared:

**Current rate:** Number of alerts in the last 60 minutes (a rolling 1-hour window ending at the current moment).

**Baseline rate:** Total alerts in the selected period divided by total hours in that period. This gives the average hourly rate.

**Multiplier:** Current rate / baseline rate. A multiplier > 2.0 is flagged as "elevated," meaning the current hour has more than double the typical hourly rate. A value of 0 means no alerts in the last hour.

**Limitation:** The baseline includes the current hour, so during sustained high activity the baseline itself rises, potentially understating the escalation.`,
    he: `**מתודולוגיה:** שני שיעורים מושווים:

**שיעור נוכחי:** מספר ההתרעות ב-60 הדקות האחרונות (חלון גלילה של שעה אחת שמסתיים ברגע הנוכחי).

**שיעור בסיס:** סה"כ התרעות בתקופה הנבחרת חלקי סה"כ שעות באותה תקופה. זה נותן את השיעור הממוצע לשעה.

**מכפיל:** שיעור נוכחי / שיעור בסיס. מכפיל > 2.0 מסומן כ"מוגבר," כלומר השעה הנוכחית כוללת יותר מכפול השיעור השעתי הטיפוסי. ערך 0 אומר שאין התרעות בשעה האחרונה.

**מגבלה:** הבסיס כולל את השעה הנוכחית, כך שבמהלך פעילות גבוהה מתמשכת הבסיס עצמו עולה, מה שעלול להמעיט בהערכת ההסלמה.`,
  },

  multi_city_correlation: {
    en: `**Methodology:** Alerts are grouped by their upstream group_id (the first part of the composite alert ID, representing a single alert event from Pikud HaOref). For each group, the distinct geographic regions touched are counted using city-to-region mapping.

**Multi-region event:** A group that spans 3 or more distinct regions. This indicates a widespread, coordinated attack pattern rather than a localized event.

**Avg regions/event:** The mean number of distinct regions across all multi-region groups. Higher values indicate broader geographic spread per attack.

**Limitation:** ~440 cities lack geocoded coordinates, so some region assignments may be missing, potentially undercounting multi-region events.`,
    he: `**מתודולוגיה:** התרעות מקובצות לפי מזהה הקבוצה שלהן (החלק הראשון של מזהה ההתרעה המורכב, המייצג אירוע התרעה בודד מפיקוד העורף). לכל קבוצה, האזורים הגיאוגרפיים הנפרדים שנפגעו נספרים באמצעות מיפוי עיר-לאזור.

**אירוע רב-אזורי:** קבוצה שמשתרעת על 3 אזורים נפרדים או יותר. זה מעיד על דפוס תקיפה נרחב ומתואם ולא על אירוע מקומי.

**ממוצע אזורים/אירוע:** הממוצע של אזורים נפרדים בכל הקבוצות הרב-אזוריות. ערכים גבוהים יותר מעידים על פיזור גיאוגרפי רחב יותר לכל תקיפה.

**מגבלה:** ~440 ערים חסרות קואורדינטות, כך שחלק מהשיוכים לאזורים עשויים לחסור, מה שעלול לגרום לספירה חסרה של אירועים רב-אזוריים.`,
  },

  geographic_spread: {
    en: `**Methodology:** Each alert belongs to a group (identified by group_id from the upstream API). For each group, the number of distinct geographic regions is counted based on the cities listed in that group's alerts.

**Avg regions per group:** The arithmetic mean of region counts across all groups. A value of 1.0 means alerts typically hit a single region; higher values indicate broader simultaneous geographic coverage.

**Total groups:** The number of distinct alert events (not individual alerts — one event can trigger alerts in multiple cities).`,
    he: `**מתודולוגיה:** כל התרעה שייכת לקבוצה (מזוהה לפי מזהה קבוצה מה-API). לכל קבוצה, מספר האזורים הגיאוגרפיים הנפרדים נספר בהתבסס על הערים המפורטות בהתרעות של אותה קבוצה.

**ממוצע אזורים לקבוצה:** הממוצע החשבוני של ספירות האזורים בכל הקבוצות. ערך של 1.0 אומר שהתרעות בדרך כלל פוגעות באזור אחד; ערכים גבוהים יותר מעידים על כיסוי גיאוגרפי בו-זמני רחב יותר.

**סה"כ קבוצות:** מספר אירועי ההתרעה הנפרדים (לא התרעות בודדות — אירוע אחד יכול לגרום להתרעות בערים מרובות).`,
  },
};
