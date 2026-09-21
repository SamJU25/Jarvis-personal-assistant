import { describe, expect, it, vi } from "vitest";
import { CommandCodeProvider } from "@/lib/agent/providers/command-code-provider";
import type { CommandCodeTransport } from "@/lib/agent/transport";
import type { AgentRequest } from "@/lib/contracts/provider";

const validResult = JSON.stringify({ speech: "Hello.", title: "Greeting", state: "complete", cards: [{ id: "response", type: "generic", label: "Response", title: "Hello", body: "Ready." }], sources: [] });
const config = { nodeExecutable: "node", commandCodeEntry: "C:\\command-code\\dist\\index.mjs", timeoutMs: 5000, maxTurns: 2 };
const request: AgentRequest = { requestId: "run-1", request: "Hello Jarvis.", conversation: [], systemInstructions: "server", requiredOutput: "json", availableTools: [], availableSkills: [], signal: new AbortController().signal };

function fakeTransport(lines: string[], exitCode = 0): CommandCodeTransport {
  return { start: vi.fn(async () => ({ stdout: (async function* () { yield new TextEncoder().encode(lines.join("\n")); })(), exit: Promise.resolve(exitCode), cancel: vi.fn(async () => {}) })) };
}

describe("CommandCodeProvider", () => {
  it("normalizes events and validates the final result", async () => {
    const transport = fakeTransport([
      JSON.stringify({ type: "event", event: { type: "model_request_start", model: "provider/model", traceId: "private" } }),
      JSON.stringify({ type: "result", subtype: "success", sessionId: "private", usage: { inputTokens: 10, outputTokens: 5 }, durationMs: 25, finalText: validResult }),
    ]);
    const run = await new CommandCodeProvider(transport, () => config).runAgent(request);
    const events = []; for await (const item of run.events) events.push(item.type);
    const result = await run.result;
    expect(events).toEqual(["agent_started", "agent_synthesizing", "response_ready"]);
    expect(result.meta).toMatchObject({ provider: "Command Code", model: "provider/model", durationMs: 25 });
    expect(result.result?.speech).toBe("Hello.");
    expect(JSON.stringify(result)).not.toContain("private");
  });

  it("rejects malformed final output", async () => {
    const transport = fakeTransport([JSON.stringify({ type: "result", subtype: "success", usage: { inputTokens: 1, outputTokens: 1 }, durationMs: 1, finalText: "bad" })]);
    const run = await new CommandCodeProvider(transport, () => config).runAgent(request);
    await expect(run.result).rejects.toThrow("safely validated");
  });

  it.each([[3, "authentication"], [5, "rate limit"], [6, "network"], [8, "turn limit"], [10, "credits"]])("maps exit %i safely", async (exitCode, message) => {
    const transport = fakeTransport([JSON.stringify({ type: "result", subtype: "error", usage: { inputTokens: 0, outputTokens: 0 }, durationMs: 1, finalText: "" })], exitCode as number);
    const run = await new CommandCodeProvider(transport, () => config).runAgent(request);
    await expect(run.result).rejects.toThrow(message as string);
  });

  it("passes only fixed config and prompt to transport", async () => {
    const transport = fakeTransport([JSON.stringify({ type: "result", subtype: "success", usage: { inputTokens: 1, outputTokens: 1 }, durationMs: 1, finalText: validResult })]);
    await new CommandCodeProvider(transport, () => config).runAgent(request);
    expect(transport.start).toHaveBeenCalledWith(expect.objectContaining({ config, prompt: expect.stringContaining("USER: Hello Jarvis.") }));
  });
});
