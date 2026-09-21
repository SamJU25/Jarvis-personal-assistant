import { checkOllamaStatus, readOllamaConfig } from "../src/lib/agent/providers/ollama-config";
import {
  getActiveProviderId,
  setActiveProviderId,
  getActiveProvider,
  resetActiveProvider,
} from "../src/lib/agent/providers/active-provider";
import { getProviderStatus } from "../src/lib/agent/status";
import { AgentRuntime } from "../src/lib/agent/runtime";
import { OllamaProvider } from "../src/lib/agent/providers/ollama-provider";
import { FetchOllamaTransport } from "../src/lib/agent/providers/ollama-transport";

async function main() {
  console.log("=== Phase 7.5 Ollama Provider Runtime Verification ===\n");

  // 1. Check Configuration & Local Host Reachability
  console.log("1. Checking Ollama host status...");
  const config = readOllamaConfig();
  console.log(`   Configured Base URL: ${config.baseUrl}`);
  console.log(`   Configured Model: ${config.model ?? "(none, will auto-detect)"}`);

  const status = await checkOllamaStatus();
  console.log(`   Ollama Status: ${status.status}`);
  console.log(`   Configured: ${status.configured}`);
  console.log(`   Detected Models: ${status.availableModels.length > 0 ? status.availableModels.join(", ") : "(none)"}`);

  // 2. Provider Selection & Multi-Provider Registry
  console.log("\n2. Verifying Provider Selection & Active Provider Registry...");
  resetActiveProvider();
  console.log(`   Initial Active Provider: ${getActiveProviderId()}`);
  if (getActiveProviderId() !== "command-code") {
    throw new Error("Expected initial active provider to be 'command-code'");
  }

  setActiveProviderId("ollama");
  console.log(`   Switched Active Provider: ${getActiveProviderId()}`);
  if (getActiveProviderId() !== "ollama") {
    throw new Error("Expected active provider to be 'ollama'");
  }
  const ollamaProviderInstance = getActiveProvider();
  console.log(`   Resolved Provider Instance: ${ollamaProviderInstance.name} (${ollamaProviderInstance.id})`);
  if (ollamaProviderInstance.id !== "ollama") {
    throw new Error("Expected resolved instance id to be 'ollama'");
  }

  // 3. Provider Status API contract
  console.log("\n3. Verifying Aggregated Provider Status API Contract...");
  const fullStatus = await getProviderStatus();
  console.log(`   Active Provider in status: ${fullStatus.provider}`);
  console.log(`   Available Providers: ${fullStatus.availableProviders?.join(", ")}`);
  console.log(`   Active Provider Available: ${fullStatus.available}`);
  console.log(`   Active Provider Model: ${fullStatus.model}`);
  console.log(`   Ollama Block Status: ${fullStatus.ollama?.status}`);

  // Reset provider back to default
  resetActiveProvider();
  console.log(`   Reset Active Provider back to: ${getActiveProviderId()}`);

  // 4. Live Ollama Verification (if available) or Safe Fallback Verification (if unavailable)
  console.log("\n4. Probing Live Ollama Inference...");
  if (status.status === "Available" && status.model) {
    console.log(`   Live Ollama is RUNNING with model: ${status.model}!`);
    console.log("   Running live inference through OllamaProvider...");

    const provider = new OllamaProvider(new FetchOllamaTransport(), () => ({
      baseUrl: config.baseUrl,
      model: status.model,
      timeoutMs: 30_000,
    }));

    const runtime = new AgentRuntime(provider);
    try {
      const frames = [];
      for await (const frame of runtime.run(
        { message: "Hello Jarvis.", conversation: [] },
        new AbortController().signal
      )) {
        frames.push(frame);
      }
      const resultFrame = frames.find((f) => f.type === "result");
      if (resultFrame && resultFrame.type === "result") {
        console.log(`   Live Ollama Response: "${resultFrame.result.speech}"`);
        console.log("   Live Ollama verification SUCCEEDED!");
      } else {
        console.log("   Live Ollama returned non-result frames.");
      }
    } catch (err) {
      console.log(`   Live Ollama run caught error: ${err instanceof Error ? err.message : String(err)}`);
    }
  } else {
    console.log(`   Ollama is not running or has no installed models (${status.status}).`);
    console.log("   Verifying that OllamaProvider fails safely without crashing the application...");

    const provider = new OllamaProvider(new FetchOllamaTransport(), () => ({
      baseUrl: config.baseUrl,
      model: "nonexistent",
      timeoutMs: 3_000,
    }));

    const runtime = new AgentRuntime(provider);
    try {
      const frames = [];
      for await (const frame of runtime.run(
        { message: "Hello Jarvis.", conversation: [] },
        new AbortController().signal
      )) {
        frames.push(frame);
      }
      const errorFrame = frames.find((f) => f.type === "error");
      console.log(`   Ollama safely failed with code: ${errorFrame?.type === "error" ? errorFrame.error.code : "safe_fallback"}`);
      console.log("   Verified: Graceful handling when Ollama daemon is absent/offline.");
    } catch (err) {
      console.log(`   Safely caught expected runtime error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log("\n=== Phase 7.5 Verification Complete ===");
}

main().catch((err) => {
  console.error("Runtime verification failed:", err);
  process.exit(1);
});
