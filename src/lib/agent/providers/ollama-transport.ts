import { AgentRuntimeError } from "@/lib/agent/errors";
import { type OllamaConfig, readOllamaConfig } from "@/lib/agent/providers/ollama-config";

export interface OllamaChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: Array<{
    id?: string;
    function: {
      name: string;
      arguments: Record<string, unknown> | string;
    };
  }>;
}

export interface OllamaToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface OllamaChatPayload {
  model: string;
  messages: OllamaChatMessage[];
  tools?: OllamaToolDefinition[];
  stream?: boolean;
  format?: "json";
  keep_alive?: string;
  think?: boolean;
  options?: {
    temperature?: number;
    num_predict?: number;
  };
}

export interface OllamaChatResponse {
  model: string;
  message: OllamaChatMessage;
  done: boolean;
  total_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
}

export interface OllamaTransport {
  chat(payload: OllamaChatPayload, signal?: AbortSignal): Promise<OllamaChatResponse>;
  listModels(signal?: AbortSignal): Promise<string[]>;
}

export class FetchOllamaTransport implements OllamaTransport {
  constructor(private readonly getConfig: () => OllamaConfig = () => readOllamaConfig()) {}

  async listModels(signal?: AbortSignal): Promise<string[]> {
    const config = this.getConfig();
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (signal) signal.addEventListener("abort", abort, { once: true });
    const timeout = setTimeout(() => controller.abort(), 5_000);

    try {
      const response = await fetch(`${config.baseUrl}/api/tags`, {
        method: "GET",
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      clearTimeout(timeout);

      if (!response.ok) {
        throw new AgentRuntimeError("unavailable");
      }

      const data = (await response.json()) as { models?: Array<{ name?: string; model?: string }> };
      const rawModels = Array.isArray(data?.models) ? data.models : [];
      return rawModels
        .map((m) => m.name || m.model || "")
        .filter((name): name is string => typeof name === "string" && name.length > 0);
    } catch (error) {
      clearTimeout(timeout);
      if (signal?.aborted) throw new AgentRuntimeError("cancelled");
      if (error instanceof AgentRuntimeError) throw error;
      throw new AgentRuntimeError("unavailable");
    } finally {
      if (signal) signal.removeEventListener("abort", abort);
    }
  }

  async chat(payload: OllamaChatPayload, signal?: AbortSignal): Promise<OllamaChatResponse> {
    const config = this.getConfig();
    const controller = new AbortController();
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, config.timeoutMs);

    const abort = () => controller.abort();
    if (signal) signal.addEventListener("abort", abort, { once: true });

    try {
      const response = await fetch(`${config.baseUrl}/api/chat`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          ...payload,
          stream: false,
          keep_alive: payload.keep_alive ?? config.keepAlive ?? "15m",
          think: payload.think ?? config.think ?? false,
        }),
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        console.error(`Ollama HTTP ${response.status}: ${errorText}`);
        if (response.status === 404) {
          throw new AgentRuntimeError("configuration");
        }
        if (response.status === 503 || response.status === 502) {
          throw new AgentRuntimeError("unavailable");
        }
        throw new AgentRuntimeError("unknown");
      }

      const data = (await response.json()) as OllamaChatResponse;
      if (!data || typeof data !== "object" || !data.message) {
        throw new AgentRuntimeError("malformed_output");
      }
      return data;
    } catch (error) {
      clearTimeout(timeout);
      if (timedOut) throw new AgentRuntimeError("timeout");
      if (signal?.aborted) throw new AgentRuntimeError("cancelled");
      if (error instanceof AgentRuntimeError) throw error;
      throw new AgentRuntimeError("unavailable");
    } finally {
      if (signal) signal.removeEventListener("abort", abort);
    }
  }
}
