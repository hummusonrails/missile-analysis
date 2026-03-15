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
  prompt(system: string, user: string, signal?: AbortSignal): AsyncIterable<string>;
  destroy(): void;
}

export interface AIMessage {
  role: "user" | "assistant";
  content: string;
}
