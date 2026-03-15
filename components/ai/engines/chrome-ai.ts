import type { AIEngine, EngineId, EngineStatus } from "./types";

// Augment globalThis with Chrome's experimental LanguageModel API
declare global {
  interface Window {
    LanguageModel?: {
      availability(): Promise<string>;
      create(options?: { systemPrompt?: string }): Promise<ChromeAISession>;
    };
  }
}

interface ChromeAISession {
  promptStreaming(input: string): ReadableStream<string>;
  destroy(): void;
}

export class ChromeAIEngine implements AIEngine {
  readonly id: EngineId = "chrome-ai";
  readonly name = "Chrome Built-in AI (Gemini Nano)";
  status: EngineStatus = "unavailable";
  error?: string;

  private session: ChromeAISession | null = null;

  static async detect(): Promise<boolean> {
    if (typeof globalThis.LanguageModel === "undefined") return false;
    try {
      const availability = await globalThis.LanguageModel.availability();
      return availability !== "unavailable";
    } catch {
      return false;
    }
  }

  async init(): Promise<void> {
    if (typeof globalThis.LanguageModel === "undefined") {
      this.status = "unavailable";
      this.error = "Chrome Built-in AI is not available in this browser.";
      return;
    }

    try {
      const availability = await globalThis.LanguageModel.availability();
      if (availability === "unavailable") {
        this.status = "unavailable";
        this.error = "Chrome Built-in AI is not available on this device.";
        return;
      }

      if (availability === "downloadable") {
        this.status = "needs-download";
      }

      // Create a test session to confirm availability and trigger any needed download
      this.session = await globalThis.LanguageModel.create();
      this.status = "ready";
    } catch (err) {
      this.status = "error";
      this.error = err instanceof Error ? err.message : String(err);
    }
  }

  async *prompt(
    system: string,
    user: string,
    signal?: AbortSignal
  ): AsyncIterable<string> {
    if (typeof globalThis.LanguageModel === "undefined") {
      throw new Error("Chrome Built-in AI is not available.");
    }

    // Create a fresh session per prompt with system prompt
    const session = await globalThis.LanguageModel.create({
      systemPrompt: system,
    });

    try {
      const stream = session.promptStreaming(user);
      const reader = stream.getReader();
      let previousLength = 0;

      while (true) {
        if (signal?.aborted) {
          reader.cancel();
          break;
        }

        const { done, value } = await reader.read();
        if (done) break;

        // Chrome streams cumulative text (not deltas) — extract only the new portion
        if (value && value.length > previousLength) {
          const delta = value.slice(previousLength);
          previousLength = value.length;
          yield delta;
        }
      }
    } finally {
      session.destroy();
    }
  }

  destroy(): void {
    if (this.session) {
      this.session.destroy();
      this.session = null;
    }
    this.status = "unavailable";
  }
}
