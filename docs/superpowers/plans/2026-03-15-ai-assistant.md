# AI Assistant Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a client-side AI assistant that runs entirely in the browser, using a tiered engine detection system (Chrome Built-in AI → WebLLM → Wllama) to narrate and synthesize alert analytics in EN/HE.

**Architecture:** A unified `AIEngine` interface with three implementations. An `AIProvider` context detects the best engine on load. The AI tab appears in the bottom nav only when an engine is available. The prompt bar is also embedded at the top of the Analytics tab for discoverability. All engines receive the same compact analytics JSON (~800 tokens) as context.

**Tech Stack:** Chrome Prompt API (`LanguageModel`), `@mlc-ai/web-llm` (WebGPU), `@wllama/wllama` (WASM), `lucide-react` (icons)

**Spec:** `docs/superpowers/specs/2026-03-15-ai-assistant-design.md`

**Pre-existing dependency:** `lib/hooks/use-client-analytics.ts` — the `useClientAnalytics` hook already exists and returns the analytics shape used by `buildSystemPrompt`. The `ClientAnalytics` interface in `lib/ai-context.ts` must match its return type.

---

## Chunk 1: Engine Abstraction & Detection

### Task 1: Install Dependencies & Create Engine Types

**Files:**
- Create: `components/ai/engines/types.ts`

- [ ] **Step 1: Install dependencies**

```bash
npm install @mlc-ai/web-llm @wllama/wllama lucide-react
```

- [ ] **Step 2: Create `components/ai/engines/types.ts`**

```typescript
export type EngineId = "chrome-ai" | "webllm" | "wllama";

export type EngineStatus =
  | "ready"
  | "needs-download"
  | "downloading"
  | "error"
  | "unavailable";

export interface AIEngine {
  id: EngineId;
  name: string;
  status: EngineStatus;
  downloadSize?: string;
  downloadProgress?: number;
  error?: string;
  init(): Promise<void>;
  prompt(
    system: string,
    user: string,
    signal?: AbortSignal
  ): AsyncIterable<string>;
  destroy(): void;
}

export interface AIMessage {
  role: "user" | "assistant";
  content: string;
}
```

- [ ] **Step 3: Commit**

```bash
git add components/ai/engines/types.ts package.json package-lock.json
git commit -m "feat: add AI engine types and install dependencies"
```

---

### Task 2: Chrome Built-in AI Engine

**Files:**
- Create: `components/ai/engines/chrome-ai.ts`

- [ ] **Step 1: Create `components/ai/engines/chrome-ai.ts`**

```typescript
import type { AIEngine } from "./types";

export class ChromeAIEngine implements AIEngine {
  id = "chrome-ai" as const;
  name = "Chrome Built-in AI";
  status: AIEngine["status"] = "unavailable";
  private session: any = null;

  static async detect(): Promise<boolean> {
    try {
      if (typeof globalThis.LanguageModel === "undefined") return false;
      const availability = await (globalThis as any).LanguageModel.availability();
      return availability === "readily" || availability === "after-download";
    } catch {
      return false;
    }
  }

  async init(): Promise<void> {
    try {
      this.status = "downloading"; // may trigger model download
      this.session = await (globalThis as any).LanguageModel.create();
      this.status = "ready";
    } catch (err) {
      this.status = "error";
      this.error = err instanceof Error ? err.message : "Failed to initialize Chrome AI";
      throw err;
    }
  }

  async *prompt(system: string, user: string, signal?: AbortSignal): AsyncIterable<string> {
    if (!this.session) throw new Error("Engine not initialized");

    // Create a new session with system prompt for each question
    const session = await (globalThis as any).LanguageModel.create({
      systemPrompt: system,
    });

    try {
      const stream = session.promptStreaming(user, { signal });
      let previousLength = 0;
      for await (const chunk of stream) {
        // Chrome AI streams the full text so far, not deltas
        const newText = chunk.slice(previousLength);
        previousLength = chunk.length;
        if (newText) yield newText;
      }
    } finally {
      session.destroy();
    }
  }

  error?: string;

  destroy(): void {
    if (this.session) {
      this.session.destroy();
      this.session = null;
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add components/ai/engines/chrome-ai.ts
git commit -m "feat: add Chrome Built-in AI engine adapter"
```

---

### Task 3: WebLLM Engine

**Files:**
- Create: `components/ai/engines/webllm.ts`

- [ ] **Step 1: Create `components/ai/engines/webllm.ts`**

