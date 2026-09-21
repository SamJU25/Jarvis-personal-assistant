import { describe, expect, it } from "vitest";
import {
  systemStatusSnapshotSchema,
  providerKeyInputSchema,
  settingsEventSchema,
} from "@/lib/contracts/settings";

describe("Settings Contracts & Schemas", () => {
  it("validates a complete SystemStatusSnapshot", () => {
    const raw = {
      hermes: {
        status: "connected",
        version: "0.21.3",
        baseUrl: "http://127.0.0.1:8642",
        sessionReadiness: "ready",
        runReadiness: "ready",
        capabilityCount: 15,
        skillCount: 3,
        delegationEnabled: false,
        lastCheckedAt: new Date().toISOString(),
      },
      gateway: {
        status: "connected",
        baseUrl: "http://127.0.0.1:3001/v1",
        routingStrategy: "automatic (balanced)",
        streamingSupported: true,
        toolCallingSupported: true,
        lastCheckedAt: new Date().toISOString(),
        currentRoutedModel: "auto",
        currentRoutedProvider: "FreeLLMAPI",
        latencyMs: 42,
      },
      providers: [
        {
          id: "groq",
          name: "Groq",
          configured: true,
          health: "healthy",
          lastCheckedAt: new Date().toISOString(),
        },
      ],
      obsidian: {
        status: "Connected",
        vaultLabel: "test-vault",
        noteCount: 12,
        lastCheckedAt: new Date().toISOString(),
      },
      voice: {
        whisper: "Available",
        kokoro: "Available",
        microphone: "Available",
      },
      revision: 4,
      updatedAt: new Date().toISOString(),
    };

    const parsed = systemStatusSnapshotSchema.safeParse(raw);
    expect(parsed.success).toBe(true);
  });

  it("validates provider key input and rejects empty values", () => {
    const valid = providerKeyInputSchema.safeParse({
      platform: "groq",
      key: "gsk_1234567890abcdef",
      label: "main",
    });
    expect(valid.success).toBe(true);

    const emptyKey = providerKeyInputSchema.safeParse({
      platform: "groq",
      key: "   ",
    });
    expect(emptyKey.success).toBe(false);
  });

  it("validates settingsEventSchema discriminated union", () => {
    const applyEvent = settingsEventSchema.safeParse({
      type: "apply_state_changed",
      state: "applying",
      message: "Updating Hermes config",
      timestamp: new Date().toISOString(),
    });
    expect(applyEvent.success).toBe(true);
  });
});
