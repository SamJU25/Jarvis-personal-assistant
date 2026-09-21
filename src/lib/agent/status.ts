import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { readAgentConfig } from "@/lib/agent/config";
import type { ProviderStatus } from "@/lib/contracts/agent-api";
import { checkObsidianStatus } from "@/lib/obsidian/config";
import { checkGoogleStatus } from "@/lib/google/config";
import { getMemoryService } from "@/lib/memory/service";

import { checkOllamaStatus } from "@/lib/agent/providers/ollama-config";
import { getActiveProviderId, getActiveOllamaModel } from "@/lib/agent/providers/active-provider";
import { getVoiceStatus } from "@/lib/voice/config";

export async function getProviderStatus(): Promise<ProviderStatus> {
  const activeOllamaModel = getActiveOllamaModel();
  const [obsidian, google, ollama, voice] = await Promise.all([
    checkObsidianStatus(),
    checkGoogleStatus(),
    checkOllamaStatus(activeOllamaModel ? { model: activeOllamaModel } : undefined),
    getVoiceStatus(),
  ]);
  const memory = getMemoryService().checkStatus();

  let commandCodeAvailable = false;
  let commandCodeAuthenticated = false;
  let commandCodeModel = "Not configured";

  try {
    const config = readAgentConfig();
    await access(config.commandCodeEntry);
    commandCodeAuthenticated = await checkStatus(config.nodeExecutable, config.commandCodeEntry);
    commandCodeAvailable = true;
    commandCodeModel = config.model ?? "Command Code default";
  } catch {
    commandCodeAvailable = false;
    commandCodeAuthenticated = false;
    commandCodeModel = "Not configured";
  }

  const activeProviderId = getActiveProviderId();

  if (activeProviderId === "ollama") {
    const isAvailable = ollama.status === "Available";
    return {
      available: isAvailable,
      authenticated: isAvailable,
      provider: "Ollama",
      model: ollama.model ?? (ollama.status === "Model unavailable" ? "No local models found" : "Not configured"),
      activeProviderId,
      availableProviders: ["command-code", "ollama"],
      obsidian,
      google,
      memory,
      ollama,
      voice,
    };
  }

  return {
    available: commandCodeAvailable,
    authenticated: commandCodeAuthenticated,
    provider: "Command Code",
    model: commandCodeModel,
    activeProviderId: "command-code",
    availableProviders: ["command-code", "ollama"],
    obsidian,
    google,
    memory,
    ollama,
    voice,
  };
}

function checkStatus(nodeExecutable: string, entry: string): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn(nodeExecutable, [entry, "status"], { shell: false, windowsHide: true, stdio: ["ignore", "ignore", "ignore"] });
    const timer = setTimeout(() => { child.kill(); resolve(false); }, 10_000);
    child.once("error", () => { clearTimeout(timer); resolve(false); });
    child.once("close", (code) => { clearTimeout(timer); resolve(code === 0); });
  });
}
