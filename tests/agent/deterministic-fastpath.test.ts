import { describe, expect, it } from "vitest";
import { AgentRuntime } from "@/lib/agent/runtime";
import { createDefaultToolRegistry } from "@/lib/tools/demo-tools";
import type { AgentProvider } from "@/lib/contracts/provider";
import type { StructuredResult } from "@/lib/contracts/result";
import { formatAssistantTurn } from "@/lib/shell/shell-reducer";

const mockDirectResult: StructuredResult = {
  speech: "Non-deterministic model output.",
  title: "Model Output",
  state: "complete",
  cards: [],
  sources: [],
};

describe("Deterministic Task Optimization (Phase 12 / Master Prompt §38)", () => {
  it("resolves unambiguous time query via fast-path without invoking provider", async () => {
    const registry = createDefaultToolRegistry();
    let providerCalled = false;

    const mockProvider: AgentProvider = {
      id: "mock",
      name: "Mock Provider",
      async runAgent() {
        providerCalled = true;
        return {
          events: (async function* () {})(),
          result: Promise.resolve({
            decision: { type: "direct", result: mockDirectResult },
            result: mockDirectResult,
            meta: { provider: "Mock Provider", model: "test", durationMs: 10 },
          }),
          cancel: async () => {},
        };
      },
    };

    const runtime = new AgentRuntime(
      mockProvider,
      registry,
      undefined,
      undefined,
      undefined,
      undefined,
      { enableFastPath: true }
    );

    const frames = [];
    const t0 = performance.now();
    for await (const frame of runtime.run(
      { message: "what time is it", conversation: [] },
      new AbortController().signal
    )) {
      frames.push(frame);
    }
    const duration = performance.now() - t0;

    // Fast-path should resolve without calling model
    expect(providerCalled).toBe(false);
    expect(duration).toBeLessThan(100); // typically < 10ms

    // Frame sequence includes tool events and verification events
    const eventTypes = frames
      .filter((f) => f.type === "event")
      .map((f) => (f as { event: { type: string } }).event.type);

    expect(eventTypes).toContain("tool_started");
    expect(eventTypes).toContain("tool_completed");
    expect(eventTypes).toContain("verification_started");
    expect(eventTypes).toContain("verification_completed");

    // Final result frame
    const resultFrame = frames.find((f) => f.type === "result") as {
      type: "result";
      result: StructuredResult;
      meta: { provider: string; model: string };
    };
    expect(resultFrame).toBeDefined();
    expect(resultFrame.result.state).toBe("complete");
    expect(resultFrame.result.title).toBe("Current Time");
    expect(resultFrame.result.speech).toMatch(/It is currently/);
    expect(resultFrame.result.cards.length).toBeGreaterThan(0);
    expect(resultFrame.meta.provider).toBe("deterministic");
  });

  it("passes ambiguous or complex queries to provider even when fast-path is enabled", async () => {
    const registry = createDefaultToolRegistry();
    let providerCalled = false;

    const mockProvider: AgentProvider = {
      id: "mock",
      name: "Mock Provider",
      async runAgent() {
        providerCalled = true;
        return {
          events: (async function* () {})(),
          result: Promise.resolve({
            decision: { type: "direct", result: mockDirectResult },
            result: mockDirectResult,
            meta: { provider: "Mock Provider", model: "test", durationMs: 10 },
          }),
          cancel: async () => {},
        };
      },
    };

    const runtime = new AgentRuntime(
      mockProvider,
      registry,
      undefined,
      undefined,
      undefined,
      undefined,
      { enableFastPath: true }
    );

    const frames = [];
    for await (const frame of runtime.run(
      { message: "What time is my meeting tomorrow?", conversation: [] },
      new AbortController().signal
    )) {
      frames.push(frame);
    }

    // Since this is an ambiguous query about a meeting, it must go to the provider
    expect(providerCalled).toBe(true);
  });
});

describe("Context Quality & Natural Follow-ups (Phase 12)", () => {
  it("enriches conversation history with card excerpts for follow-up questions", () => {
    const sampleResult: StructuredResult = {
      speech: "I found your note on DeepSeek Harness in the vault.",
      title: "Note Found",
      state: "complete",
      cards: [
        {
          id: "note-1",
          type: "note",
          label: "DeepSeek Harness",
          title: "DeepSeek Harness Architecture",
          excerpt: "DeepSeek Harness uses local Ollama with GPU acceleration and keep-alive.",
          path: "Projects/DeepSeek.md",
          modifiedAt: "2026-09-20T10:00:00Z",
        },
      ],
      sources: [],
    };

    const assistantTurn = formatAssistantTurn(sampleResult);
    expect(assistantTurn).toContain("I found your note on DeepSeek Harness in the vault.");
    expect(assistantTurn).toContain("[Note: DeepSeek Harness Architecture]");
    expect(assistantTurn).toContain("DeepSeek Harness uses local Ollama with GPU acceleration");
    expect(assistantTurn.length).toBeLessThanOrEqual(1500);
  });
});
