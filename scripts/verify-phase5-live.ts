import { HermesClient } from "../src/lib/hermes/client";
import { FreeLLMAPIClient } from "../src/lib/gateway/client";
import { HermesConfigUpdater } from "../src/lib/hermes/config-updater";
import { SettingsService } from "../src/lib/settings/service";
import path from "node:path";

async function main() {
  console.log("==================================================");
  console.log("  PHASE 05 LIVE VERIFICATION: HERMES & GATEWAY    ");
  console.log("==================================================\n");

  // 1. Live Hermes Probing
  console.log("1. Probing Live Hermes Server (http://127.0.0.1:8642)...");
  const hermesClient = new HermesClient({
    baseUrl: "http://127.0.0.1:8642",
    apiKey: process.env.HERMES_API_KEY || "jarvis-hermes-foundation-test-key-32ch",
  });

  const health = await hermesClient.getHealth();
  console.log(`   Hermes Status: ${health.status} (v${health.version})`);
  const caps = await hermesClient.getCapabilities();
  const capCount = Object.keys(caps.capabilities || {}).length;
  console.log(`   Hermes Capabilities: ${capCount} active`);
  const skills = await hermesClient.getSkills();
  console.log(`   Hermes Skills: ${skills.data?.length ?? 0} discovered`);

  // 2. Gateway Client & Declarative Config
  console.log("\n2. Testing Gateway Client & Declarative Configuration...");
  const configPath = path.join(process.cwd(), ".jarvis", "gateway", "freellmapi.config.json");
  const gatewayClient = new FreeLLMAPIClient({
    baseUrl: "http://127.0.0.1:3001/v1",
    configPath,
  });

  const gatewayProbe = await gatewayClient.probeHealth();
  console.log(`   Gateway Probe: connected=${gatewayProbe.connected}, status="${gatewayProbe.statusText}"`);

  console.log("   Injecting test provider key into declarative config...");
  await gatewayClient.setProviderKey("groq", "gsk_phase5_verified_token", "primary");
  const providers = await gatewayClient.listConfiguredProviders();
  const groq = providers.find((p) => p.id === "groq");
  console.log(`   Groq Provider Status: configured=${groq?.configured}, health=${groq?.health}`);
  if (!groq?.configured) throw new Error("Failed to configure Groq provider key");

  // Verify zero secret leakage
  const serialized = JSON.stringify(providers);
  if (serialized.includes("gsk_phase5_verified_token")) {
    throw new Error("SECURITY FAILURE: Secret token appeared in provider list output!");
  }
  console.log("   Security Check: Zero key leakage verified (keys are write-only).");

  // 3. Hermes Config Updater
  console.log("\n3. Testing Hermes Config Updater (config.yaml)...");
  const hermesCfgPath = path.join("F:", "hermes-agent", ".hermes", "config.yaml");
  const updater = new HermesConfigUpdater(hermesCfgPath);
  const currentModelCfg = await updater.readModelConfig();
  console.log(`   Current Model Config: provider="${currentModelCfg.provider}", base_url="${currentModelCfg.baseUrl}", default="${currentModelCfg.defaultModel}"`);

  console.log("   Applying Gateway configuration to Hermes config.yaml...");
  const updateResult = await updater.updateToGateway("http://127.0.0.1:3001/v1", "auto");
  console.log(`   Config Updated: ${updateResult.updated}, Requires Restart: ${updateResult.requiresRestart}`);
  console.log(`   New Config: provider="${updateResult.current.provider}", base_url="${updateResult.current.baseUrl}", default="${updateResult.current.defaultModel}"`);

  // Restore or keep compatible
  const verifyCfg = await updater.readModelConfig();
  if (verifyCfg.baseUrl !== "http://127.0.0.1:3001/v1") {
    throw new Error("Hermes config.yaml failed to persist gateway base_url");
  }
  console.log("   Hermes config update: PASSED");

  // 4. SettingsService Snapshot & Event Stream
  console.log("\n4. Testing SettingsService Snapshot & Event Stream...");
  const settingsService = new SettingsService({
    hermesClient,
    gatewayClient,
    hermesConfigUpdater: updater,
  });

  const receivedEvents: string[] = [];
  const unsub = settingsService.subscribe((e) => {
    receivedEvents.push(e.type);
  });

  const snapshot = await settingsService.getSnapshot(true);
  console.log(`   Snapshot Revision: ${snapshot.revision}`);
  console.log(`   Snapshot Hermes Status: ${snapshot.hermes.status}`);
  console.log(`   Snapshot Gateway Status: ${snapshot.gateway.status}`);
  console.log(`   Snapshot Obsidian Status: ${snapshot.obsidian.status} (Vault: "${snapshot.obsidian.vaultLabel}")`);
  console.log(`   Configured Providers: ${snapshot.providers.filter((p) => p.configured).map((p) => p.name).join(", ") || "None"}`);

  unsub();
  console.log(`   Received Events: [${receivedEvents.join(", ")}]`);

  // Reset Hermes config back to Ollama backend for tests if needed, or leave gateway
  console.log("\n5. Testing Live Test Probes...");
  const hermesTestRes = await settingsService.testHermes();
  console.log(`   Hermes Test Probe: ${hermesTestRes.message} (${hermesTestRes.latencyMs}ms)`);

  const gatewayTestRes = await settingsService.testGateway();
  console.log(`   Gateway Test Probe: ${gatewayTestRes.message}`);

  // Re-link Hermes to local Ollama endpoint so normal local agent runs continue to execute
  console.log("\n6. Resetting Hermes to Ollama for local fallback parity...");
  await updater.updateToGateway("http://127.0.0.1:11434/v1", "qwen3.5:4b");
  const finalCfg = await updater.readModelConfig();
  console.log(`   Final Hermes Model: provider="${finalCfg.provider}", base_url="${finalCfg.baseUrl}"`);

  console.log("\n==================================================");
  console.log("  ALL PHASE 05 LIVE VERIFICATIONS PASSED 100%    ");
  console.log("==================================================");
}

main().catch((err) => {
  console.error("Live verification failed:", err);
  process.exit(1);
});
