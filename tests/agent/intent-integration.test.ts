import { describe, it, expect } from "vitest";
import { AgentRuntime } from "@/lib/agent/runtime";
import type { AgentProvider } from "@/lib/contracts/provider";
import type { AgentApiRequest, AgentApiFrame } from "@/lib/contracts/agent-api";
import { createDefaultToolRegistry } from "@/lib/tools/demo-tools";

describe("Phase 07: Intent Layer Integration in AgentRuntime", () => {
  const mockProvider: AgentProvider = {
    id: "mock-hermes",
    name: "Mock Hermes",
    runAgent: async () => ({
      events: (async function* () {})(),
      result: Promise.resolve({
        decision: {
          type: "direct",
          result: {
            speech: "Hello, I am here to help.",
            title: "Greeting",
            state: "complete",
            cards: [
              {
                id: "resp-1",
                type: "generic",
                label: "Greeting",
                title: "Hello",
                body: "Ready to assist.",
              },
            ],
            sources: [],
          },
        },
        meta: {
          provider: "mock-hermes",
          model: "test-model",
          durationMs: 10,
          usage: {
            inputTokens: 10,
            outputTokens: 10,
          },
        },
      }),
      cancel: async () => {},
    }),
  };

  it("emits intent_detected and intent_routed frames on deterministic time query and returns fast-path result", async () => {
    const runtime = new AgentRuntime(
      mockProvider,
      createDefaultToolRegistry(),
      undefined,
      undefined,
      undefined,
      undefined,
      { enableFastPath: true }
    );
    const input: AgentApiRequest = {
      message: "What time is it right now?",
      conversation: [],
    };

    const frames: AgentApiFrame[] = [];
    for await (const frame of runtime.run(input)) {
      frames.push(frame);
    }

    const eventTypes = frames
      .filter((f): f is Extract<AgentApiFrame, { type: "event" }> => f.type === "event")
      .map((f) => f.event.type);

    expect(eventTypes).toContain("intent_detected");
    expect(eventTypes).toContain("intent_routed");
    expect(eventTypes).toContain("tool_started");
    expect(eventTypes).toContain("tool_completed");
    expect(eventTypes).toContain("verification_completed");

    const resultFrame = frames.find((f) => f.type === "result");
    expect(resultFrame).toBeDefined();
    if (resultFrame && resultFrame.type === "result") {
      expect(resultFrame.result.title).toBe("Current Time");
      expect(resultFrame.result.state).toBe("complete");
    }
  });

  it("handles stop intent safely when no task is running, returning informational status", async () => {
    const runtime = new AgentRuntime(mockProvider, createDefaultToolRegistry());
    const input: AgentApiRequest = {
      message: "stop",
      conversation: [],
    };

    const frames: AgentApiFrame[] = [];
    for await (const frame of runtime.run(input)) {
      frames.push(frame);
    }

    const eventTypes = frames
      .filter((f): f is Extract<AgentApiFrame, { type: "event" }> => f.type === "event")
      .map((f) => f.event.type);

    expect(eventTypes).toContain("intent_detected");

    const resultFrame = frames.find((f) => f.type === "result");
    expect(resultFrame).toBeDefined();
    if (resultFrame && resultFrame.type === "result") {
      expect(resultFrame.result.title).toBe("System Status");
      expect(resultFrame.result.speech).toContain("no active task");
    }
  });

  it("emits intent_fallback for candidate intent with inactive capability and smoothly reaches provider", async () => {
    const runtime = new AgentRuntime(mockProvider, createDefaultToolRegistry());
    const input: AgentApiRequest = {
      message: "remind me tomorrow at 8",
      conversation: [],
    };

    const frames: AgentApiFrame[] = [];
    for await (const frame of runtime.run(input)) {
      frames.push(frame);
    }

    const eventTypes = frames
      .filter((f): f is Extract<AgentApiFrame, { type: "event" }> => f.type === "event")
      .map((f) => f.event.type);

    expect(eventTypes).toContain("intent_detected");
    expect(eventTypes).toContain("intent_fallback");

    const resultFrame = frames.find((f) => f.type === "result");
    expect(resultFrame).toBeDefined();
    if (resultFrame && resultFrame.type === "result") {
      expect(resultFrame.result.title).toBe("Greeting");
    }
  });
});
