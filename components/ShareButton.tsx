"use client";

import { useState } from "react";
import { useI18n } from "../lib/i18n";

export function ShareButton() {
  const { t } = useI18n();
  const [showToast, setShowToast] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(window.location.href);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = window.location.href;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2000);
  }

  return (
    <div className="relative">
      <button
        onClick={handleCopy}
        className="p-1.5 rounded-lg hover:bg-bg-surface transition-colors"
        aria-label="Share link"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-secondary">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
      </button>

      {showToast && (
        <div className="absolute right-0 top-full mt-2 px-3 py-1.5 rounded-lg bg-accent-green/20 border border-accent-green/30 text-accent-green text-[10px] font-medium whitespace-nowrap z-50">
          {t("share.copied")}
        </div>
      )}
    </div>
  );
}
