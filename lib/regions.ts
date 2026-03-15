export const REGIONS = [
  { id: "western-galilee", en: "Western Galilee", he: "גליל מערבי" },
  { id: "upper-galilee", en: "Upper Galilee", he: "גליל עליון" },
  { id: "lower-galilee", en: "Lower Galilee", he: "גליל תחתון" },
  { id: "haifa-krayot", en: "Haifa & Krayot", he: "חיפה והקריות" },
  { id: "jezreel-valley", en: "Jezreel Valley", he: "עמק יזרעאל" },
  { id: "golan-heights", en: "Golan Heights", he: "רמת הגולן" },
  { id: "sharon", en: "Sharon", he: "השרון" },
  { id: "tel-aviv-gush-dan", en: "Tel Aviv & Gush Dan", he: "תל אביב וגוש דן" },
  { id: "central", en: "Central", he: "מרכז" },
  { id: "jerusalem", en: "Jerusalem", he: "ירושלים" },
  { id: "shfela", en: "Shfela", he: "שפלה" },
  { id: "ashkelon-coast", en: "Ashkelon Coast", he: "חוף אשקלון" },
  { id: "negev", en: "Negev", he: "נגב" },
  { id: "gaza-envelope", en: "Gaza Envelope", he: "עוטף עזה" },
  { id: "eilat-arava", en: "Eilat & Arava", he: "אילת והערבה" },
  { id: "yehuda-vshomron", en: "Judea & Samaria", he: "יהודה ושומרון" },
];

export const VALID_REGION_IDS = new Set(REGIONS.map((r) => r.id));
