import { type NextRequest, NextResponse } from "next/server";
import { synthesisRequestSchema } from "@/lib/contracts/voice";
import { createKokoroProvider } from "@/lib/voice/kokoro-provider";

export async function POST(request: NextRequest) {
  try {
    const json = await request.json().catch(() => null);
    const parsed = synthesisRequestSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid synthesis request", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { text, voice, speed } = parsed.data;
    const startMs = performance.now();
    const provider = createKokoroProvider();
    let result;
    try {
      result = await provider.synthesize(text, { voice, speed }, request.signal);
      const durationMs = Math.max(0, Math.round(performance.now() - startMs));
      const { getDiagnosticService } = await import("@/lib/diagnostics/service");
      getDiagnosticService().recordVoice({
        operation: "synthesis",
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
        operation: "synthesis",
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
              message: err instanceof Error ? err.message : "Synthesis failed",
              retryable: true,
              source: "runtime",
            },
      });
      throw err;
    }

    return new Response(new Uint8Array(result.audioBuffer), {
      status: 200,
      headers: {
        "Content-Type": result.contentType,
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Content-Length": String(result.audioBuffer.length),
      },
    });
  } catch (error) {
    if (request.signal.aborted) {
      return new Response("Synthesis cancelled", { status: 499 });
    }
    const message = error instanceof Error ? error.message : "Synthesis failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
