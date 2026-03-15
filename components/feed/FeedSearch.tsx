"use client";

import { useI18n } from "../../lib/i18n";

interface FeedSearchProps {
  value: string;
  onChange: (value: string) => void;
}

export function FeedSearch({ value, onChange }: FeedSearchProps) {
  const { t } = useI18n();
  return (
    <div className="px-4 pb-2.5">
      <div className="bg-bg-surface border border-border rounded-[10px] px-3.5 py-2.5 flex items-center gap-2">
        {/* Magnifying glass icon */}
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          className="flex-shrink-0 text-text-tertiary"
        >
          <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M9.5 9.5L12.5 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t("feed.search")}
          className="bg-transparent text-[13px] text-text-primary placeholder:text-text-tertiary outline-none w-full"
        />
        {value && (
          <button
            onClick={() => onChange("")}
            className="flex-shrink-0 text-text-tertiary hover:text-text-secondary"
            aria-label="Clear search"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M1 1L11 11M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
