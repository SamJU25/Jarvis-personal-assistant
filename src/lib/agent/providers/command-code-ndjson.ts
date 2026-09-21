import { z } from "zod";
import { AgentRuntimeError } from "@/lib/agent/errors";

const usageSchema = z.object({
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
}).passthrough();

const resultFrameSchema = z.object({
  type: z.literal("result"),
  subtype: z.enum(["success", "error", "max_turns"]),
  durationMs: z.number().int().nonnegative(),
  finalText: z.string(),
  usage: usageSchema,
}).passthrough();

const eventFrameSchema = z.object({
  type: z.literal("event"),
  event: z.object({ type: z.string() }).passthrough(),
}).passthrough();

export type CommandCodeFrame =
  | { kind: "model_started"; model?: string }
  | { kind: "result"; subtype: "success" | "error" | "max_turns"; durationMs: number; finalText: string; usage: { inputTokens: number; outputTokens: number } };

const MAX_LINE_BYTES = 256_000;

export async function* parseCommandCodeNdjson(chunks: AsyncIterable<Uint8Array | string>): AsyncGenerator<CommandCodeFrame> {
  const decoder = new TextDecoder();
  let buffer = "";
  let foundResult = false;

  for await (const chunk of chunks) {
    buffer += typeof chunk === "string" ? chunk : decoder.decode(chunk, { stream: true });
    if (buffer.length > MAX_LINE_BYTES && !buffer.includes("\n")) throw new AgentRuntimeError("malformed_output");
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const frame = parseLine(line);
      if (!frame) continue;
      if (frame.kind === "result") foundResult = true;
      yield frame;
    }
  }

  buffer += decoder.decode();
  if (buffer.trim()) {
    const frame = parseLine(buffer);
    if (frame) {
      if (frame.kind === "result") foundResult = true;
      yield frame;
    }
  }
  if (!foundResult) throw new AgentRuntimeError("no_response");
}

function parseLine(line: string): CommandCodeFrame | null {
  if (!line.trim()) return null;
  let value: unknown;
  try { value = JSON.parse(line); } catch { throw new AgentRuntimeError("malformed_output"); }
  const result = resultFrameSchema.safeParse(value);
  if (result.success) return { kind: "result", subtype: result.data.subtype, durationMs: result.data.durationMs, finalText: result.data.finalText, usage: { inputTokens: result.data.usage.inputTokens, outputTokens: result.data.usage.outputTokens } };
  const event = eventFrameSchema.safeParse(value);
  if (!event.success) throw new AgentRuntimeError("malformed_output");
  if (event.data.event.type === "model_request_start") {
    const model = typeof event.data.event.model === "string" ? event.data.event.model : undefined;
    return { kind: "model_started", model };
  }
  return null;
}
