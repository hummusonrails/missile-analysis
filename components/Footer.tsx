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
    <div className="flex items-center justify-between px-4 py-1.5 bg-bg-elevated border-t border-border flex-shrink-0 gap-3 overflow-x-auto scrollbar-hide">
      <div className="flex items-center gap-3 min-w-0">
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
      </div>
      <div className="flex items-center gap-2 min-w-0">
        {SISTER_SITES.map((site, i) => (
          <span key={site.href} className="flex items-center gap-2">
            {i > 0 && <span className="text-text-tertiary/20">·</span>}
            <a
              href={site.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[9px] font-mono text-text-tertiary/30 hover:text-text-secondary transition-colors whitespace-nowrap"
            >
              {site.label}
            </a>
          </span>
        ))}
        <span className="text-text-tertiary/20">·</span>
        <a
          href="https://buymeacoffee.com/bengreenberg"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[9px] font-mono text-text-tertiary/40 hover:text-text-secondary transition-colors whitespace-nowrap"
        >
          ☕
        </a>
      </div>
    </div>
  );
}
