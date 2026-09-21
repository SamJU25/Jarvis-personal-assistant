import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KokoroTTSProvider } from "@/lib/voice/kokoro-provider";
import type { KokoroConfig } from "@/lib/voice/config";

describe("Kokoro TTS Provider", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const baseConfig: KokoroConfig = {
    baseUrl: "http://localhost:8880",
    model: "kokoro",
    voice: "af_heart",
    speed: 1.0,
    timeoutMs: 5000,
  };

  it("synthesizes speech by posting JSON payload to /v1/audio/speech", async () => {
    const fakeAudioData = new Uint8Array([1, 2, 3, 4, 5]);

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "audio/wav" }),
      arrayBuffer: async () => fakeAudioData.buffer,
    });

    const provider = new KokoroTTSProvider(baseConfig);
    const result = await provider.synthesize("Hello, I am JARVIS.");

    expect(result.contentType).toBe("audio/wav");
    expect(result.audioBuffer).toEqual(Buffer.from(fakeAudioData.buffer));
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "http://localhost:8880/v1/audio/speech",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          model: "kokoro",
          input: "Hello, I am JARVIS.",
          voice: "af_heart",
          speed: 1.0,
          response_format: "wav",
        }),
      })
    );
  });

  it("supports voice and speed overrides", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "audio/wav" }),
      arrayBuffer: async () => new ArrayBuffer(8),
    });

    const provider = new KokoroTTSProvider(baseConfig);
    await provider.synthesize("Custom voice test", { voice: "am_adam", speed: 1.25 });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "http://localhost:8880/v1/audio/speech",
      expect.objectContaining({
        body: expect.stringContaining('"voice":"am_adam"'),
      })
    );
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "http://localhost:8880/v1/audio/speech",
      expect.objectContaining({
        body: expect.stringContaining('"speed":1.25'),
      })
    );
  });

  it("rejects empty text", async () => {
    const provider = new KokoroTTSProvider(baseConfig);
    await expect(provider.synthesize("   ")).rejects.toThrow(/empty text/);
  });

  it("handles unreachable Kokoro server safely", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));

    const provider = new KokoroTTSProvider(baseConfig);
    await expect(provider.synthesize("Hello")).rejects.toThrow(/Kokoro server unreachable/);
  });

  it("handles cancellation via AbortSignal", async () => {
    const controller = new AbortController();
    controller.abort();

    const provider = new KokoroTTSProvider(baseConfig);
    await expect(provider.synthesize("Hello", undefined, controller.signal)).rejects.toThrow(
      /cancelled/
    );
  });
});
