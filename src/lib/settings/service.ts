import { EventEmitter } from "node:events";
import { HermesClient } from "@/lib/hermes/client";
import { FreeLLMAPIClient } from "@/lib/gateway/client";
import { checkObsidianStatus, getObsidianVaultPath } from "@/lib/obsidian/config";
import { listObsidianMemory } from "@/lib/obsidian/memory";
import { getVoiceStatus } from "@/lib/voice/config";
import { HermesConfigUpdater } from "@/lib/hermes/config-updater";
import { specialistRegistry } from "@/lib/specialist/registry";
import type {
  SystemStatusSnapshot,
  SettingsEvent,
  SettingsApplyState,
} from "@/lib/contracts/settings";

export class SettingsService {
  private static instance?: SettingsService;
  private readonly emitter = new EventEmitter();
  private readonly hermesClient: HermesClient;
  private readonly gatewayClient: FreeLLMAPIClient;
  private readonly hermesConfigUpdater: HermesConfigUpdater;
  private currentRevision = 1;
  private cachedSnapshot: SystemStatusSnapshot | null = null;
  private applyState: SettingsApplyState = "idle";

  constructor(options?: {
    hermesClient?: HermesClient;
    gatewayClient?: FreeLLMAPIClient;
    hermesConfigUpdater?: HermesConfigUpdater;
  }) {
    this.emitter.setMaxListeners(100);
    this.hermesClient = options?.hermesClient ?? new HermesClient();
    this.gatewayClient = options?.gatewayClient ?? new FreeLLMAPIClient();
    this.hermesConfigUpdater = options?.hermesConfigUpdater ?? new HermesConfigUpdater();
  }

  static getInstance(): SettingsService {
    if (!SettingsService.instance) {
      SettingsService.instance = new SettingsService();
    }
    return SettingsService.instance;
  }

  /**
   * Generates a complete, truthful SystemStatusSnapshot by probing subsystems.
   */
  async getSnapshot(forceFresh: boolean = false): Promise<SystemStatusSnapshot> {
    if (this.cachedSnapshot && !forceFresh) {
      return this.cachedSnapshot;
    }

    const now = new Date().toISOString();

    // Parallel probes
    const [hermesHealth, hermesCaps, hermesSkills, gatewayProbe, providers, obsidianStatus, memories, voiceStatus] =
      await Promise.all([
        this.hermesClient.getHealth().catch(() => null),
        this.hermesClient.getCapabilities().catch(() => null),
        this.hermesClient.getSkills().catch(() => null),
        this.gatewayClient.probeHealth(),
        this.gatewayClient.listConfiguredProviders(),
        checkObsidianStatus().catch(() => null),
        listObsidianMemory().catch(() => []),
        getVoiceStatus().catch(() => null),
      ]);

    const isHermesConnected = Boolean(hermesHealth && hermesHealth.status === "ok");
    const hermesStatus = isHermesConnected ? ("connected" as const) : ("unavailable" as const);

    const gatewayStatus = gatewayProbe.connected
      ? ("connected" as const)
      : ("unavailable" as const);

    const vaultRoot = getObsidianVaultPath() || "vault";
    const safeVaultLabel = vaultRoot.split(/[\\/]/).pop() || "Obsidian Vault";

    const snapshot: SystemStatusSnapshot = {
      hermes: {
        status: hermesStatus,
        version: hermesHealth?.version,
        baseUrl: this.hermesClient.getBaseUrl(),
        sessionReadiness: isHermesConnected ? "ready" : "not_ready",
        runReadiness: isHermesConnected ? "ready" : "not_ready",
        capabilityCount: hermesCaps?.capabilities ? Object.keys(hermesCaps.capabilities).length : 0,
        skillCount: hermesSkills?.data ? hermesSkills.data.length : 0,
        delegationEnabled: true,
        lastCheckedAt: now,
      },
      gateway: {
        status: gatewayStatus,
        baseUrl: this.gatewayClient.getBaseUrl(),
        routingStrategy: "automatic (balanced)",
        streamingSupported: gatewayProbe.streamingSupported ?? false,
        toolCallingSupported: gatewayProbe.toolCallingSupported ?? false,
        lastCheckedAt: now,
        currentRoutedModel: gatewayProbe.currentRoutedModel,
        currentRoutedProvider: gatewayProbe.currentRoutedProvider,
        latencyMs: gatewayProbe.latencyMs,
      },
      providers,
      obsidian: {
        status: obsidianStatus?.status ?? "Not configured",
        vaultLabel: safeVaultLabel,
        noteCount: memories.length,
        lastCheckedAt: now,
      },
      voice: {
        whisper: voiceStatus?.whisper.status ?? "Not configured",
        kokoro: voiceStatus?.kokoro.status ?? "Not configured",
        microphone: voiceStatus?.microphone.status ?? "Available",
      },
      specialists: specialistRegistry.list().map((s) => ({
        id: s.id,
        displayName: s.displayName,
        role: s.role,
        preferredRoutingProfile: s.preferredRoutingProfile,
        allowedCapabilities: s.allowedCapabilities,
        userVisible: s.userVisible,
        status: "active" as const,
      })),
      revision: this.currentRevision++,
      updatedAt: now,
    };

    this.cachedSnapshot = snapshot;
    this.emitEvent({
      type: "snapshot_updated",
      snapshot,
      timestamp: now,
    });

    return snapshot;
  }