```typescript
import type { AIEngine } from "./types";

const MODEL_ID = "Qwen2-0.5B-Instruct-q4f16_1-MLC";
const DOWNLOAD_SIZE = "350MB";

export class WebLLMEngine implements AIEngine {
  id = "webllm" as const;
  name = "WebLLM";
  status: AIEngine["status"] = "unavailable";
  downloadSize = DOWNLOAD_SIZE;
  downloadProgress?: number;
  error?: string;
  private engine: any = null;

  static async detect(): Promise<boolean> {
    try {
      return typeof navigator !== "undefined" && "gpu" in navigator;
    } catch {
      return false;
    }
  }

  async init(): Promise<void> {
    try {
      this.status = "downloading";
      const { CreateMLCEngine } = await import("@mlc-ai/web-llm");

      this.engine = await CreateMLCEngine(MODEL_ID, {
        initProgressCallback: (progress: { progress: number; text: string }) => {
          this.downloadProgress = Math.round(progress.progress * 100);
        },
      });

      this.status = "ready";
      this.downloadProgress = 100;
    } catch (err) {
      this.status = "error";
      this.error = err instanceof Error ? err.message : "Failed to initialize WebLLM";
      throw err;
    }
  }

  async *prompt(system: string, user: string, signal?: AbortSignal): AsyncIterable<string> {
    if (!this.engine) throw new Error("Engine not initialized");

    const response = await this.engine.chat.completions.create({
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      stream: true,
      temperature: 0.3,
      max_tokens: 1024,
    });

    for await (const chunk of response) {
      if (signal?.aborted) break;
      const delta = chunk.choices?.[0]?.delta?.content;
      if (delta) yield delta;
    }
  }

  destroy(): void {
    // WebLLM engine doesn't have a destroy method — just null out
    this.engine = null;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add components/ai/engines/webllm.ts
git commit -m "feat: add WebLLM engine adapter (WebGPU)"
```

---

### Task 4: Wllama Engine

**Files:**
- Create: `components/ai/engines/wllama.ts`

- [ ] **Step 1: Create `components/ai/engines/wllama.ts`**

The Wllama engine uses llama.cpp compiled to WASM. It loads a GGUF model file from a CDN (Hugging Face).

```typescript
import type { AIEngine } from "./types";

const MODEL_URL =
  "https://huggingface.co/HuggingFaceTB/SmolLM-135M-Instruct-GGUF/resolve/main/smollm-135m-instruct.Q4_K_M.gguf";
const DOWNLOAD_SIZE = "80MB";

export class WllamaEngine implements AIEngine {
  id = "wllama" as const;
  name = "Wllama";
  status: AIEngine["status"] = "unavailable";
  downloadSize = DOWNLOAD_SIZE;
  downloadProgress?: number;
  error?: string;
  private wllama: any = null;

  static async detect(): Promise<boolean> {
    try {
      // Check for WASM + SIMD support
      const simdTest = new Uint8Array([
        0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10,
        10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11,
      ]);
      return WebAssembly.validate(simdTest);
    } catch {
      return false;
    }
  }

  async init(): Promise<void> {
    try {
      this.status = "downloading";
      const { Wllama } = await import("@wllama/wllama");

      this.wllama = new Wllama({
        "single-thread/wllama.js":
          "https://cdn.jsdelivr.net/npm/@wllama/wllama@latest/esm/single-thread/wllama.js",
        "single-thread/wllama.wasm":
          "https://cdn.jsdelivr.net/npm/@wllama/wllama@latest/esm/single-thread/wllama.wasm",
        "multi-thread/wllama.js":
          "https://cdn.jsdelivr.net/npm/@wllama/wllama@latest/esm/multi-thread/wllama.js",
        "multi-thread/wllama.wasm":
          "https://cdn.jsdelivr.net/npm/@wllama/wllama@latest/esm/multi-thread/wllama.wasm",
        "multi-thread/wllama.worker.mjs":
          "https://cdn.jsdelivr.net/npm/@wllama/wllama@latest/esm/multi-thread/wllama.worker.mjs",
      });

      await this.wllama.loadModelFromUrl(MODEL_URL, {
        progressCallback: ({ loaded, total }: { loaded: number; total: number }) => {
          this.downloadProgress = total > 0 ? Math.round((loaded / total) * 100) : 0;
        },
      });

      this.status = "ready";
      this.downloadProgress = 100;
    } catch (err) {
      this.status = "error";
      this.error = err instanceof Error ? err.message : "Failed to initialize Wllama";
      throw err;
    }
  }

  async *prompt(system: string, user: string, signal?: AbortSignal): AsyncIterable<string> {
    if (!this.wllama) throw new Error("Engine not initialized");

    // Format as a simple instruction prompt
    const fullPrompt = `<|im_start|>system\n${system}<|im_end|>\n<|im_start|>user\n${user}<|im_end|>\n<|im_start|>assistant\n`;

    let buffer = "";
    await this.wllama.createCompletion(fullPrompt, {
      nPredict: 512,
      sampling: { temp: 0.3 },
      onNewToken: (_token: number, _piece: Uint8Array, text: string) => {
        buffer = text;
      },
    });

    // Wllama doesn't have true streaming via async iterator — yield the full result
    // For a better UX, we simulate streaming by yielding word by word
    const words = buffer.split(/(\s+)/);
    for (const word of words) {
      if (signal?.aborted) break;
      yield word;
      await new Promise((r) => setTimeout(r, 20));
    }
  }

  destroy(): void {
    if (this.wllama) {
      this.wllama.exit();
      this.wllama = null;
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add components/ai/engines/wllama.ts
git commit -m "feat: add Wllama engine adapter (WASM/CPU)"
```

