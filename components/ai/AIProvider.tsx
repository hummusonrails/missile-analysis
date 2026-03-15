"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import type { AIEngine, AIMessage, EngineStatus } from "./engines/types";

interface AIContextType {
  engine: AIEngine | null;
  engineStatus: EngineStatus | null;
  messages: AIMessage[];
  isGenerating: boolean;
  sendMessage: (system: string, user: string) => Promise<void>;
  clearMessages: () => void;
  initEngine: () => Promise<void>;
  abortGeneration: () => void;
}

const AIContext = createContext<AIContextType>({
  engine: null,
  engineStatus: null,
  messages: [],
  isGenerating: false,
  sendMessage: async () => {},
  clearMessages: () => {},
  initEngine: async () => {},
  abortGeneration: () => {},
});

async function detectEngine(): Promise<AIEngine | null> {
  // Dynamic imports to avoid SSR issues
  const { ChromeAIEngine } = await import("./engines/chrome-ai");
  const { WebLLMEngine } = await import("./engines/webllm");
  const { WllamaEngine } = await import("./engines/wllama");

  if (await ChromeAIEngine.detect()) {
    return new ChromeAIEngine();
  }
  if (WebLLMEngine.detect()) {
    return new WebLLMEngine();
  }
  if (await WllamaEngine.detect()) {
    return new WllamaEngine();
  }
  return null;
}

export function AIProvider({ children }: { children: ReactNode }) {
  const [engine, setEngine] = useState<AIEngine | null>(null);
  const [engineStatus, setEngineStatus] = useState<EngineStatus | null>(null);
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const detectedRef = useRef(false);

  // Detect engine on mount (client-side only)
  useEffect(() => {
    if (detectedRef.current) return;
    detectedRef.current = true;

    detectEngine().then((detected) => {
      if (detected) {
        setEngine(detected);
        // Chrome AI is immediately "ready" (or needs-download but fast)
        // Others need explicit download consent
        if (detected.id === "chrome-ai") {
          setEngineStatus("ready");
        } else {
          setEngineStatus("needs-download");
        }
      } else {
        setEngineStatus("unavailable");
      }
    });
  }, []);

  // Keep engineStatus in sync with engine.status changes
  const syncStatus = useCallback(() => {
    if (engine) {
      setEngineStatus(engine.status);
    }
  }, [engine]);

  const initEngine = useCallback(async () => {
    if (!engine) return;
    setEngineStatus("downloading");
    await engine.init();
    syncStatus();
    // Force re-render by reading fresh status
    setEngineStatus(engine.status);
  }, [engine, syncStatus]);

  // Auto-init Chrome AI immediately since it doesn't need user consent for download
  useEffect(() => {
    if (engine && engine.id === "chrome-ai" && engineStatus === "ready") {
      engine.init().then(() => {
        setEngineStatus(engine.status);
      });
    }
  }, [engine, engineStatus]);

  const sendMessage = useCallback(
    async (system: string, user: string) => {
      if (!engine || engine.status !== "ready" || isGenerating) return;

      // Add user message
      const userMsg: AIMessage = { role: "user", content: user };
      setMessages((prev) => [...prev, userMsg]);

      // Add empty assistant message to stream into
      const assistantMsg: AIMessage = { role: "assistant", content: "" };
      setMessages((prev) => [...prev, assistantMsg]);

      setIsGenerating(true);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const stream = engine.prompt(system, user, controller.signal);
        for await (const token of stream) {
          if (controller.signal.aborted) break;
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last.role === "assistant") {
              updated[updated.length - 1] = {
                ...last,
                content: last.content + token,
              };
            }
            return updated;
          });
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last.role === "assistant") {
              updated[updated.length - 1] = {
                ...last,
                content:
                  last.content ||
                  (err instanceof Error ? err.message : "An error occurred."),
              };
            }
            return updated;
          });
        }
      } finally {
        setIsGenerating(false);
        abortControllerRef.current = null;
      }
    },
    [engine, isGenerating]
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  const abortGeneration = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      engine?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AIContext.Provider
      value={{
        engine,
        engineStatus,
        messages,
        isGenerating,
        sendMessage,
        clearMessages,
        initEngine,
        abortGeneration,
      }}
    >
      {children}
    </AIContext.Provider>
  );
}

export function useAI() {
  return useContext(AIContext);
}
