import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { FreeLLMAPIClient } from "@/lib/gateway/client";

describe("FreeLLMAPIClient & Declarative Config", () => {
  let tempDir: string;
  let configPath: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "freellmapi-test-"));
    configPath = path.join(tempDir, "freellmapi.config.json");
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(tempDir, { recursive: true, force: true });
  });

  it("handles offline gateway truthfully when probeHealth is called", async () => {
    const client = new FreeLLMAPIClient({
      baseUrl: "http://127.0.0.1:9999/v1",
      configPath,
    });

    const result = await client.probeHealth();
    expect(result.connected).toBe(false);
    expect(result.statusText).toContain("unavailable");
  });

  it("loads and saves declarative config idempotently", async () => {
    const client = new FreeLLMAPIClient({
      baseUrl: "http://127.0.0.1:3001/v1",
      configPath,
    });

    await client.setProviderKey("groq", "gsk_test_123", "primary");
    const providers = await client.listConfiguredProviders();

    const groq = providers.find((p) => p.id === "groq");
    expect(groq?.configured).toBe(true);

    const google = providers.find((p) => p.id === "google");
    expect(google?.configured).toBe(false);

    // Update key for same platform (idempotency check)
    await client.setProviderKey("groq", "gsk_updated_456");
    const config = await client.loadDeclarativeConfig();
    const groqEntries = config.keys.filter((k) => k.platform === "groq");
    expect(groqEntries.length).toBe(1);
    expect(groqEntries[0].key).toBe("gsk_updated_456");
  });

  it("never returns raw API keys in listConfiguredProviders", async () => {
    const client = new FreeLLMAPIClient({
      baseUrl: "http://127.0.0.1:3001/v1",
      configPath,
    });

    await client.setProviderKey("google", "AIzaSySecretApiKey123");
    const providers = await client.listConfiguredProviders();

    const str = JSON.stringify(providers);
    expect(str).not.toContain("AIzaSySecretApiKey123");
  });
});
