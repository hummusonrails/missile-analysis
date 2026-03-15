"use client";

import { useEffect, useRef } from "react";
import { useI18n } from "../../lib/i18n";
import type { Methodology } from "../../lib/methodology";

interface MethodologyModalProps {
  title: string;
  methodology: Methodology;
  onClose: () => void;
}

function renderMarkdown(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '<strong class="text-text-primary font-semibold">$1</strong>')
    .replace(/\n\n/g, '</p><p class="mt-2">')
    .replace(/\n- /g, '</p><p class="mt-1 ps-3">• ')
    .replace(/\n/g, "<br/>");
}

export function MethodologyModal({ title, methodology, onClose }: MethodologyModalProps) {
  const { lang } = useI18n();
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === overlayRef.current) onClose();
  }

  const content = lang === "he" ? methodology.he : methodology.en;

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div className="bg-bg-elevated border border-border-active rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-bg-elevated rounded-t-2xl">
          <div>
            <div className="text-[9px] uppercase tracking-widest text-accent-blue font-mono font-medium mb-0.5">
              {lang === "he" ? "מתודולוגיה" : "Methodology"}
            </div>
            <h2 className="text-[15px] font-medium text-text-primary">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-bg-surface hover:bg-bg-surface-hover border border-border text-text-tertiary hover:text-text-secondary transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div
          className="px-5 py-4 text-[13px] text-text-secondary leading-relaxed"
          dir={lang === "he" ? "rtl" : "ltr"}
          dangerouslySetInnerHTML={{ __html: `<p>${renderMarkdown(content)}</p>` }}
        />
      </div>
    </div>
  );
}
