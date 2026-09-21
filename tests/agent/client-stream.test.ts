import { describe, expect, it } from "vitest";
import { readAgentFrames } from "@/lib/agent/client-stream";

function stream(...chunks: string[]) { return new ReadableStream({ start(controller) { for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk)); controller.close(); } }); }
async function collect(input: ReadableStream<Uint8Array>) { const frames = []; for await (const frame of readAgentFrames(input)) frames.push(frame); return frames; }
const event = JSON.stringify({ type: "event", event: { id: "1", type: "agent_started", timestamp: "now", label: "Started" } });

describe("agent client stream", () => {
  it("parses frames split across chunks", async () => {
    expect(await collect(stream(event.slice(0, 9), `${event.slice(9)}\n`))).toHaveLength(1);
  });
  it("rejects raw or malformed frames", async () => {
    await expect(collect(stream(`${JSON.stringify({ type: "event", event: { type: "run_start" } })}\n`))).rejects.toThrow("stream was invalid");
  });
});
