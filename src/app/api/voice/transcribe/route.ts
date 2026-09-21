import { type NextRequest, NextResponse } from "next/server";
import { createWhisperTransport } from "@/lib/voice/whisper-transport";

const MAX_AUDIO_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        { error: "Content-Type must be multipart/form-data" },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json(
        { error: "Missing audio file in multipart request under 'file'" },
        { status: 400 }
      );
    }

    if (file.size > MAX_AUDIO_SIZE_BYTES) {
      return NextResponse.json(
        { error: `Audio file exceeds maximum allowed size of ${MAX_AUDIO_SIZE_BYTES} bytes` },
        { status: 413 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);
    const mimeType = file.type || "audio/wav";

    const startMs = performance.now();
    const transport = createWhisperTransport();
    let result;
    try {
      result = await transport.transcribe(audioBuffer, mimeType, request.signal);
      const durationMs = Math.max(0, Math.round(performance.now() - startMs));
      const { getDiagnosticService } = await import("@/lib/diagnostics/service");
      getDiagnosticService().recordVoice({
        operation: "transcription",
        timing: {
          startedAt: new Date(Date.now() - durationMs).toISOString(),
          durationMs,
        },
        outcome: "success",
        interrupted: false,
        staleAudioDiscarded: false,
      });
    } catch (err) {
      const durationMs = Math.max(0, Math.round(performance.now() - startMs));
      const { getDiagnosticService } = await import("@/lib/diagnostics/service");
      getDiagnosticService().recordVoice({
        operation: "transcription",
        timing: {
          startedAt: new Date(Date.now() - durationMs).toISOString(),
          durationMs,
        },
        outcome: request.signal.aborted ? "cancelled" : "failure",
        interrupted: request.signal.aborted,
        staleAudioDiscarded: false,
        failure: request.signal.aborted
          ? undefined
          : {
              code: "unknown",
              message: err instanceof Error ? err.message : "Transcription failed",
              retryable: true,
              source: "runtime",
            },
      });
      throw err;
    }

    return NextResponse.json(result);
  } catch (error) {
    if (request.signal.aborted) {
      return NextResponse.json({ error: "Transcription cancelled" }, { status: 499 });
    }
    const message = error instanceof Error ? error.message : "Transcription failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