---

### Task 5: AI Context Builder

**Files:**
- Create: `lib/ai-context.ts`

- [ ] **Step 1: Create `lib/ai-context.ts`**

```typescript
import type { FilterState } from "./types";

interface ClientAnalytics {
  totalAlerts: number;
  shabbat_vs_weekday: { multiplier: number; avgPerShabbatDay: number; avgPerWeekday: number; shabbatCount: number; weekdayCount: number };
  hourly_histogram: { peakHour: number; quietestHour: number };
  morning_vs_evening: { eveningPercent: number; morningCount: number; eveningCount: number; peakHour: number; quietestHour: number };
  day_of_week: { busiestDay: string; busiestCount: number };
  threat_distribution: { counts: Record<number, number>; mostCommonLevel: number };
  regional_heatmap: { regions: Record<string, number> };
  time_between_alerts: { medianGapMinutes: number };
  quiet_vs_active: { longestQuietHours: number; longestActiveHours: number };
  monthly_trends: { months: { month: string; count: number }[]; monthOverMonthDelta: number };
  escalation_patterns: { currentRate: number; baseline: number; multiplier: number };
  multi_city_correlation: { multiRegionCount: number; avgRegions: number; totalGroups: number };
  geographic_spread: { avgRegionsPerGroup: number; totalGroups: number };
}

const THREAT_NAMES: Record<number, string> = {
  0: "Rockets",
  2: "Infiltration",
  3: "Earthquake",
  5: "Hostile Aircraft",
  7: "Non-conventional Missile",
  8: "General Alert",
};

export function buildSystemPrompt(
  analytics: ClientAnalytics,
  filter: FilterState,
  lang: string
): string {
  const regionLabel = filter.regionId ?? "all regions";
  const rangeLabel = filter.timeRange === "custom" ? "custom range" : filter.timeRange;

  // Build threat distribution string
  const threatEntries = Object.entries(analytics.threat_distribution.counts)
    .filter(([, count]) => count > 0)
    .map(([code, count]) => `${THREAT_NAMES[Number(code)] ?? `Type ${code}`}: ${count}`)
    .join(", ");

  // Build top regions string
  const topRegions = Object.entries(analytics.regional_heatmap.regions)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([region, count]) => `${region}: ${count}`)
    .join(", ");

  // Build monthly trend string
  const monthlyStr = analytics.monthly_trends.months
    .map((m) => `${m.month}: ${m.count}`)
    .join(", ");

  const prompt = `You are an analyst for SirenWise, an Israel missile alert intelligence dashboard.
The user is viewing data for ${rangeLabel} in ${regionLabel}.

Current analytics summary (${analytics.totalAlerts} total alerts):

SHABBAT VS WEEKDAY: ${analytics.shabbat_vs_weekday.multiplier}x multiplier. Avg ${analytics.shabbat_vs_weekday.avgPerShabbatDay} alerts/Shabbat day vs ${analytics.shabbat_vs_weekday.avgPerWeekday}/weekday. Total: ${analytics.shabbat_vs_weekday.shabbatCount} Shabbat, ${analytics.shabbat_vs_weekday.weekdayCount} weekday.

