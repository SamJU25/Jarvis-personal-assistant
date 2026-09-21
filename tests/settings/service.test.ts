import { describe, expect, it, vi, afterEach } from "vitest";
import { SettingsService } from "@/lib/settings/service";
import { HermesClient } from "@/lib/hermes/client";
import { FreeLLMAPIClient } from "@/lib/gateway/client";
import { HermesConfigUpdater } from "@/lib/hermes/config-updater";

describe("SettingsService", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("generates truthful snapshot with incrementing revisions", async () => {
    const mockHermes = new HermesClient({ baseUrl: "http://127.0.0.1:8642" });
    vi.spyOn(mockHermes, "getHealth").mockResolvedValue({
      status: "ok",
      version: "0.21.3",
      platform: "hermes-agent",
    });
    vi.spyOn(mockHermes, "getCapabilities").mockResolvedValue({
      capabilities: { tools: true, session: true },
    });
    vi.spyOn(mockHermes, "getSkills").mockResolvedValue({
      data: [{ name: "s1", description: "d1" }],
    });

    const mockGateway = new FreeLLMAPIClient();
    vi.spyOn(mockGateway, "probeHealth").mockResolvedValue({
      connected: true,
      statusText: "Healthy",
      modelsCount: 15,
      streamingSupported: true,
      toolCallingSupported: true,
      latencyMs: 12,
    });
    vi.spyOn(mockGateway, "listConfiguredProviders").mockResolvedValue([
      { id: "groq", name: "Groq", configured: true, health: "healthy", lastCheckedAt: new Date().toISOString() },
    ]);

    const service = new SettingsService({
      hermesClient: mockHermes,
      gatewayClient: mockGateway,
      hermesConfigUpdater: new HermesConfigUpdater(),
    });

    const snap1 = await service.getSnapshot(true);
    expect(snap1.hermes.status).toBe("connected");
    expect(snap1.hermes.version).toBe("0.21.3");
    expect(snap1.gateway.status).toBe("connected");
    expect(snap1.providers[0].name).toBe("Groq");

    const snap2 = await service.getSnapshot(true);
    expect(snap2.revision).toBeGreaterThan(snap1.revision);
  });

  it("emits events to subscribers when settings change", async () => {
    const service = new SettingsService();
    const receivedEvents: string[] = [];

    const unsub = service.subscribe((event) => {
      receivedEvents.push(event.type);
    });

    await service.getSnapshot(true);
    expect(receivedEvents).toContain("snapshot_updated");

    unsub();
  });
});
