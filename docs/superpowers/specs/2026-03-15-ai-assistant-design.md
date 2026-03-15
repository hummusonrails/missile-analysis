# AI Assistant Feature — Design Spec

## Overview

A client-side AI assistant for SirenWise that runs entirely in the user's browser. Uses a tiered engine detection system to provide the best available AI experience — from Chrome's built-in Gemini Nano (zero download) to WebLLM (WebGPU) to Wllama (WASM/CPU). Data never leaves the device.

The AI narrates and synthesizes the existing pre-computed analytics in natural language, answering user questions about alert patterns, trends, and comparisons. It does NOT process raw alerts — it interprets the same compact analytics summaries (~2-3KB JSON) that power the analytics cards.

The feature is fully bilingual (EN/HE) and appears as a 4th tab ("AI") in the bottom navigation, visible only when at least one AI engine is available.

## Engine Detection & Tiering

Detection runs once on app load, in order:

| Priority | Engine | Detection | Download | Performance |
|----------|--------|-----------|----------|-------------|
| 1 | Chrome Built-in AI (Gemini Nano) | `typeof LanguageModel !== "undefined"` + `LanguageModel.availability()` returns `"readily"` or `"after-download"` | 0 (built into browser) | Instant |
| 2 | WebLLM (Qwen2-0.5B-q4) | `navigator.gpu` exists (WebGPU) | ~350MB (cached in IndexedDB) | ~15-30 tok/s |
| 3 | Wllama (SmolLM-135M-q4) | `WebAssembly.validate()` with SIMD support | ~80MB (cached in IndexedDB) | ~5-10 tok/s |
| 4 | None | All above fail | — | Tab hidden |

First viable engine wins. User sees whichever works on their browser/hardware — they never choose or know which engine is running.

## Engine Abstraction

All three engines implement a common interface:

```typescript
interface AIEngine {
  id: "chrome-ai" | "webllm" | "wllama";
  name: string;
  status: "ready" | "needs-download" | "downloading" | "unavailable";
  downloadSize?: string;
  downloadProgress?: number; // 0-100
  init(): Promise<void>;
  prompt(system: string, user: string): AsyncIterable<string>;
  destroy(): void;
}
```

### Chrome AI Engine

- Uses `LanguageModel.create()` with system prompt
- Streaming via `session.promptStreaming()`
- No download, no consent screen needed
- Context window: ~4K tokens

### WebLLM Engine

- Uses `@mlc-ai/web-llm` with `CreateMLCEngine()`
- Model: `Qwen2-0.5B-Instruct-q4f16_1-MLC` (~350MB)
- Streaming via `engine.chat.completions.create({ stream: true })`
- Cached in IndexedDB after first download
- Requires WebGPU (Chrome 113+, Edge, Firefox 118+ behind flag)

### Wllama Engine

- Uses `@wllama/wllama` with llama.cpp WASM backend
- Model: SmolLM-135M-Q4_K_M GGUF (~80MB)
- Streaming via `wllama.createCompletion({ stream: true })`
- CPU-only via WASM SIMD — works in all browsers including Safari
- Runs in a Web Worker to keep UI responsive

## Context Building

Every prompt receives a system context built from `useClientAnalytics` output + current filter state:

```typescript
function buildSystemPrompt(analytics, filter, lang): string
```

The system prompt includes:
- Role description ("You are an analyst for SirenWise")
- Current filter context (time range, region)
- All 11 analytics summaries as key-value pairs (~800 tokens):
  - Total alerts, Shabbat multiplier + per-day averages
  - Peak/quietest hour, evening percentage
  - Busiest day, median event gap
  - Longest quiet/active periods
  - Escalation rate vs baseline
  - Multi-region event count, geographic spread
- Language instruction: "Answer in Hebrew" or "Answer in English" based on `lang`
- Constraint: "Be concise, specific with numbers, do not invent data"

Total system prompt: ~800 tokens, leaving ample room for user question + response within all engines' context windows.

## UI Design

### Tab Bar

The "AI" tab appears as the 4th tab (after Feed) only when `useAIEngine` returns `available: true`.

- **Label:** "AI" (no translation needed — universal)
- **Icon:** `Sparkles` from `lucide-react`
- Tab is completely hidden when no AI engine is available

### AI Tab States

**State 1: Consent Screen (WebLLM/Wllama only)**

Shown on first visit when the selected engine requires a model download. Chrome AI users skip directly to State 2.

Content:
- Sparkles icon
- EN: "To enable AI, a small model will be downloaded ({size}). This runs entirely on your device — your data never leaves your browser."
- HE: "כדי להפעיל AI, מודל קטן יורד ({size}). הוא רץ לגמרי על המכשיר שלך — הנתונים שלך לא עוזבים את הדפדפן."
- "Download & Enable" / "הורדה והפעלה" button
- Progress bar during download (uses `engine.downloadProgress`)

