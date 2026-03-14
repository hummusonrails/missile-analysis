"use client";

import { useI18n } from "../lib/i18n";

export function LanguageToggle() {
  const { lang, setLang } = useI18n();

  const toggle = () => setLang(lang === "en" ? "he" : "en");

  return (
    <button
      onClick={toggle}
      className="text-[11px] text-text-tertiary font-medium px-2 py-1 rounded-md border border-border transition-colors hover:border-border-active"
    >
      {lang === "en" ? "EN · עב" : "עב · EN"}
    </button>
  );
}