HOURLY PATTERN: Peak hour ${analytics.hourly_histogram.peakHour}:00, quietest ${analytics.hourly_histogram.quietestHour}:00. Evening alerts: ${analytics.morning_vs_evening.eveningPercent}% (${analytics.morning_vs_evening.eveningCount} PM vs ${analytics.morning_vs_evening.morningCount} AM).

DAY OF WEEK: Busiest day is ${analytics.day_of_week.busiestDay} (avg ${analytics.day_of_week.busiestCount} alerts).

ALERT TYPES: ${threatEntries}.

TOP REGIONS: ${topRegions}.

TIME BETWEEN EVENTS: Median gap ${analytics.time_between_alerts.medianGapMinutes} minutes between distinct alert events.

QUIET/ACTIVE PERIODS: Longest quiet stretch ${analytics.quiet_vs_active.longestQuietHours}h. Longest sustained barrage ${analytics.quiet_vs_active.longestActiveHours}h.

MONTHLY TRENDS: ${monthlyStr}. Month-over-month change: ${analytics.monthly_trends.monthOverMonthDelta}%.

ESCALATION: ${analytics.escalation_patterns.currentRate} alerts in the last hour vs ${analytics.escalation_patterns.baseline}/hr average (${analytics.escalation_patterns.multiplier}x).

MULTI-REGION: ${analytics.multi_city_correlation.multiRegionCount} events hit 3+ regions. Avg spread: ${analytics.geographic_spread.avgRegionsPerGroup} regions per event across ${analytics.geographic_spread.totalGroups} total events.

Answer in ${lang === "he" ? "Hebrew" : "English"}. Be concise and specific with numbers. Reference the data above. Do not invent data not provided.`;

  return prompt;
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/ai-context.ts
git commit -m "feat: add AI context builder for system prompts"
```

---

## Chunk 2: AI Provider & Detection

### Task 6: AI Provider Context

**Files:**
- Create: `components/ai/AIProvider.tsx`

- [ ] **Step 1: Create `components/ai/AIProvider.tsx`**

This is the React context provider that detects the best engine, manages its lifecycle, and exposes it to the component tree.

```typescript
"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import type { AIEngine, AIMessage } from "./engines/types";
import { ChromeAIEngine } from "./engines/chrome-ai";
import { WebLLMEngine } from "./engines/webllm";
import { WllamaEngine } from "./engines/wllama";

interface AIContextType {
  engine: AIEngine | null;
  available: boolean;
  messages: AIMessage[];
  isGenerating: boolean;
  sendMessage: (system: string, userMessage: string) => Promise<void>;
  clearMessages: () => void;
  initEngine: () => Promise<void>;
}

const AIContext = createContext<AIContextType>({
  engine: null,
  available: false,
  messages: [],
  isGenerating: false,
  sendMessage: async () => {},
  clearMessages: () => {},
  initEngine: async () => {},
});

export function useAI() {
  return useContext(AIContext);
}

export function AIProvider({ children }: { children: ReactNode }) {
  const [engine, setEngine] = useState<AIEngine | null>(null);
  const [, setEngineStatus] = useState<string>(""); // triggers re-render when engine.status changes
  const [available, setAvailable] = useState(false);
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Detect best engine on mount
  useEffect(() => {
    async function detect() {
      // Tier 1: Chrome Built-in AI
      if (await ChromeAIEngine.detect()) {
        const eng = new ChromeAIEngine();
        eng.status = "ready"; // No download needed
        setEngine(eng);
        setAvailable(true);
        return;
      }

      // Tier 2: WebLLM (WebGPU)
      if (await WebLLMEngine.detect()) {
        const eng = new WebLLMEngine();
        eng.status = "needs-download";
        setEngine(eng);
        setAvailable(true);
        return;
      }

      // Tier 3: Wllama (WASM)
      if (await WllamaEngine.detect()) {
        const eng = new WllamaEngine();
        eng.status = "needs-download";
        setEngine(eng);
        setAvailable(true);
        return;
      }

      // No engine available
      setAvailable(false);
    }

    detect();
  }, []);

  const initEngine = useCallback(async () => {
    if (!engine || engine.status === "ready") return;
    try {
      await engine.init();
      setEngineStatus(engine.status); // Trigger re-render
    } catch {
      setEngineStatus(engine.status);
    }
  }, [engine]);

  const sendMessage = useCallback(
    async (system: string, userMessage: string) => {
      if (!engine || engine.status !== "ready") return;

      setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
      setIsGenerating(true);

      const abort = new AbortController();
      abortRef.current = abort;

      try {
        let assistantContent = "";
        setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

        for await (const token of engine.prompt(system, userMessage, abort.signal)) {
          if (abort.signal.aborted) break;
          assistantContent += token;
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              role: "assistant",
              content: assistantContent,
            };
            return updated;
          });
        }
      } catch (err) {
        if (!abort.signal.aborted) {
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              role: "assistant",
              content: "Something went wrong. Please try again.",
            };
            return updated;
          });
        }
      } finally {
        setIsGenerating(false);
        abortRef.current = null;
      }
    },
    [engine]
  );

  const clearMessages = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    setMessages([]);
  }, []);

  return (
    <AIContext.Provider
      value={{ engine, available, messages, isGenerating, sendMessage, clearMessages, initEngine }}
    >
      {children}
    </AIContext.Provider>
  );
}
```

