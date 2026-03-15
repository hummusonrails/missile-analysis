"use client";

import { useState, type KeyboardEvent } from "react";
import { Send } from "lucide-react";
import { useI18n } from "../../lib/i18n";

interface AIPromptBarProps {
  onSubmit: (question: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function AIPromptBar({ onSubmit, disabled, placeholder }: AIPromptBarProps) {
  const { t } = useI18n();
  const [value, setValue] = useState("");

  const effectivePlaceholder = placeholder ?? t("ai.input.placeholder");

  function handleSubmit() {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSubmit(trimmed);
    setValue("");
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <div className="flex items-center gap-2 bg-bg-surface border border-border rounded-xl px-3 py-2">
      <input
        type="text"
        className="flex-1 bg-transparent text-text-primary placeholder:text-text-tertiary text-sm outline-none min-w-0"
        placeholder={effectivePlaceholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
      />
      <button
        type="button"
        onClick={handleSubmit}
        disabled={disabled || !value.trim()}
        className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-accent-blue text-white disabled:opacity-40 disabled:cursor-not-allowed transition-opacity hover:opacity-80"
        aria-label="Send"
      >
        <Send size={15} />
      </button>
    </div>
  );
}
