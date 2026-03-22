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
    <div className="flex flex-col items-center gap-1 px-4 py-2 bg-bg-elevated border-t border-border flex-shrink-0">
      <div className="flex items-center gap-2 flex-wrap justify-center">
        <a
          href="https://www.hummusonrails.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[9px] font-mono text-text-tertiary hover:text-text-secondary transition-colors"
        >
          {lang === "he" ? "נבנה ע״י" : "by"}{" "}
          <span className="underline underline-offset-2">Ben Greenberg</span>
        </a>
        <span className="text-text-tertiary/30">·</span>
        <span className="text-[9px] font-mono text-text-tertiary/50">
          {lang === "he" ? "מקור: פיקוד העורף" : "src: Pikud HaOref"}
        </span>
        <span className="text-text-tertiary/30">·</span>
        <a
          href="/developer"
          className="text-[9px] font-mono text-text-tertiary/50 hover:text-text-secondary transition-colors"
        >
          Developers: Access the SirenWise API →
        </a>
        <span className="text-text-tertiary/30">·</span>
        {SISTER_SITES.map((site, i) => (
          <span key={site.href} className="contents">
            {i > 0 && <span className="text-text-tertiary/30">·</span>}
            <a
              href={site.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[9px] font-mono text-text-tertiary/50 hover:text-text-secondary transition-colors"
            >
              {site.label}
            </a>
          </span>
        ))}
      </div>
      <a
        href="https://buymeacoffee.com/bengreenberg"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 text-[10px] font-mono text-accent-amber/70 hover:text-accent-amber transition-colors"
      >
        <span>☕</span>
        <span>{lang === "he" ? "תמכו בפרויקטים האלה עם קפה" : "Support these projects with a coffee"}</span>
      </a>
    </div>
  );
}
