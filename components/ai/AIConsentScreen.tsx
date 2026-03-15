"use client";

import { Sparkles } from "lucide-react";
import { useAI } from "./AIProvider";
import { useI18n } from "../../lib/i18n";

export function AIConsentScreen() {
  const { engine, engineStatus, initEngine } = useAI();
  const { lang } = useI18n();
  const isHe = lang === "he";

  const isDownloading = engineStatus === "downloading";
  const isError = engineStatus === "error";
  const progress = engine?.downloadProgress ?? 0;
  const downloadSize = engine?.downloadSize;
  const errorMessage = engine?.error;
  const engineName = engine?.name ?? (isHe ? "מודל שפה" : "Language Model");

  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 px-6 py-8 text-center">
      <div className="flex flex-col items-center gap-3">
        <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-accent-blue/10 text-accent-blue">
          <Sparkles size={28} />
        </div>
        <h2 className="text-text-primary font-semibold text-lg">
          {isHe ? "עוזר AI" : "AI Assistant"}
        </h2>
      </div>

      <div className="max-w-sm text-text-secondary text-sm leading-relaxed space-y-2">
        <p>
          {isHe
            ? `כדי לאפשר את עוזר ה-AI, נדרש להוריד מודל שפה (${engineName}) ישירות למכשיר שלך.`
            : `To enable the AI assistant, a language model (${engineName}) needs to be downloaded directly to your device.`}
        </p>
        {downloadSize && (
          <p className="text-text-tertiary text-xs font-mono">
            {isHe ? `גודל ההורדה: ${downloadSize}` : `Download size: ${downloadSize}`}
          </p>
        )}
        <p className="text-text-tertiary text-xs">
          {isHe
            ? "הנתונים נשארים על המכשיר שלך ולא נשלחים לשרת."
            : "Data stays on your device and is never sent to a server."}
        </p>
      </div>

      {isError && (
        <div className="w-full max-w-sm bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-400">
          <p className="font-medium mb-1">{isHe ? "שגיאה" : "Error"}</p>
          <p className="text-xs font-mono break-words">{errorMessage}</p>
        </div>
      )}

      {isDownloading && (
        <div className="w-full max-w-sm space-y-2">
          <div className="flex justify-between text-xs text-text-tertiary">
            <span>{isHe ? "מוריד..." : "Downloading..."}</span>
            <span className="font-mono">{progress}%</span>
          </div>
          <div className="w-full bg-bg-primary rounded-full h-2 overflow-hidden">
            <div
              className="h-full bg-accent-blue rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {!isDownloading && (
        <button
          type="button"
          onClick={() => initEngine()}
          className="px-5 py-2.5 rounded-xl bg-accent-blue text-white text-sm font-medium
            hover:opacity-90 transition-opacity active:scale-95"
        >
          {isError
            ? (isHe ? "נסה שוב" : "Retry")
            : (isHe ? "הורד והפעל" : "Download & Enable")}
        </button>
      )}
    </div>
  );
}
