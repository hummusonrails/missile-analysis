export interface Alert {
  id: string;
  timestamp: number;
  cities: string[];
  threat: number;
  created_at: number;
}

export interface CityCoord {
  city_name: string;
  city_name_en: string;
  lat: number;
  lng: number;
  region_id: string;
}

export interface AnalyticsCacheEntry {
  key: string;
  data: string;
  computed_at: number;
  params?: string;
}

export interface PreAlert {
  id: string;
  timestamp: number;
  title_he: string;
  body_he: string;
  city_ids: number[];
  regions: string[];
  alert_type: "early_warning" | "exit_notification";
  raw_data?: string;
  created_at: number;
}

export type ThreatLevel = 0 | 1 | 2 | 3;
export type TimeRange = "24h" | "7d" | "30d" | "custom";

export interface FilterState {
  timeRange: TimeRange;
  customStart?: number;
  customEnd?: number;
  regionId: string | null;
}

export interface AnalyticsPanel {
  key: string;
  labelEn: string;
  labelHe: string;
}

export const ANALYTICS_PANELS: AnalyticsPanel[] = [
  { key: "shabbat_vs_weekday", labelEn: "Shabbat vs Weekday", labelHe: "שבת מול ימי חול" },
  { key: "hourly_histogram", labelEn: "Hourly Pattern", labelHe: "דפוס שעתי" },
  { key: "monthly_trends", labelEn: "Monthly Trends", labelHe: "מגמות חודשיות" },
  { key: "escalation_patterns", labelEn: "Escalation", labelHe: "הסלמה" },
  { key: "quiet_vs_active", labelEn: "Quiet Periods", labelHe: "תקופות שקט" },
  { key: "multi_city_correlation", labelEn: "Multi-Region", labelHe: "ריבוי אזורים" },
  { key: "time_between_alerts", labelEn: "Alert Gaps", labelHe: "מרווחים" },
  { key: "geographic_spread", labelEn: "Geo Spread", labelHe: "פיזור גיאוגרפי" },
  { key: "threat_distribution", labelEn: "Threat Levels", labelHe: "רמות איום" },
  { key: "morning_vs_evening", labelEn: "AM vs PM", labelHe: "בוקר מול ערב" },
  { key: "day_of_week", labelEn: "Day of Week", labelHe: "יום בשבוע" },
];
