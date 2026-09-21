import { NextRequest } from "next/server";
import { getAgentEventBus } from "@/lib/agent/event-bus";
import type { AgentApiFrame } from "@/lib/contracts/agent-api";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const runId = searchParams.get("runId");

  if (!runId || !runId.trim()) {
    return new Response(JSON.stringify({ error: "Missing required runId parameter" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const bus = getAgentEventBus();
  const encoder = new TextEncoder();

  let keepaliveTimer: NodeJS.Timeout | undefined;
  let unsubscribe: (() => void) | undefined;

  const stream = new ReadableStream({
    start(controller) {
      // 1. Initial connection ack
      controller.enqueue(encoder.encode(": connected\n\n"));

      // 2. Subscribe to event bus for this runId
      unsubscribe = bus.subscribe(runId, (frame: AgentApiFrame) => {
        try {
          const payload = `event: agent_frame\ndata: ${JSON.stringify(frame)}\n\n`;
          controller.enqueue(encoder.encode(payload));

          if (frame.type === "result" || frame.type === "error") {
            clearInterval(keepaliveTimer);
            // Allow client to receive final frame before closing
            setTimeout(() => {
              try {
                controller.close();
              } catch {
                // already closed
              }
            }, 50);
          }
        } catch {
          // stream might be closed
        }
      });

      // 3. Keepalive ping every 15s to prevent HTTP idle timeouts
      keepaliveTimer = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        } catch {
          clearInterval(keepaliveTimer);
        }
      }, 15000);
    },
    cancel() {
      if (keepaliveTimer) clearInterval(keepaliveTimer);
      if (unsubscribe) unsubscribe();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
