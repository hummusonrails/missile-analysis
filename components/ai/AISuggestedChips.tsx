"use client";

import { useI18n } from "../../lib/i18n";

const SUGGESTIONS = [
  { en: "Summarize the current situation", he: "סכם את המצב הנוכחי" },
  { en: "Compare Shabbat vs weekday", he: "השווה שבת מול ימי חול" },
  { en: "Which region is most active?", he: "איזה אזור הכי פעיל?" },
  { en: "Is there an escalation trend?", he: "האם יש מגמת הסלמה?" },
  { en: "What time of day is safest?", he: "באיזו שעה הכי בטוח?" },
];

interface AISuggestedChipsProps {
  onSelect: (question: string) => void;
  disabled?: boolean;
}

export function AISuggestedChips({ onSelect, disabled }: AISuggestedChipsProps) {
  const { lang } = useI18n();
  const isHe = lang === "he";

  return (
    <div className="flex flex-wrap gap-2 justify-center">
      {SUGGESTIONS.map((s) => {
        const label = isHe ? s.he : s.en;
        return (
          <button
            key={s.en}
            type="button"
            onClick={() => onSelect(label)}
            disabled={disabled}
            className="px-3 py-1.5 rounded-full border border-accent-blue text-accent-blue text-xs font-medium
              hover:bg-accent-blue hover:text-white transition-colors
              disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