**State 2: Chat Interface (ready)**

- **Prompt input bar** at top with send button
- **Suggested prompt chips** below input (bilingual):
  - "Summarize the current situation" / "סכם את המצב הנוכחי"
  - "Compare Shabbat vs weekday" / "השווה שבת מול ימי חול"
  - "Which region is most active?" / "איזה אזור הכי פעיל?"
  - "Is there an escalation trend?" / "האם יש מגמת הסלמה?"
  - "What time of day is safest?" / "באיזו שעה הכי בטוח?"
- **Conversation area** below: alternating user messages and AI responses
- AI responses stream in token by token
- Conversation resets when filter (time range/region) changes (analytics context changed)

### Dual Placement in Analytics Tab

The same `AIPromptBar` component appears at the top of the Analytics tab (above the panel selector chips). Tapping it or typing a question switches to the AI tab with the response. This gives the feature discoverability without requiring users to find the AI tab first.

## Component Structure

```
components/
  ai/
    AIProvider.tsx       — React context provider: detection, engine lifecycle, state
    AITab.tsx            — Main AI tab view (consent → chat routing)
    AIConsentScreen.tsx  — Download consent screen with progress bar
    AIChatView.tsx       — Chat interface with streaming responses
    AIPromptBar.tsx      — Input bar + send button (reused in Analytics tab)
    AISuggestedChips.tsx — Bilingual suggested prompt chips
    engines/
      chrome-ai.ts      — Chrome Built-in AI adapter
      webllm.ts         — WebLLM adapter
      wllama.ts         — Wllama adapter
      types.ts          — AIEngine interface + shared types

lib/
  ai-context.ts         — buildSystemPrompt function
```

## Dependencies

| Package | Purpose | Size Impact |
|---------|---------|-------------|
| `@mlc-ai/web-llm` | WebLLM engine | ~2MB bundle (model downloaded separately) |
| `@wllama/wllama` | Wllama WASM engine | ~1MB bundle (model downloaded separately) |
| `lucide-react` | Sparkles icon + UI icons | Tree-shakeable, minimal |

## Bilingual Support

All UI text in the AI feature uses the existing `useI18n` hook. New translation keys to add to `lib/i18n.tsx`:

```typescript
// English
"ai.tab": "AI",
"ai.consent.title": "Enable AI Assistant",
"ai.consent.description": "To enable AI, a small model will be downloaded ({size}). This runs entirely on your device — your data never leaves your browser.",
"ai.consent.button": "Download & Enable",
"ai.consent.downloading": "Downloading model...",
"ai.input.placeholder": "Ask about alert patterns...",
"ai.chip.summarize": "Summarize the current situation",
"ai.chip.shabbat": "Compare Shabbat vs weekday",
"ai.chip.region": "Which region is most active?",
"ai.chip.escalation": "Is there an escalation trend?",
"ai.chip.safest": "What time of day is safest?",
"ai.powered": "Powered by on-device AI",

// Hebrew
"ai.tab": "AI",
"ai.consent.title": "הפעלת עוזר AI",
"ai.consent.description": "כדי להפעיל AI, מודל קטן יורד ({size}). הוא רץ לגמרי על המכשיר שלך — הנתונים שלך לא עוזבים את הדפדפן.",
"ai.consent.button": "הורדה והפעלה",
"ai.consent.downloading": "מוריד מודל...",
"ai.input.placeholder": "שאלו על דפוסי התרעות...",
"ai.chip.summarize": "סכם את המצב הנוכחי",
"ai.chip.shabbat": "השווה שבת מול ימי חול",
"ai.chip.region": "איזה אזור הכי פעיל?",
"ai.chip.escalation": "האם יש מגמת הסלמה?",
"ai.chip.safest": "באיזו שעה הכי בטוח?",
"ai.powered": "מופעל על ידי AI מקומי",
```

## Data Flow

```
User taps "AI" tab
  → useAIEngine detects best engine
  → If needs download: show consent → download → cache in IndexedDB
  → Show chat interface

User types/taps question
  → buildSystemPrompt(useClientAnalytics output, filter, lang)
  → engine.prompt(systemPrompt, userQuestion)
  → Stream tokens into chat view
  → Display complete response

User changes filter (time range/region)
  → Analytics recompute
  → Conversation clears (context changed)
  → New system prompt built from updated analytics
```

## What This Feature Does NOT Do

- Does NOT process raw alert data (too large for client-side context windows)
- Does NOT send data to any server or API
- Does NOT work on mobile browsers (WebGPU/Chrome AI not available on mobile yet)
- Does NOT replace the existing analytics cards (those remain always visible)
- Does NOT persist conversations across sessions

## Not In Scope (YAGNI)

- Server-side AI fallback
- Conversation history persistence
- Multi-turn context (each question is independent with the same system context)
- Custom model selection by the user
- Fine-tuning or training on alert data
