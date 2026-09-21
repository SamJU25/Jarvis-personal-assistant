import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { SettingsShell } from "@/components/settings/settings-shell";

class MockEventSource {
  addEventListener = vi.fn();
  removeEventListener = vi.fn();
  close = vi.fn();
  onerror = vi.fn();
}

describe("SettingsShell Component", () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).EventSource = MockEventSource;

    vi.spyOn(global, "fetch").mockImplementation(async (url) => {
      const urlStr = String(url);
      if (urlStr.includes("/api/settings/snapshot")) {
        return {
          ok: true,
          json: async () => ({
            hermes: {
              status: "connected",
              version: "0.21.3",
              baseUrl: "http://127.0.0.1:8642",
              sessionReadiness: "ready",
              runReadiness: "ready",
              capabilityCount: 12,
              skillCount: 4,
              delegationEnabled: false,
              lastCheckedAt: new Date().toISOString(),
            },
            gateway: {
              status: "connected",
              baseUrl: "http://127.0.0.1:3001/v1",
              routingStrategy: "Automatic: Balanced",
              streamingSupported: true,
              toolCallingSupported: true,
              lastCheckedAt: new Date().toISOString(),
              currentRoutedModel: "auto",
              currentRoutedProvider: "FreeLLMAPI",
              latencyMs: 35,
            },
            providers: [
              { id: "groq", name: "Groq", configured: true, health: "healthy", lastCheckedAt: new Date().toISOString() },
              { id: "google", name: "Google Gemini", configured: false, health: "not_configured", lastCheckedAt: new Date().toISOString() },
            ],
            obsidian: {
              status: "Connected",
              vaultLabel: "test-vault",
              noteCount: 8,
              lastCheckedAt: new Date().toISOString(),
            },
            voice: {
              whisper: "Available",
              kokoro: "Available",
              microphone: "Available",
            },
            revision: 1,
            updatedAt: new Date().toISOString(),
          }),
        } as unknown as Response;
      }

      return {
        ok: true,
        json: async () => ({ success: true, message: "OK" }),
      } as unknown as Response;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders SettingsShell control center with cards and truthful status", async () => {
    render(<SettingsShell />);

    expect(screen.getByText(/Control Center & Settings/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /Hermes Core/i })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: /Inference Gateway/i })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: /Obsidian Memory/i })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: /Provider Credentials/i })).toBeInTheDocument();
    });

    // Check action buttons exist
    expect(screen.getByRole("button", { name: /Test Connection/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Test Gateway/i })).toBeInTheDocument();
  });
});
