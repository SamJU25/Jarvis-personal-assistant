import { describe, expect, it } from "vitest";
import { parseCommandCodeNdjson } from "@/lib/agent/providers/command-code-ndjson";

async function* chunks(...values: (string | Uint8Array)[]) { for (const value of values) yield value; }
async function collect(values: AsyncIterable<unknown>) { const result = []; for await (const value of values) result.push(value); return result; }

const result = JSON.stringify({ type: "result", subtype: "success", sessionId: "secret", stopReason: "end_turn", usage: { inputTokens: 12, outputTokens: 4, cacheReadTokens: 2 }, durationMs: 42, finalText: "{}" });

describe("Command Code NDJSON parser", () => {
  it("parses split chunks and keeps only normalized fields", async () => {
    const event = JSON.stringify({ type: "event", event: { type: "model_request_start", model: "provider/model", traceId: "secret" } });
    const output = await collect(parseCommandCodeNdjson(chunks(event.slice(0, 17), `${event.slice(17)}\n${result}\n`)));
    expect(output).toEqual([
      { kind: "model_started", model: "provider/model" },
      { kind: "result", subtype: "success", durationMs: 42, finalText: "{}", usage: { inputTokens: 12, outputTokens: 4 } },
    ]);
    expect(JSON.stringify(output)).not.toContain("secret");
  });

  it("ignores unknown event types while requiring a final result", async () => {
    const unknown = JSON.stringify({ type: "event", event: { type: "future_event", raw: "private" } });
    expect(await collect(parseCommandCodeNdjson(chunks(`${unknown}\n${result}`)))).toHaveLength(1);
  });

  it.each([
    ["invalid JSON", "not-json\n"],
    ["invalid frame", `${JSON.stringify({ type: "other" })}\n`],
    ["missing result", `${JSON.stringify({ type: "event", event: { type: "run_start" } })}\n`],
    ["oversized line", "x".repeat(256_001)],
  ])("rejects %s", async (_, value) => {
    await expect(collect(parseCommandCodeNdjson(chunks(value)))).rejects.toThrow();
  });

  it.each(["error", "max_turns"] as const)("parses %s result subtype", async (subtype) => {
    const frame = JSON.stringify({ type: "result", subtype, usage: { inputTokens: 0, outputTokens: 0 }, durationMs: 10, finalText: "" });
    expect(await collect(parseCommandCodeNdjson(chunks(frame)))).toEqual([expect.objectContaining({ kind: "result", subtype })]);
  });
});
