"use client";

import { useI18n } from "../lib/i18n";

const SISTER_SITES = [
  { href: "https://bestshowertime.com", label: "Best Shower Time" },
  { href: "https://bestwalkingtime.com", label: "Best Walking Time" },
  { href: "https://bestsleepingtime.com", label: "Best Sleeping Time" },
];

export function Footer() {
  const { lang } = useI18n();

  return (
    <div className="flex items-center px-4 py-1.5 bg-bg-elevated border-t border-border flex-shrink-0 gap-2 overflow-x-auto scrollbar-hide">
      <a
        href="https://www.hummusonrails.com/"
        target="_blank"
        rel="noopener noreferrer"
        className="text-[9px] font-mono text-text-tertiary/50 hover:text-text-secondary transition-colors whitespace-nowrap"
      >
        {lang === "he" ? "נבנה ע״י" : "by"}{" "}
        <span className="underline underline-offset-2">Ben Greenberg</span>
      </a>
      <span className="text-text-tertiary/20">·</span>
      <span className="text-[9px] font-mono text-text-tertiary/30 whitespace-nowrap">
        {lang === "he" ? "מקור: פיקוד העורף" : "src: Pikud HaOref"}
      </span>
      <span className="text-text-tertiary/20">·</span>
      {SISTER_SITES.map((site) => (
        <span key={site.href} className="contents">
          <a
            href={site.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[9px] font-mono text-text-tertiary/30 hover:text-text-secondary transition-colors whitespace-nowrap"
          >
            {site.label}
          </a>
          <span className="text-text-tertiary/20">·</span>
        </span>
      ))}
      <a
        href="https://buymeacoffee.com/bengreenberg"
        target="_blank"
        rel="noopener noreferrer"
        className="text-[11px] whitespace-nowrap hover:opacity-80 transition-opacity"
      >
        ☕
      </a>
    </div>
  );
}
