"use client";

import { Sparkles, Shield, Zap } from "lucide-react";
import { useAI } from "./AIProvider";
import { useI18n } from "../../lib/i18n";

export function AIConsentScreen() {
  const { engine, engineStatus, initEngine } = useAI();
  const { lang } = useI18n();
  const isHe = lang === "he";

  const isDownloading = engineStatus === "downloading";
  const isError = engineStatus === "error";
  const progress = engine?.downloadProgress ?? 0;
  const errorMessage = engine?.error;

  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 px-6 py-8 text-center">
      <div className="flex flex-col items-center gap-3">
        <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-accent-blue/10 text-accent-blue">
          <Sparkles size={28} />
        </div>
        <h2 className="text-text-primary font-semibold text-lg">
          {isHe ? "שאלו שאלות על הנתונים" : "Ask Questions About the Data"}
        </h2>
      </div>

      <p className="max-w-xs text-text-secondary text-[14px] leading-relaxed">
        {isHe
          ? "קבלו תשובות מיידיות על דפוסי התרעות, מגמות ותובנות — ישירות מהמכשיר שלכם."
          : "Get instant answers about alert patterns, trends, and insights — right from your device."}
      </p>

      <div className="flex flex-col gap-3 max-w-xs w-full text-start">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-accent-green/10 flex items-center justify-center flex-shrink-0">
            <Shield size={16} className="text-accent-green" />
          </div>
          <span className="text-[12px] text-text-secondary">
            {isHe
              ? "הנתונים שלכם נשארים על המכשיר — שום דבר לא נשלח לשרת"
              : "Your data stays on your device — nothing is sent to a server"}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-accent-amber/10 flex items-center justify-center flex-shrink-0">
            <Zap size={16} className="text-accent-amber" />
          </div>
          <span className="text-[12px] text-text-secondary">
            {isHe
              ? "נדרשת הורדה חד-פעמית — לאחר מכן עובד מיד"
              : "One-time setup required — works instantly after that"}
          </span>
        </div>
      </div>

      {isError && (
        <div className="w-full max-w-xs bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-400">
          <p className="font-medium mb-1">{isHe ? "שגיאה" : "Error"}</p>
          <p className="text-xs break-words">{errorMessage}</p>
        </div>
      )}

      {isDownloading && (
        <div className="w-full max-w-xs space-y-2">
          <div className="flex justify-between text-xs text-text-tertiary">
            <span>{isHe ? "מתקין..." : "Setting up..."}</span>
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
          className="px-6 py-3 rounded-xl bg-accent-blue text-white text-[14px] font-medium
            hover:opacity-90 transition-opacity active:scale-95"
        >
          {isError
            ? (isHe ? "נסה שוב" : "Try Again")
            : (isHe ? "הפעל" : "Enable")}
        </button>
      )}
    </div>
  );
}
