import { AgentRuntimeError } from "@/lib/agent/errors";

export interface OllamaConfig {
  baseUrl: string;
  model?: string;
  timeoutMs: number;
  keepAlive?: string;
  think?: boolean;
}

export type OllamaStatus =
  | "Available"
  | "Not configured"
  | "Unavailable"
  | "Model unavailable"
  | "Invalid configuration";

export interface OllamaStatusResult {
  status: OllamaStatus;
  configured: boolean;
  model?: string;
  availableModels: string[];
}

const DEFAULT_BASE_URL = "http://localhost:11434";
const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_KEEP_ALIVE = "15m";

export function validateOllamaBaseUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    throw new AgentRuntimeError("configuration");
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new AgentRuntimeError("configuration");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new AgentRuntimeError("configuration");
  }

  // Normalize by stripping trailing slashes
  return `${parsed.protocol}//${parsed.host}${parsed.pathname.replace(/\/+$/, "")}`;
}

export function readOllamaConfig(
  environment: Record<string, string | undefined> = process.env
): OllamaConfig {
  const rawBaseUrl = environment.JARVIS_OLLAMA_BASE_URL || DEFAULT_BASE_URL;
  let baseUrl: string;
  try {
    baseUrl = validateOllamaBaseUrl(rawBaseUrl);
  } catch {
    throw new AgentRuntimeError("configuration");
  }

  const rawModel = environment.JARVIS_OLLAMA_MODEL?.trim();
  const model = rawModel && rawModel.length > 0 ? rawModel : undefined;

  const rawTimeout = environment.JARVIS_AGENT_TIMEOUT_MS;
  let timeoutMs = DEFAULT_TIMEOUT_MS;
  if (rawTimeout) {
    const parsedTimeout = Number.parseInt(rawTimeout, 10);
    if (!Number.isNaN(parsedTimeout) && parsedTimeout >= 1000 && parsedTimeout <= 300_000) {
      timeoutMs = parsedTimeout;
    }
  }

  const rawKeepAlive = environment.JARVIS_OLLAMA_KEEP_ALIVE?.trim();
  const keepAlive = rawKeepAlive && rawKeepAlive.length > 0 ? rawKeepAlive : DEFAULT_KEEP_ALIVE;

  const rawThink = environment.JARVIS_OLLAMA_THINK?.trim().toLowerCase();
  const think = rawThink === "true" ? true : false;

  return {
    baseUrl,
    model,
    timeoutMs,
    keepAlive,
    think,
  };
}

export async function checkOllamaStatus(
  explicitConfig?: Partial<OllamaConfig>,
  environment: Record<string, string | undefined> = process.env
): Promise<OllamaStatusResult> {
  let config: OllamaConfig;
  try {
    const base = readOllamaConfig(environment);
    config = {
      ...base,
      ...explicitConfig,
      baseUrl: explicitConfig?.baseUrl ? validateOllamaBaseUrl(explicitConfig.baseUrl) : base.baseUrl,
    };
  } catch {
    return {
      status: "Invalid configuration",
      configured: false,
      availableModels: [],
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3_000);

  try {
    const response = await fetch(`${config.baseUrl}/api/tags`, {
      method: "GET",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        status: "Unavailable",
        configured: true,
        availableModels: [],
      };
    }

    const data = (await response.json()) as { models?: Array<{ name?: string; model?: string }> };
    const rawModels = Array.isArray(data?.models) ? data.models : [];
    const availableModels = rawModels
      .map((m) => m.name || m.model || "")
      .filter((name): name is string => typeof name === "string" && name.length > 0);

    if (availableModels.length === 0) {
      return {
        status: "Model unavailable",
        configured: true,
        model: config.model,
        availableModels: [],
      };
    }

    // Check if configured model is available
    if (config.model) {
      const match = availableModels.find(
        (m) => m.toLowerCase() === config.model?.toLowerCase() || m.startsWith(`${config.model}:`)
      );
      if (match) {
        return {
          status: "Available",
          configured: true,
          model: match,
          availableModels,
        };
      }
      return {
        status: "Model unavailable",
        configured: true,
        model: config.model,
        availableModels,
      };
    }

    // If no model explicitly configured, select the first available local model
    return {
      status: "Available",
      configured: true,
      model: availableModels[0],
      availableModels,
    };
  } catch {
    clearTimeout(timeoutId);
    return {
      status: "Unavailable",
      configured: true,
      availableModels: [],
    };
  }
}
