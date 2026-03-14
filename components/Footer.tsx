"use client";

import { useI18n } from "../lib/i18n";

const SISTER_SITES = [
  { href: "https://bestshowertime.com", nameEn: "Best Shower Time", nameHe: "הזמן הטוב למקלחת" },
  { href: "https://bestwalkingtime.com", nameEn: "Best Walking Time", nameHe: "הזמן הטוב להליכה" },
  { href: "https://bestsleepingtime.com", nameEn: "Best Sleeping Time", nameHe: "הזמן הטוב לשינה" },
];

export function Footer() {
  const { lang } = useI18n();

  return (
    <footer className="w-full py-8 px-4 mt-4 border-t border-border">
      <div className="flex flex-col items-center gap-2 text-center">
        <p className="font-mono text-[11px] text-text-tertiary/60">
          {lang === "he" ? "מקור הנתונים: פיקוד העורף" : "Data source: Pikud HaOref via Tzeva Adom"}
        </p>
        <p className="font-mono text-[11px] text-text-tertiary/40">
          {lang === "he" ? "מתעדכן כל 5 דקות" : "Auto-refreshes every 5 minutes"}
        </p>
        <p className="font-mono text-[11px] text-text-tertiary/60 mt-2">
          {lang === "he" ? "נבנה ע״י" : "Made by"}{" "}
          <a
            href="https://www.hummusonrails.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-text-secondary/50 hover:text-text-primary transition-colors duration-300 underline underline-offset-2"
          >
            Ben Greenberg
          </a>
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 mt-1">
          {SISTER_SITES.map((site) => (
            <a
              key={site.href}
              href={site.href}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[11px] text-text-tertiary/40 hover:text-text-secondary transition-colors duration-300 underline underline-offset-2 decoration-text-tertiary/20 hover:decoration-text-tertiary/50"
            >
              {lang === "he" ? site.nameHe : site.nameEn}
            </a>
          ))}
        </div>
        <a
          href="https://buymeacoffee.com/bengreenberg"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-lg bg-bg-surface hover:bg-bg-surface-hover border border-border font-mono text-[11px] text-text-tertiary hover:text-text-secondary transition-all duration-300"
        >
          <span>☕</span>
          <span>{lang === "he" ? "קנו לי קפה" : "Buy me a coffee"}</span>
        </a>
      </div>
    </footer>
  );
}
