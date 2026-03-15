"use client";

import { useEffect, useRef, useMemo } from "react";
import type { Alert, CityCoord, FilterState } from "../../lib/types";
import { useAI } from "./AIProvider";
import { useI18n } from "../../lib/i18n";
import { useClientAnalytics } from "../../lib/hooks/use-client-analytics";
import { buildSystemPrompt, buildCompactSystemPrompt } from "../../lib/ai-context";
import { AIConsentScreen } from "./AIConsentScreen";
import { AIChatView } from "./AIChatView";
import { AIPromptBar } from "./AIPromptBar";
import { AISuggestedChips } from "./AISuggestedChips";

interface AITabProps {
  alerts: Alert[];
  cityCoords: Map<string, CityCoord>;
  filter: FilterState;
  initialQuestion?: string;
}

export function AITab({ alerts, cityCoords, filter, initialQuestion }: AITabProps) {
  const { engine, engineStatus, sendMessage, isGenerating } = useAI();
  const { lang, t } = useI18n();
  const isHe = lang === "he";
  const analytics = useClientAnalytics(alerts, cityCoords);
  const initialFiredRef = useRef(false);

  const isReady = engineStatus === "ready";
  const needsConsent =
    engineStatus === "needs-download" ||
    engineStatus === "downloading" ||
    engineStatus === "error";

  const useCompact = engine?.id === "wllama";
  const systemPrompt = useMemo(() => {
    if (!analytics) return "";
    return useCompact
      ? buildCompactSystemPrompt(analytics, filter, lang)
      : buildSystemPrompt(analytics, filter, lang);
  }, [analytics, filter, lang, useCompact]);

  async function handleAsk(question: string) {
    if (!analytics || !isReady) return;
    await sendMessage(systemPrompt, question);
  }

  // Fire initialQuestion once on mount when engine is ready
  useEffect(() => {
    if (!initialQuestion || initialFiredRef.current || !isReady || !analytics) return;
    initialFiredRef.current = true;
    sendMessage(systemPrompt, initialQuestion);
  }, [initialQuestion, isReady, analytics, sendMessage, systemPrompt]);

  // Show loading state while detecting engine
  if (engineStatus === null) {
    return (
      <div className="flex items-center justify-center h-full text-text-tertiary text-sm">
        {isHe ? "מזהה יכולות AI..." : "Detecting AI capabilities..."}
      </div>
    );
  }

  // Show unavailable state
  if (engineStatus === "unavailable") {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 px-6 py-8 text-center">
        <p className="text-text-secondary text-sm">
          {isHe
            ? "AI אינו זמין בדפדפן זה."
            : "AI is not available in this browser."}
        </p>
        <p className="text-text-tertiary text-xs max-w-xs">
          {isHe
            ? "נסה Chrome עם תמיכה ב-WebGPU, או דפדפן עם WebAssembly SIMD."
            : "Try Chrome with WebGPU support, or a browser with WebAssembly SIMD."}
        </p>
      </div>
    );
  }

  if (needsConsent) {
    return <AIConsentScreen />;
  }

  const engineName = (() => {
    // engineStatus is "ready" — we can read from useAI engine
    return null; // will be read below via engine
  })();
  void engineName;

  return (
    <div className="flex flex-col h-full">
      {/* Prompt bar at top */}
      <div className="px-4 pt-4 pb-2 flex-shrink-0">
        <AIPromptBar
          onSubmit={handleAsk}
          disabled={isGenerating || !analytics}
          placeholder={
            !analytics
              ? (isHe ? "אין נתונים לניתוח" : "No data to analyze")
              : undefined
          }
        />
      </div>

      {/* Chat view in middle - scrollable */}
      <div className="flex-1 min-h-0">
        <AIChatView />
      </div>

      {/* Suggested chips at bottom */}
      <div className="px-4 pt-2 pb-3 flex-shrink-0">
        <AISuggestedChips
          onSelect={handleAsk}
          disabled={isGenerating || !analytics}
        />
      </div>

      {/* Engine name at very bottom */}
      <EngineNameFooter isHe={isHe} />
    </div>
  );
}

function EngineNameFooter({ isHe }: { isHe: boolean }) {
  const { engine } = useAI();
  if (!engine) return null;
  return (
    <div className="px-4 pb-3 flex-shrink-0 text-center">
      <span className="text-text-tertiary text-[10px] font-mono">
        {isHe ? `מנוע: ${engine.name}` : `Engine: ${engine.name}`}
      </span>
    </div>
  );
}
