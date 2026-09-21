import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { GET as getVoiceStatusRoute } from "@/app/api/voice/status/route";
import { POST as transcribeRoute } from "@/app/api/voice/transcribe/route";
import { POST as synthesizeRoute } from "@/app/api/voice/synthesize/route";
import * as whisperModule from "@/lib/voice/whisper-transport";
import * as kokoroModule from "@/lib/voice/kokoro-provider";

describe("Voice API Routes", () => {
  describe("GET /api/voice/status", () => {
    it("returns voice status json with 200", async () => {
      const response = await getVoiceStatusRoute();
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json).toHaveProperty("status");
      expect(json).toHaveProperty("whisper");
      expect(json).toHaveProperty("kokoro");
      expect(json).toHaveProperty("microphone");
      expect(json).toHaveProperty("speaker");
    });
  });

  describe("POST /api/voice/transcribe", () => {
    it("rejects non-multipart requests with 400", async () => {
      const request = new NextRequest("http://localhost/api/voice/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio: "base64" }),
      });

      const response = await transcribeRoute(request);
      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toContain("multipart/form-data");
    });

    it("rejects requests missing the file parameter with 400", async () => {
      const formData = new FormData();
      formData.append("otherField", "test");

      const request = new NextRequest("http://localhost/api/voice/transcribe", {
        method: "POST",
        body: formData,
      });

      const response = await transcribeRoute(request);
      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toContain("Missing audio file");
    });

    it("transcribes audio file and returns transcript", async () => {
      vi.spyOn(whisperModule, "createWhisperTransport").mockReturnValue({
        transcribe: vi.fn().mockResolvedValue({
          transcript: "What time is it?",
          isFinal: true,
          durationMs: 42,
        }),
      });

      const formData = new FormData();
      const audioBlob = new Blob([new Uint8Array([1, 2, 3, 4])], { type: "audio/wav" });
      formData.append("file", audioBlob, "recording.wav");

      const request = {
        headers: new Headers({ "content-type": "multipart/form-data" }),
        formData: vi.fn().mockResolvedValue(formData),
        signal: new AbortController().signal,
      } as unknown as NextRequest;

      const response = await transcribeRoute(request);
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.transcript).toBe("What time is it?");
      expect(json.isFinal).toBe(true);
      expect(json.durationMs).toBe(42);
    });
  });

  describe("POST /api/voice/synthesize", () => {
    it("rejects invalid request bodies with 400", async () => {
      const request = new NextRequest("http://localhost/api/voice/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const response = await synthesizeRoute(request);
      expect(response.status).toBe(400);
    });

    it("rejects empty text with 400", async () => {
      const request = new NextRequest("http://localhost/api/voice/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "   " }),
      });

      const response = await synthesizeRoute(request);
      expect(response.status).toBe(400);
    });

    it("synthesizes speech and returns binary audio response", async () => {
      const fakeAudio = Buffer.from([10, 20, 30, 40]);
      vi.spyOn(kokoroModule, "createKokoroProvider").mockReturnValue({
        id: "kokoro",
        name: "Kokoro TTS",
        synthesize: vi.fn().mockResolvedValue({
          audioBuffer: fakeAudio,
          contentType: "audio/wav",
        }),
      } as unknown as kokoroModule.KokoroTTSProvider);

      const request = new NextRequest("http://localhost/api/voice/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "The current time is 3:00 PM." }),
      });

      const response = await synthesizeRoute(request);
      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("audio/wav");

      const arrayBuf = await response.arrayBuffer();
      expect(Buffer.from(arrayBuf)).toEqual(fakeAudio);
    });
  });
});
