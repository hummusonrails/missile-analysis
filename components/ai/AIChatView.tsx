"use client";

import { useEffect, useRef } from "react";
import { Sparkles } from "lucide-react";
import { useAI } from "./AIProvider";
import { useI18n } from "../../lib/i18n";

export function AIChatView() {
  const { messages, isGenerating } = useAI();
  const { lang } = useI18n();
  const isHe = lang === "he";
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages or streaming updates
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isGenerating]);

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 px-6 py-8 text-center">
        <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-bg-surface text-text-tertiary">
          <Sparkles size={22} />
        </div>
        <p className="text-text-tertiary text-sm max-w-xs leading-relaxed">
          {isHe
            ? "שאל שאלה על נתוני ההתרעות, מגמות, או דפוסים."
            : "Ask a question about alert data, trends, or patterns."}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 px-4 py-4 overflow-y-auto h-full">
      {messages.map((msg, i) => {
        const isUser = msg.role === "user";
        const isLastAssistant =
          !isUser && i === messages.length - 1;
        const showCursor = isLastAssistant && isGenerating;

        return (
          <div
            key={i}
            className={`flex ${isUser ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                isUser
                  ? "bg-accent-blue text-white ms-auto"
                  : "bg-bg-surface text-text-primary me-auto"
              }`}
            >
              <p className="whitespace-pre-wrap break-words">
                {msg.content}
                {showCursor && (
                  <span className="inline-block w-[8px] h-[14px] bg-text-secondary align-middle ms-0.5 animate-pulse rounded-sm" />
                )}
              </p>
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