- [ ] **Step 2: Wrap app in AIProvider**

In `app/layout.tsx`, add `AIProvider` wrapping children inside `I18nProvider`. The current code is:

```tsx
<I18nProvider>{children}</I18nProvider>
```

Change to:

```tsx
import { AIProvider } from "../components/ai/AIProvider";

// ...

<I18nProvider>
  <AIProvider>{children}</AIProvider>
</I18nProvider>
```

`AIProvider` must be inside `I18nProvider` (it doesn't use i18n itself, but its children do).

- [ ] **Step 3: Commit**

```bash
git add components/ai/AIProvider.tsx app/layout.tsx
git commit -m "feat: add AIProvider with tiered engine detection and message state"
```

---

## Chunk 3: UI Components

### Task 7: AI Prompt Bar

**Files:**
- Create: `components/ai/AIPromptBar.tsx`

- [ ] **Step 1: Create `components/ai/AIPromptBar.tsx`**

Reusable input bar with send button. Used in both the AI tab and the Analytics tab.

```tsx
"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { useI18n } from "../../lib/i18n";

interface AIPromptBarProps {
  onSubmit: (question: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function AIPromptBar({ onSubmit, disabled, placeholder }: AIPromptBarProps) {
  const [input, setInput] = useState("");
  const { t } = useI18n();

  function handleSubmit() {
    const trimmed = input.trim();
    if (!trimmed || disabled) return;
    onSubmit(trimmed);
    setInput("");
  }

  return (
    <div className="flex items-center gap-2 px-4 py-2.5">
      <div className="flex-1 flex items-center gap-2 bg-bg-surface border border-border rounded-xl px-3.5 py-2.5">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder={placeholder ?? t("ai.input.placeholder")}
          disabled={disabled}
          className="flex-1 bg-transparent text-[13px] text-text-primary placeholder:text-text-tertiary outline-none"
        />
        <button
          onClick={handleSubmit}
          disabled={disabled || !input.trim()}
          className="w-7 h-7 flex items-center justify-center rounded-lg bg-accent-blue text-white disabled:opacity-30 transition-opacity"
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/ai/AIPromptBar.tsx
git commit -m "feat: add AIPromptBar component"
```

---

### Task 8: Suggested Prompt Chips

**Files:**
- Create: `components/ai/AISuggestedChips.tsx`

- [ ] **Step 1: Create `components/ai/AISuggestedChips.tsx`**

```tsx
"use client";

import { useI18n } from "../../lib/i18n";

interface AISuggestedChipsProps {
  onSelect: (question: string) => void;
  disabled?: boolean;
}

const SUGGESTIONS = [
  { en: "Summarize the current situation", he: "סכם את המצב הנוכחי" },
  { en: "Compare Shabbat vs weekday", he: "השווה שבת מול ימי חול" },
  { en: "Which region is most active?", he: "איזה אזור הכי פעיל?" },
  { en: "Is there an escalation trend?", he: "האם יש מגמת הסלמה?" },
  { en: "What time of day is safest?", he: "באיזו שעה הכי בטוח?" },
];

export function AISuggestedChips({ onSelect, disabled }: AISuggestedChipsProps) {
  const { lang } = useI18n();

  return (
    <div className="flex flex-wrap gap-1.5 px-4 pb-3">
      {SUGGESTIONS.map((s, i) => {
        const label = lang === "he" ? s.he : s.en;
        return (
          <button
            key={i}
            onClick={() => onSelect(label)}
            disabled={disabled}
            className="text-[11px] font-mono px-3 py-1.5 rounded-full border border-accent-blue/20 text-accent-blue/70 hover:bg-accent-blue/10 hover:text-accent-blue transition-colors disabled:opacity-30"
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/ai/AISuggestedChips.tsx
git commit -m "feat: add bilingual suggested prompt chips"
```

---

### Task 9: AI Consent Screen

**Files:**
- Create: `components/ai/AIConsentScreen.tsx`

- [ ] **Step 1: Create `components/ai/AIConsentScreen.tsx`**

```tsx
"use client";

import { Sparkles } from "lucide-react";
import { useI18n } from "../../lib/i18n";
import { useAI } from "./AIProvider";

export function AIConsentScreen() {
  const { engine, initEngine } = useAI();
  const { lang } = useI18n();
  const isHe = lang === "he";

  if (!engine) return null;

  const isDownloading = engine.status === "downloading";
  const isError = engine.status === "error";

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8 gap-5">
      <div className="w-14 h-14 rounded-2xl bg-accent-blue/10 border border-accent-blue/20 flex items-center justify-center">
        <Sparkles size={24} className="text-accent-blue" />
      </div>

      <div className="text-center max-w-sm">
        <h2 className="text-[15px] font-medium text-text-primary mb-2">
          {isHe ? "הפעלת עוזר AI" : "Enable AI Assistant"}
        </h2>
        <p className="text-[13px] text-text-secondary leading-relaxed">
          {isHe
            ? `כדי להפעיל AI, מודל קטן יורד (${engine.downloadSize}). הוא רץ לגמרי על המכשיר שלך — הנתונים שלך לא עוזבים את הדפדפן.`
            : `To enable AI, a small model will be downloaded (${engine.downloadSize}). This runs entirely on your device — your data never leaves your browser.`}
        </p>
      </div>

      {isDownloading && (
        <div className="w-full max-w-xs">
          <div className="h-2 bg-bg-elevated rounded-full overflow-hidden">
            <div
              className="h-full bg-accent-blue rounded-full transition-all duration-300"
              style={{ width: `${engine.downloadProgress ?? 0}%` }}
            />
          </div>
          <div className="text-[10px] font-mono text-text-tertiary text-center mt-1.5">
            {isHe ? "מוריד מודל..." : "Downloading model..."} {engine.downloadProgress ?? 0}%
          </div>
        </div>
      )}

      {isError && (
        <div className="text-[12px] text-accent-red text-center max-w-xs">
          {engine.error ?? (isHe ? "משהו השתבש" : "Something went wrong")}
        </div>
      )}

      {!isDownloading && (
        <button
          onClick={initEngine}
          className="px-6 py-2.5 rounded-xl bg-accent-blue text-white text-[13px] font-medium hover:bg-accent-blue/90 transition-colors"
        >
          {isError
            ? (isHe ? "נסה שוב" : "Try Again")
            : (isHe ? "הורדה והפעלה" : "Download & Enable")}
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/ai/AIConsentScreen.tsx
git commit -m "feat: add AI consent screen with download progress"
```

---

### Task 10: AI Chat View

**Files:**
- Create: `components/ai/AIChatView.tsx`

- [ ] **Step 1: Create `components/ai/AIChatView.tsx`**

```tsx
"use client";

import { useEffect, useRef } from "react";
import { Sparkles } from "lucide-react";
import { useAI } from "./AIProvider";
import { useI18n } from "../../lib/i18n";

export function AIChatView() {
  const { messages, isGenerating } = useAI();
  const { lang } = useI18n();
  const scrollRef = useRef<HTMLDivElement>(null);
  const isHe = lang === "he";

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 px-8 text-center">
        <Sparkles size={20} className="text-text-tertiary" />
        <p className="text-[12px] text-text-tertiary max-w-xs">
          {isHe
            ? "שאלו שאלה על דפוסי ההתרעות, או בחרו הצעה למטה"
            : "Ask a question about alert patterns, or pick a suggestion below"}
        </p>
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3 scrollbar-hide">
      {messages.map((msg, i) => (
        <div
          key={i}
          className={`max-w-[85%] ${
            msg.role === "user"
              ? "ms-auto bg-accent-blue/15 border border-accent-blue/20 text-text-primary"
              : "me-auto bg-bg-surface border border-border text-text-secondary"
          } rounded-xl px-3.5 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap`}
        >
          {msg.content}
          {msg.role === "assistant" && i === messages.length - 1 && isGenerating && (
            <span className="inline-block w-1.5 h-4 bg-accent-blue/60 animate-pulse ms-0.5 align-text-bottom rounded-sm" />
          )}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/ai/AIChatView.tsx
git commit -m "feat: add AI chat view with streaming cursor"
```

---

### Task 11: AI Tab

**Files:**
- Create: `components/ai/AITab.tsx`

- [ ] **Step 1: Create `components/ai/AITab.tsx`**

Orchestrates the consent screen vs chat view, includes prompt bar and chips.

```tsx
"use client";

import { useCallback, useEffect, useRef } from "react";
import { useAI } from "./AIProvider";
import { useI18n } from "../../lib/i18n";
import { useClientAnalytics } from "../../lib/hooks/use-client-analytics";
import { buildSystemPrompt } from "../../lib/ai-context";
import { AIConsentScreen } from "./AIConsentScreen";
import { AIChatView } from "./AIChatView";
import { AIPromptBar } from "./AIPromptBar";
import { AISuggestedChips } from "./AISuggestedChips";
import type { Alert, CityCoord, FilterState } from "../../lib/types";

interface AITabProps {
  alerts: Alert[];
  cityCoords: Map<string, CityCoord>;
  filter: FilterState;
  initialQuestion?: string;
}

export function AITab({ alerts, cityCoords, filter, initialQuestion }: AITabProps) {
  const { engine, sendMessage, isGenerating } = useAI();
  const { lang } = useI18n();
  const analytics = useClientAnalytics(alerts, cityCoords);
  const isHe = lang === "he";

  const handleAsk = useCallback(
    (question: string) => {
      if (!analytics || isGenerating) return;
      const system = buildSystemPrompt(analytics, filter, lang);
      sendMessage(system, question);
    },
    [analytics, filter, lang, sendMessage, isGenerating]
  );

  // Handle initial question from Analytics tab cross-reference
  const initialQuestionHandled = useRef(false);
  useEffect(() => {
    if (initialQuestion && analytics && !isGenerating && !initialQuestionHandled.current) {
      initialQuestionHandled.current = true;
      handleAsk(initialQuestion);
    }
  }, [initialQuestion, analytics, isGenerating, handleAsk]);

  if (!engine) return null;

  // Needs download
  if (engine.status === "needs-download" || engine.status === "downloading" || engine.status === "error") {
    return (
      <div className="h-full flex flex-col bg-bg-primary">
        <AIConsentScreen />
      </div>
    );
  }

  // Ready
  return (
    <div className="h-full flex flex-col bg-bg-primary">
      <AIPromptBar onSubmit={handleAsk} disabled={isGenerating || !analytics} />
      <AIChatView />
      <AISuggestedChips onSelect={handleAsk} disabled={isGenerating} />
      <div className="px-4 pb-2 text-center">
        <span className="text-[9px] font-mono text-text-tertiary/40">
          {isHe ? "מופעל על ידי AI מקומי" : "Powered by on-device AI"} · {engine.name}
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/ai/AITab.tsx
git commit -m "feat: add AITab orchestrating consent, chat, and prompt bar"
```

---

## Chunk 4: Integration

### Task 12: Add i18n Keys

**Files:**
- Modify: `lib/i18n.tsx`

- [ ] **Step 1: Add AI translation keys to both EN and HE translation objects in `lib/i18n.tsx`**

Add to the `en` translations:
```typescript
"ai.input.placeholder": "Ask about alert patterns...",
"ai.powered": "Powered by on-device AI",
```

Add to the `he` translations:
```typescript
"ai.input.placeholder": "שאלו על דפוסי התרעות...",
"ai.powered": "מופעל על ידי AI מקומי",
```

- [ ] **Step 2: Commit**

```bash
git add lib/i18n.tsx
git commit -m "feat: add AI-related i18n translation keys"
```

---

### Task 13: Update TabBar & AppShell

**Files:**
- Modify: `components/TabBar.tsx`
- Modify: `components/AppShell.tsx`
- Modify: `components/analytics/AnalyticsView.tsx`

- [ ] **Step 1: Update TabBar to support conditional AI tab**

In `components/TabBar.tsx`:
- Change `Tab` type to `"map" | "analytics" | "feed" | "ai"`
- Add `Sparkles` import from `lucide-react`
- Add `aiAvailable?: boolean` to `TabBarProps`
- Add `"ai"` to `tabIds` but filter it out in render when `!aiAvailable`
- Add `ai: "AI"` to `tabKeys` (no translation needed)
- Add Sparkles icon for the `"ai"` tab

- [ ] **Step 2: Update AppShell to include AI tab**

In `components/AppShell.tsx`:
- Import `useAI` from `./ai/AIProvider`
- Import `AITab` from `./ai/AITab`
- Get `{ available: aiAvailable, clearMessages }` from `useAI()`
- Pass `aiAvailable` to `TabBar`
- Add AI tab content in the main switch:

```tsx
{activeTab === "ai" && (
  <AITab alerts={alerts} cityCoords={cityCoords} filter={filter} />
)}
```

- Clear AI messages when filter changes (add `clearMessages` to the filter effect)

- [ ] **Step 3: Add AIPromptBar to AnalyticsView**

In `components/analytics/AnalyticsView.tsx`, add `onAskAI` prop and render `AIPromptBar` above the panel chips:

```tsx
// Add to imports:
import { AIPromptBar } from "../ai/AIPromptBar";

// Add to props interface:
interface AnalyticsViewProps {
  alerts: Alert[];
  cityCoords: Map<string, CityCoord>;
  regionId: string | null;
  onAskAI?: (question: string) => void;  // NEW
}

// Add inside the component, before the panel chip selector div:
{onAskAI && (
  <AIPromptBar onSubmit={onAskAI} placeholder={isHe ? "שאלו את ה-AI..." : "Ask AI..."} />
)}
```

In `components/AppShell.tsx`, add state for pending AI question and wire it:

```tsx
const [pendingAIQuestion, setPendingAIQuestion] = useState<string | undefined>();

function handleAskAI(question: string) {
  setPendingAIQuestion(question);
  setActiveTab("ai");
}

// In the analytics tab render:
{activeTab === "analytics" && (
  <AnalyticsView
    alerts={alerts}
    cityCoords={cityCoords}
    regionId={filter.regionId}
    onAskAI={aiAvailable ? handleAskAI : undefined}
  />
)}

// In the AI tab render:
{activeTab === "ai" && (
  <AITab
    alerts={alerts}
    cityCoords={cityCoords}
    filter={filter}
    initialQuestion={pendingAIQuestion}
  />
)}

// Clear pending question when leaving AI tab:
// In the tab change handler, clear it:
function handleTabChange(tab: Tab) {
  setActiveTab(tab);
  if (tab !== "ai") setPendingAIQuestion(undefined);
}
```

- [ ] **Step 4: Verify everything builds**

```bash
npm run build
```

Expected: Clean build with AI tab appearing when an engine is detected.

- [ ] **Step 5: Commit**

```bash
git add components/TabBar.tsx components/AppShell.tsx components/analytics/AnalyticsView.tsx
git commit -m "feat: integrate AI tab into app shell with conditional visibility"
```

---

### Task 14: Build & Deploy

- [ ] **Step 1: Run tests**

```bash
npm test
```

Expected: All existing tests pass (AI engines are browser-only, no unit tests needed for them).

- [ ] **Step 2: Build for production**

```bash
npm run build
```

Expected: Clean build.

- [ ] **Step 3: Push and deploy**

```bash
git push origin main
vercel --prod
```

- [ ] **Step 4: Test in Chrome (with Built-in AI flags enabled)**

1. Open `chrome://flags/#optimization-guide-on-device-model`
2. Enable "BypassPerfRequirement"
3. Open `chrome://flags/#prompt-api-for-gemini-nano`
4. Enable
5. Restart Chrome
6. Visit the deployed app
7. Verify AI tab appears with Sparkles icon
8. Test a suggested prompt — should stream a response

- [ ] **Step 5: Test WebLLM fallback**

1. Open Firefox or Edge
2. Visit the deployed app
3. AI tab should appear with download consent
4. Click "Download & Enable"
5. Wait for model download (~350MB)
6. Test a prompt

- [ ] **Step 6: Test Wllama fallback (Safari or browser with WebGPU disabled)**

1. Open Safari or disable WebGPU in Chrome via `chrome://flags/#enable-webgpu-developer-features`
2. Visit the deployed app
3. AI tab should appear with consent screen showing ~80MB download
4. Test download and a prompt

- [ ] **Step 7: Commit any fixes**

```bash
git add components/ai/ lib/ai-context.ts lib/i18n.tsx components/TabBar.tsx components/AppShell.tsx components/analytics/AnalyticsView.tsx app/layout.tsx
git commit -m "fix: resolve integration issues from AI assistant testing"
```
