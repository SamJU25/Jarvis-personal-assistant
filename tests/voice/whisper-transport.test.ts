import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CliWhisperTransport,
  HttpWhisperTransport,
} from "@/lib/voice/whisper-transport";
import type { WhisperConfig } from "@/lib/voice/config";

describe("Whisper Transport", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const baseConfig: WhisperConfig = {
    baseUrl: "http://localhost:8080",
    language: "en",
    threads: 4,
    timeoutMs: 5000,
    transport: "http",
  };

  it("transcribes audio using OpenAI-compatible endpoint", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ text: "What did I write down about DeepSeek?" }),
    });

    const transport = new HttpWhisperTransport(baseConfig);
    const fakeAudio = Buffer.from("fake-audio-bytes");

    const result = await transport.transcribe(fakeAudio, "audio/wav");

    expect(result.transcript).toBe("What did I write down about DeepSeek?");
    expect(result.isFinal).toBe(true);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "http://localhost:8080/v1/audio/transcriptions",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("falls back to whisper.cpp /inference endpoint if /v1/audio/transcriptions is 404", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ text: "Hello world" }),
      });

    const transport = new HttpWhisperTransport(baseConfig);
    const fakeAudio = Buffer.from("fake-audio-bytes");

    const result = await transport.transcribe(fakeAudio, "audio/wav");

    expect(result.transcript).toBe("Hello world");
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    expect(globalThis.fetch).toHaveBeenLastCalledWith(
      "http://localhost:8080/inference",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("handles server unreachable safely", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));

    const transport = new HttpWhisperTransport(baseConfig);
    const fakeAudio = Buffer.from("fake-audio-bytes");

    await expect(transport.transcribe(fakeAudio, "audio/wav")).rejects.toThrow(
      /Whisper server unreachable/
    );
  });

  it("handles cancellation via AbortSignal", async () => {
    const controller = new AbortController();
    controller.abort();

    const transport = new HttpWhisperTransport(baseConfig);
    const fakeAudio = Buffer.from("fake-audio-bytes");

    await expect(
      transport.transcribe(fakeAudio, "audio/wav", controller.signal)
    ).rejects.toThrow(/cancelled/);
  });

  it("CliWhisperTransport throws error when executable is not configured", async () => {
    const cliConfig: WhisperConfig = {
      ...baseConfig,
      transport: "cli",
      executablePath: undefined,
    };
    const transport = new CliWhisperTransport(cliConfig);
    const fakeAudio = Buffer.from("fake-audio-bytes");

    await expect(transport.transcribe(fakeAudio, "audio/wav")).rejects.toThrow(
      /executable path is not configured/
    );
  });
});
