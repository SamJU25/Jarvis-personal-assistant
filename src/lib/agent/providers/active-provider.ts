import type { AgentProvider } from "@/lib/contracts/provider";
import { CommandCodeProvider } from "@/lib/agent/providers/command-code-provider";
import { OllamaProvider } from "@/lib/agent/providers/ollama-provider";
import { readOllamaConfig, type OllamaConfig } from "@/lib/agent/providers/ollama-config";
import { HermesProvider } from "@/lib/agent/providers/hermes-provider";

export type ProviderId = "hermes" | "ollama" | "command-code";

function resolveInitialProviderId(): ProviderId {
  const env = process.env.JARVIS_PROVIDER?.toLowerCase().trim();
  if (env === "command-code") return "command-code";
  if (env === "ollama") return "ollama";
  return "hermes";
}

let currentProviderId: ProviderId = resolveInitialProviderId();

let currentOllamaModel: string | undefined = process.env.JARVIS_OLLAMA_MODEL?.trim() || undefined;

export function getActiveProviderId(): ProviderId {
  return currentProviderId;
}

export function setActiveProviderId(id: ProviderId): void {
  if (id !== "command-code" && id !== "ollama" && id !== "hermes") {
    throw new Error(`Invalid provider ID: ${id}`);
  }
  currentProviderId = id;
}

export function getActiveOllamaModel(): string | undefined {
  return currentOllamaModel;
}

export function setActiveOllamaModel(model: string | undefined): void {
  currentOllamaModel = model?.trim() || undefined;
}

function createOllamaProvider(): OllamaProvider {
  const configGetter = (): OllamaConfig => {
    const base = readOllamaConfig();
    return {
      ...base,
      model: currentOllamaModel ?? base.model,
    };
  };
  return new OllamaProvider(undefined, configGetter);
}

export function getActiveProvider(): AgentProvider {
  if (currentProviderId === "hermes") {
    const fallback = createOllamaProvider();
    return new HermesProvider({ fallbackProvider: fallback });
  }

  if (currentProviderId === "ollama") {
    return createOllamaProvider();
  }

  return new CommandCodeProvider();
}

export function resetActiveProvider(): void {
  currentProviderId = resolveInitialProviderId();
  currentOllamaModel = process.env.JARVIS_OLLAMA_MODEL?.trim() || undefined;
}
