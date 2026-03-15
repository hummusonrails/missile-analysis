import type { AIEngine, EngineId, EngineStatus } from "./types";

const MODEL_ID = "Qwen2.5-1.5B-Instruct-q4f16_1-MLC";

export class WebLLMEngine implements AIEngine {
  readonly id: EngineId = "webllm";
  readonly name = "WebLLM (Qwen2.5 1.5B)";
  status: EngineStatus = "unavailable";
  readonly downloadSize = "900MB";
  downloadProgress?: number;
  error?: string;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private engine: any = null;

  static detect(): boolean {
    if (typeof navigator === "undefined" || !("gpu" in navigator)) return false;
    // iOS Safari exposes navigator.gpu but can't handle LLM inference —
    // the memory pressure crashes the tab. Fall through to wllama instead.
    const ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && "ontouchend" in document)) {
      return false;
    }
    return true;
  }

  async init(): Promise<void> {
    if (!WebLLMEngine.detect()) {
      this.status = "unavailable";
      this.error = "WebGPU is not supported in this browser.";
      return;
    }

    this.status = "downloading";
    this.downloadProgress = 0;

    try {
      const { CreateMLCEngine } = await import("@mlc-ai/web-llm");

      this.engine = await CreateMLCEngine(MODEL_ID, {
        initProgressCallback: (progress: { progress: number; text: string }) => {
          this.downloadProgress = Math.round(progress.progress * 100);
          if (this.downloadProgress < 100) {
            this.status = "downloading";
          }
        },
      });

      this.status = "ready";
      this.downloadProgress = 100;
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
    if (!this.engine) {
      throw new Error("WebLLM engine is not initialized. Call init() first.");
    }

    const stream = await this.engine.chat.completions.create({
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      stream: true,
      stream_options: { include_usage: false },
    });

    for await (const chunk of stream) {
      if (signal?.aborted) break;
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        yield delta;
      }
    }
  }

  destroy(): void {
    if (this.engine) {
      try {
        this.engine.unload?.();
      } catch {
        // ignore cleanup errors
      }
      this.engine = null;
    }
    this.status = "unavailable";
  }
}