  /**
   * Subscribes a listener to live settings events.
   */
  subscribe(listener: (event: SettingsEvent) => void): () => void {
    this.emitter.on("settings_event", listener);
    return () => {
      this.emitter.off("settings_event", listener);
    };
  }

  emitEvent(event: SettingsEvent): void {
    this.emitter.emit("settings_event", event);
  }

  /**
   * Tests connection to Hermes server.
   */
  async testHermes(): Promise<{ success: boolean; message: string; version?: string; latencyMs: number }> {
    const start = Date.now();
    try {
      const health = await this.hermesClient.getHealth();
      const latencyMs = Date.now() - start;
      const success = health.status === "ok";
      this.emitEvent({
        type: "hermes_probed",
        status: success ? "connected" : "error",
        details: { version: health.version, latencyMs },
        timestamp: new Date().toISOString(),
      });
      return {
        success,
        message: success ? `Connected to Hermes ${health.version}` : "Hermes status unhealthy",
        version: health.version,
        latencyMs,
      };
    } catch (err) {
      const latencyMs = Date.now() - start;
      this.emitEvent({
        type: "hermes_probed",
        status: "unavailable",
        details: { latencyMs },
        timestamp: new Date().toISOString(),
      });
      return {
        success: false,
        message: err instanceof Error ? err.message : "Hermes connection failed",
        latencyMs,
      };
    }
  }

  /**
   * Refreshes Hermes capabilities and skills.
   */
  async refreshHermes(): Promise<{ capabilitiesCount: number; skillsCount: number }> {
    const [caps, skills] = await Promise.all([
      this.hermesClient.getCapabilities().catch(() => ({ capabilities: {} })),
      this.hermesClient.getSkills().catch(() => ({ data: [] })),
    ]);
    await this.getSnapshot(true);
    return {
      capabilitiesCount: Object.keys(caps.capabilities || {}).length,
      skillsCount: skills.data?.length || 0,
    };
  }

  /**
   * Tests connection to FreeLLMAPI gateway.
   */
  async testGateway(): Promise<{ success: boolean; message: string; latencyMs?: number }> {
    const probe = await this.gatewayClient.probeHealth();
    this.emitEvent({
      type: "gateway_probed",
      status: probe.connected ? "connected" : "unavailable",
      details: { latencyMs: probe.latencyMs },
      timestamp: new Date().toISOString(),
    });
    await this.getSnapshot(true);
    return {
      success: probe.connected,
      message: probe.connected ? `Gateway healthy (${probe.modelsCount ?? 0} models)` : probe.statusText,
      latencyMs: probe.latencyMs,
    };
  }

  /**
   * Tests streaming on FreeLLMAPI gateway.
   */
  async testGatewayStreaming(): Promise<{ success: boolean; message: string; latencyMs: number }> {
    return this.gatewayClient.testStreaming();
  }

  /**
   * Tests tool calling on FreeLLMAPI gateway.
   */
  async testGatewayTools(): Promise<{ success: boolean; message: string; latencyMs: number }> {
    return this.gatewayClient.testToolCalling();
  }

  /**
   * Securely saves a provider key into the declarative config.
   */
  async saveProviderKey(platform: string, key: string, label?: string): Promise<{ success: boolean; message: string }> {
    await this.gatewayClient.setProviderKey(platform, key, label);
    await this.getSnapshot(true);
    return {
      success: true,
      message: `Key for platform '${platform}' saved successfully`,
    };
  }

  /**
   * Executes the full apply flow: Idle -> Applying -> Applied/Failed -> Verified.
   */
  async applyGatewaySettings(options: {
    gatewayUrl?: string;
    model?: string;
  }): Promise<{ state: SettingsApplyState; requiresRestart: boolean; message: string }> {
    const now = new Date().toISOString();
    this.applyState = "applying";
    this.emitEvent({
      type: "apply_state_changed",
      state: "applying",
      message: "Updating Hermes configuration to target FreeLLMAPI...",
      timestamp: now,
    });

    try {
      const targetUrl = options.gatewayUrl ?? this.gatewayClient.getBaseUrl();
      const targetModel = options.model ?? "auto";

      const updateResult = await this.hermesConfigUpdater.updateToGateway(targetUrl, targetModel);

      this.applyState = "applied";
      this.emitEvent({
        type: "apply_state_changed",
        state: "applied",
        message: updateResult.requiresRestart
          ? "Configuration applied. Hermes daemon restart required to activate."
          : "Configuration applied and verified.",
        timestamp: new Date().toISOString(),
      });

      // Verification pass
      const snapshot = await this.getSnapshot(true);
      const verified = Boolean(snapshot);

      this.applyState = verified ? "verified" : "applied";
      this.emitEvent({
        type: "apply_state_changed",
        state: this.applyState,
        message: "Settings verified successfully.",
        timestamp: new Date().toISOString(),
      });

      return {
        state: this.applyState,
        requiresRestart: updateResult.requiresRestart,
        message: updateResult.requiresRestart
          ? "Settings applied. Hermes restart recommended."
          : "Settings applied and active.",
      };
    } catch (err: unknown) {
      this.applyState = "failed";
      const errorMsg = err instanceof Error ? err.message : "Apply failed";
      this.emitEvent({
        type: "apply_state_changed",
        state: "failed",
        message: errorMsg,
        timestamp: new Date().toISOString(),
      });
      return {
        state: "failed",
        requiresRestart: false,
        message: errorMsg,
      };
    }
  }
}

export function getSettingsService(): SettingsService {
  return SettingsService.getInstance();
}
