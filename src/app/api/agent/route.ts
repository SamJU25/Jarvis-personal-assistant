import { AgentRuntime } from "@/lib/agent/runtime";
import { getActiveProvider } from "@/lib/agent/providers/active-provider";
import { agentApiFrameSchema, agentApiRequestSchema } from "@/lib/contracts/agent-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON request." }, { status: 400 }); }
  const parsed = agentApiRequestSchema.strict().safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid agent request." }, { status: 400 });

  const controller = new AbortController();
  const abort = () => controller.abort();
  request.signal.addEventListener("abort", abort, { once: true });
  const iterator = new AgentRuntime(
    getActiveProvider(),
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    { enableFastPath: true }
  ).run(parsed.data, controller.signal);
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async pull(streamController) {
      const next = await iterator.next();
      if (next.done) {
        request.signal.removeEventListener("abort", abort);
        streamController.close();
        return;
      }
      const frame = agentApiFrameSchema.parse(next.value);
      streamController.enqueue(encoder.encode(`${JSON.stringify(frame)}\n`));
    },
    async cancel() {
      controller.abort();
      await iterator.return(undefined);
      request.signal.removeEventListener("abort", abort);
    },
  });

  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}
