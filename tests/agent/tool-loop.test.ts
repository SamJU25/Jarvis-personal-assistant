import { describe, expect, it } from "vitest";
import { AgentRuntime } from "@/lib/agent/runtime";
import { createDefaultToolRegistry } from "@/lib/tools/demo-tools";
import type { AgentProvider, AgentRequest } from "@/lib/contracts/provider";
import type { StructuredResult } from "@/lib/contracts/result";

const directResult: StructuredResult = {
  speech: "Direct answer without tools.",
  title: "Direct Answer",
  state: "complete",
  cards: [{ id: "c1", type: "generic", label: "Answer", title: "Info", body: "Direct knowledge." }],
  sources: [],
};

const synthesizedResult: StructuredResult = {
  speech: "The current server time is 12:00 PM UTC.",
  title: "Server Time",
  state: "complete",
  cards: [{ id: "c2", type: "generic", label: "Time", title: "Current Time", body: "12:00 PM UTC" }],
  sources: [{ id: "s1", title: "System Clock", kind: "document", location: "system" }],
};

describe("Agent ↔ Tool Loop (Phase 3)", () => {
  it("executes direct response without calling any tools", async () => {
    const registry = createDefaultToolRegistry();
    const provider: AgentProvider = {
      id: "mock",
      name: "Mock Provider",
      async runAgent() {
        return {
          events: (async function* () {
            yield { id: "e1", type: "agent_started" as const, timestamp: "now", label: "Started" };
            yield { id: "e2", type: "response_ready" as const, timestamp: "now", label: "Ready" };
          })(),
          result: Promise.resolve({
            decision: { type: "direct", result: directResult },
            result: directResult,
            meta: { provider: "Mock Provider", model: "test", durationMs: 10 },
          }),
          cancel: async () => {},
        };
      },
    };

    const runtime = new AgentRuntime(provider, registry);
    const frames = [];
    for await (const frame of runtime.run({ message: "What is 2+2?", conversation: [] }, new AbortController().signal)) {
      frames.push(frame);
    }

    expect(frames.some((f) => f.type === "result")).toBe(true);
    const resultFrame = frames.find((f) => f.type === "result");
    expect(resultFrame).toMatchObject({
      type: "result",
      result: directResult,
    });
    // No tool events emitted
    const eventTypes = frames.filter((f) => f.type === "event").map((f) => (f as { event: { type: string } }).event.type);
    expect(eventTypes).not.toContain("tool_started");
    expect(eventTypes).not.toContain("tool_completed");
  });

  it("executes full tool loop: request → execution → synthesis → validated result", async () => {
    const registry = createDefaultToolRegistry();
    const requestsReceived: AgentRequest[] = [];
    let turn = 0;

    const provider: AgentProvider = {
      id: "mock",
      name: "Mock Provider",
      async runAgent(request) {
        turn++;
        requestsReceived.push(request);
        if (turn === 1) {
          return {
            events: (async function* () {
              yield { id: "e1", type: "agent_started" as const, timestamp: "now", label: "Started" };
            })(),
            result: Promise.resolve({
              decision: {
                type: "tool_call",
                request: {
                  type: "tool_call",
                  callId: "call_time_1",
                  toolId: "get_current_time",
                  arguments: { timezone: "UTC" },
                },
              },
              meta: { provider: "Mock Provider", model: "test", durationMs: 15 },
            }),
            cancel: async () => {},
          };
        }
        // Turn 2: synthesizing
        return {
          events: (async function* () {
            yield { id: "e2", type: "agent_synthesizing" as const, timestamp: "now", label: "Synthesizing" };
            yield { id: "e3", type: "response_ready" as const, timestamp: "now", label: "Ready" };
          })(),
          result: Promise.resolve({
            decision: { type: "direct", result: synthesizedResult },
            result: synthesizedResult,
            meta: { provider: "Mock Provider", model: "test", durationMs: 25 },
          }),
          cancel: async () => {},
        };
      },
    };

    const runtime = new AgentRuntime(provider, registry);
    const frames = [];
    for await (const frame of runtime.run({ message: "What time is it?", conversation: [] }, new AbortController().signal)) {
      frames.push(frame);
    }

    expect(requestsReceived.length).toBe(2);

    // Turn 1 had available tools metadata (3 demo + 3 obsidian + 7 google + 4 memory + 1 learning + 3 document = 21)
    expect(requestsReceived[0].availableTools.length).toBe(21);
    expect(requestsReceived[0].availableTools.map((t) => t.id)).toContain("get_current_time");

    // Turn 2 had tool result injected in conversation
    const turn2Conversation = requestsReceived[1].conversation;
    expect(turn2Conversation.some((msg) => msg.content.includes("call_time_1"))).toBe(true);
    expect(turn2Conversation.some((msg) => msg.content.includes("Tool result for get_current_time"))).toBe(true);

    // Event sequence contains tool lifecycle
    const eventTypes = frames.filter((f) => f.type === "event").map((f) => (f as { event: { type: string } }).event.type);
    expect(eventTypes).toContain("tool_requested");
    expect(eventTypes).toContain("tool_started");
    expect(eventTypes).toContain("tool_completed");
    expect(eventTypes).toContain("agent_synthesizing");
    expect(eventTypes).toContain("response_ready");

    // Final result is validated
    const finalFrame = frames.find((f) => f.type === "result");
    expect(finalFrame).toMatchObject({
      type: "result",
      result: synthesizedResult,
      meta: {
        provider: "Mock Provider",
        durationMs: 40, // 15 + 25
      },
    });
  });

  it("handles unknown tool ID by reporting failure and continuing to synthesis", async () => {
    const registry = createDefaultToolRegistry();
    let turn = 0;
    let turn2Conv: readonly { role: string; content: string }[] = [];

    const provider: AgentProvider = {
      id: "mock",
      name: "Mock Provider",
      async runAgent(request) {
        turn++;
        if (turn === 1) {
          return {
            events: (async function* () {})(),
            result: Promise.resolve({
              decision: {
                type: "tool_call",
                request: {
                  type: "tool_call",
                  callId: "bad_call_1",
                  toolId: "unknown_arbitrary_tool",
                  arguments: {},
                },
              },
              meta: { provider: "Mock Provider", model: "test", durationMs: 10 },
            }),
            cancel: async () => {},
          };
        }
        turn2Conv = request.conversation;
        return {
          events: (async function* () {})(),
          result: Promise.resolve({
            decision: {
              type: "direct",
              result: {
                speech: "I could not find that tool.",
                title: "Tool Unavailable",
                state: "complete",
                cards: [],
                sources: [],
              },
            },
            meta: { provider: "Mock Provider", model: "test", durationMs: 10 },
          }),
          cancel: async () => {},
        };
      },
    };

    const runtime = new AgentRuntime(provider, registry);
    const frames = [];
    for await (const frame of runtime.run({ message: "Run unknown tool", conversation: [] }, new AbortController().signal)) {
      frames.push(frame);
    }

    const failedEvent = frames.find(
      (f) => f.type === "event" && (f as { event: { type: string } }).event.type === "tool_failed"
    );
    expect(failedEvent).toBeDefined();

    // Verify turn 2 received failure notice
    expect(turn2Conv.some((m) => m.content.includes('"status":"failure"'))).toBe(true);
    expect(turn2Conv.some((m) => m.content.includes("is not registered"))).toBe(true);
  });

  it("prevents arbitrary repeated tool calls beyond max turn limit", async () => {
    const registry = createDefaultToolRegistry();
    let turn = 0;

    const provider: AgentProvider = {
      id: "mock",
      name: "Mock Provider",
      async runAgent() {
        turn++;
        // Turn 2 also attempts to call a tool instead of direct answer
        return {
          events: (async function* () {})(),
          result: Promise.resolve({
            decision: {
              type: "tool_call",
              request: {
                type: "tool_call",
                callId: `call_${turn}`,
                toolId: "get_current_time",
                arguments: {},
              },
            },
            meta: { provider: "Mock Provider", model: "test", durationMs: 5 },
          }),
          cancel: async () => {},
        };
      },
    };

    const runtime = new AgentRuntime(provider, registry);
    const frames = [];
    for await (const frame of runtime.run({ message: "Infinite loop?", conversation: [] }, new AbortController().signal)) {
      frames.push(frame);
    }

    const errorFrame = frames.find((f) => f.type === "error");
    expect(errorFrame).toBeDefined();
    expect(errorFrame).toMatchObject({
      type: "error",
      error: { code: "max_turns" },
    });
  });
});
