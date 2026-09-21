import { describe, expect, it } from "vitest";
import {
  checkKokoroStatus,
  checkWhisperStatus,
  getVoiceStatus,
  readKokoroConfig,
  readWhisperConfig,
} from "@/lib/voice/config";

describe("Voice Configuration", () => {
  it("uses safe default configuration for Whisper", () => {
    const config = readWhisperConfig({});
    expect(config.baseUrl).toBe("http://localhost:8080");
    expect(config.language).toBe("en");
    expect(config.threads).toBe(4);
    expect(config.transport).toBe("http");
  });

  it("uses safe default configuration for Kokoro", () => {
    const config = readKokoroConfig({});
    expect(config.baseUrl).toBe("http://localhost:8880");
    expect(config.model).toBe("kokoro");
    expect(config.voice).toBe("af_heart");
    expect(config.speed).toBe(1.0);
  });

  it("parses valid custom environment variables", () => {
    const env = {
      JARVIS_WHISPER_URL: "http://127.0.0.1:9000",
      JARVIS_WHISPER_LANGUAGE: "es",
      JARVIS_WHISPER_THREADS: "8",
      JARVIS_KOKORO_BASE_URL: "http://127.0.0.1:8880",
      JARVIS_KOKORO_MODEL: "kokoro-v1",
      JARVIS_KOKORO_VOICE: "am_adam",
      JARVIS_KOKORO_SPEED: "1.25",
    };

    const whisperConfig = readWhisperConfig(env);
    expect(whisperConfig.baseUrl).toBe("http://127.0.0.1:9000");
    expect(whisperConfig.language).toBe("es");
    expect(whisperConfig.threads).toBe(8);

    const kokoroConfig = readKokoroConfig(env);
    expect(kokoroConfig.baseUrl).toBe("http://127.0.0.1:8880");
    expect(kokoroConfig.model).toBe("kokoro-v1");
    expect(kokoroConfig.voice).toBe("am_adam");
    expect(kokoroConfig.speed).toBe(1.25);
  });

  it("rejects non-localhost URLs for Whisper (security boundary)", () => {
    expect(() =>
      readWhisperConfig({ JARVIS_WHISPER_URL: "https://api.openai.com/v1" })
    ).toThrow(/must be a valid local URL/);

    expect(() =>
      readWhisperConfig({ JARVIS_WHISPER_URL: "http://evil-external-server.com" })
    ).toThrow(/must be a valid local URL/);
  });

  it("rejects non-localhost URLs for Kokoro (security boundary)", () => {
    expect(() =>
      readKokoroConfig({ JARVIS_KOKORO_BASE_URL: "https://api.elevenlabs.io" })
    ).toThrow(/must be a valid local URL/);
  });

  it("rejects invalid thread numbers and speeds", () => {
    expect(() =>
      readWhisperConfig({ JARVIS_WHISPER_THREADS: "0" })
    ).toThrow(/JARVIS_WHISPER_THREADS/);

    expect(() =>
      readKokoroConfig({ JARVIS_KOKORO_SPEED: "10.0" })
    ).toThrow(/JARVIS_KOKORO_SPEED/);
  });

  it("truthfully reports status when endpoints are offline", async () => {
    const whisperStatus = await checkWhisperStatus({ baseUrl: "http://localhost:19999" });
    expect(["Unavailable", "Not configured"]).toContain(whisperStatus.status);

    const kokoroStatus = await checkKokoroStatus({ baseUrl: "http://localhost:19999" });
    expect(["Unavailable", "Not configured"]).toContain(kokoroStatus.status);

    const overall = await getVoiceStatus();
    expect(["Unavailable", "Not configured", "Partial", "Available"]).toContain(overall.status);
    expect(overall.microphone.status).toBe("Available");
    expect(overall.speaker.status).toBe("Available");
  });
});
