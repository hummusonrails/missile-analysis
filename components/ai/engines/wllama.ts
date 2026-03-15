import type { AIEngine, EngineId, EngineStatus } from "./types";

const MODEL_URL =
  "https://huggingface.co/HuggingFaceTB/SmolLM-135M-Instruct-GGUF/resolve/main/smollm-135m-instruct.Q4_K_M.gguf";

const WLLAMA_CDN = "https://cdn.jsdelivr.net/npm/@wllama/wllama@latest/esm/";

const WASM_CONFIG = {
  "single-thread/wllama.wasm": `${WLLAMA_CDN}single-thread/wllama.wasm`,
  "multi-thread/wllama.wasm": `${WLLAMA_CDN}multi-thread/wllama.wasm`,
};

export class WllamaEngine implements AIEngine {
  readonly id: EngineId = "wllama";
  readonly name = "Wllama (SmolLM 135M)";
  status: EngineStatus = "unavailable";
  readonly downloadSize = "80MB";
  downloadProgress?: number;
  error?: string;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private wllama: any = null;

  static async detect(): Promise<boolean> {
    // Check for WebAssembly SIMD support
    if (typeof WebAssembly === "undefined") return false;
    try {
      // SIMD test: a small wasm module that uses SIMD instructions
      const simdTestBytes = new Uint8Array([
        0x00, 0x61, 0x73, 0x6d, // magic
        0x01, 0x00, 0x00, 0x00, // version
        0x01, 0x05, 0x01, 0x60, 0x00, 0x01, 0x7b, // type section: () -> v128
        0x03, 0x02, 0x01, 0x00, // function section
        0x0a, 0x0a, 0x01, 0x08, 0x00, 0xfd, 0x0c, // code section with v128.const
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x0b,
      ]);
      await WebAssembly.compile(simdTestBytes);
      return true;
    } catch {
      return false;
    }
  }

  async init(): Promise<void> {
    const supported = await WllamaEngine.detect();
    if (!supported) {
      this.status = "unavailable";
      this.error = "WebAssembly SIMD is not supported in this browser.";
      return;
    }

    this.status = "downloading";
    this.downloadProgress = 0;

    try {
      const { Wllama } = await import("@wllama/wllama");

      this.wllama = new Wllama(WASM_CONFIG);

      await this.wllama.loadModelFromUrl(MODEL_URL, {
        progressCallback: ({ loaded, total }: { loaded: number; total: number }) => {
          if (total > 0) {
            this.downloadProgress = Math.round((loaded / total) * 100);
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
    if (!this.wllama) {
      throw new Error("Wllama engine is not initialized. Call init() first.");
    }

    // Format as ChatML
    const chatMLPrompt =
      `<|im_start|>system\n${system}<|im_end|>\n` +
      `<|im_start|>user\n${user}<|im_end|>\n` +
      `<|im_start|>assistant\n`;

    // Wllama may not support true streaming — get full result and simulate word-by-word
    const result: string = await this.wllama.createCompletion(chatMLPrompt, {
      nPredict: 512,
      stopTokens: [],
      sampling: {
        temp: 0.7,
        top_p: 0.9,
      },
    });

    if (signal?.aborted) return;

    // Simulate streaming by yielding word by word
    const words = result.split(/(\s+)/);
    for (const word of words) {
      if (signal?.aborted) break;
      if (word) {
        yield word;
        // Small async yield to allow UI to update
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      }
    }
  }

  destroy(): void {
    if (this.wllama) {
      try {
        this.wllama.exit?.();
      } catch {
        // ignore cleanup errors
      }
      this.wllama = null;
    }
    this.status = "unavailable";
  }
}
