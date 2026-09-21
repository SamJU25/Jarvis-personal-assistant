import { getSettingsService } from "@/lib/settings/service";
import type { SettingsEvent } from "@/lib/contracts/settings";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const service = getSettingsService();
  const encoder = new TextEncoder();

  let unsubscribe: (() => void) | null = null;
  let heartbeatTimer: NodeJS.Timeout | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      // Send initial connect frame
      controller.enqueue(encoder.encode(": connected\n\n"));

      unsubscribe = service.subscribe((event: SettingsEvent) => {
        try {
          const payload = JSON.stringify(event);
          controller.enqueue(encoder.encode(`event: ${event.type}\ndata: ${payload}\n\n`));
        } catch {
          // Stream error or client disconnect
        }
      });

      // Keepalive heartbeat every 15 seconds
      heartbeatTimer = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        } catch {
          // Closed
        }
      }, 15000);

      // Immediately send current snapshot as first event
      service.getSnapshot().then((snapshot) => {
        try {
          const initialEvent: SettingsEvent = {
            type: "snapshot_updated",
            snapshot,
            timestamp: new Date().toISOString(),
          };
          controller.enqueue(
            encoder.encode(`event: snapshot_updated\ndata: ${JSON.stringify(initialEvent)}\n\n`)
          );
        } catch {
          // Closed
        }
      }).catch(() => {});
    },
    cancel() {
      if (unsubscribe) unsubscribe();
      if (heartbeatTimer) clearInterval(heartbeatTimer);
    },
  });

  request.signal.addEventListener("abort", () => {
    if (unsubscribe) unsubscribe();
    if (heartbeatTimer) clearInterval(heartbeatTimer);
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
