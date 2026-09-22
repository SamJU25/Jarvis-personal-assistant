import { describe, expect, it, vi, beforeEach } from "vitest";
import { HermesProvider } from "@/lib/agent/providers/hermes-provider";
import { HermesClient } from "@/lib/hermes/client";
import type { HermesRunEvent } from "@/lib/contracts/hermes";

/**
 * Phase 10 acceptance: a research query produces a trace showing
 * search/retrieval → evidence → Hermes synthesis, with source provenance
 * preserved in the final result sources.
 */
describe("HermesProvider executeRun web research provenance", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  function createMockClient(events: HermesRunEvent[]) {
    return {
      createRun: vi.fn().mockResolvedValue({ run_id: "run-research-1", status: "running" }),
      getRunStatus: vi.fn().mockResolvedValue({ run_id: "run-research-1", status: "completed" }),
      stopRun: vi.fn().mockResolvedValue({ status: "stopped" }),
      streamRunEvents: vi.fn().mockImplementation(async function* () {
        for (const ev of events) yield ev;
      }),
    } as unknown as HermesClient;
  }

  it("captures web evidence from tool events and preserves provenance in the final result", async () => {
    const events: HermesRunEvent[] = [
      { event: "tool.started", data: { tool: "web_search" } },
      {
        event: "tool.completed",
        data: {
          tool: "web_search",
          results: [
            { url: "https://docs.example/quantum", title: "Quantum computing overview" },
            { url: "javascript:alert(1)", title: "Injected page" },
            { url: "https://docs.example/quantum", title: "Duplicate" },
          ],
        },
      },
      {
        event: "run.completed",
        data: {
          output: JSON.stringify({
            speech: "Quantum computing uses qubits.",
            title: "Research Summary",
            state: "complete",
            cards: [],
            sources: [],
          }),
        },
      },
    ];

    const provider = new HermesProvider({ client: createMockClient(events) });
    const frames: Array<{ type: string; event?: { type: string; label: string }; result?: { sources: unknown[] } }> = [];
    for await (const frame of provider.executeRun({
      input: "What is quantum computing?",
      conversation: [],
      sessionId: "research-session-1",
      instructions: "You are JARVIS.",
    })) {
      frames.push(frame as typeof frames[number]);
    }

    // Trace: search/retrieval → evidence → synthesis
    const labels = frames.filter((f) => f.type === "event").map((f) => f.event?.label ?? "");
    expect(labels.some((l) => l.includes("Tool web_search completed"))).toBe(true);
    expect(labels.some((l) => l.includes("Evidence captured: 1 source"))).toBe(true);

    const resultFrame = frames.find((f) => f.type === "result");
    expect(resultFrame).toBeDefined();
    const sources = (resultFrame?.result?.sources ?? []) as Array<{ kind: string; url?: string; retrievedAt?: string }>;
    expect(sources).toHaveLength(1);
    expect(sources[0].kind).toBe("web");
    expect(sources[0].url).toBe("https://docs.example/quantum");
    expect(typeof sources[0].retrievedAt).toBe("string");
    // The injected URL must never survive normalization
    expect(sources.some((s) => s.url?.startsWith("javascript:"))).toBe(false);
  });

  it("model-declared sources take priority over captured evidence", async () => {
    const events: HermesRunEvent[] = [
      {
        event: "tool.completed",
        data: {
          tool: "web_extract",
          results: [{ url: "https://captured.example/1", title: "Captured" }],
        },
      },
      {
        event: "run.completed",
        data: {
          output: JSON.stringify({
            speech: "Answer with declared source.",
            title: "Answer",
            state: "complete",
            cards: [],
            sources: [
              { id: "s1", title: "Declared Source", kind: "web", location: "https://declared.example", url: "https://declared.example" },
            ],
          }),
        },
      },
    ];

    const provider = new HermesProvider({ client: createMockClient(events) });
    const frames: Array<{ type: string; result?: { sources: Array<{ url?: string }> } }> = [];
    for await (const frame of provider.executeRun({
      input: "Research question",
      conversation: [],
      sessionId: "research-session-2",
      instructions: "You are JARVIS.",
    })) {
      frames.push(frame as typeof frames[number]);
    }

    const sources = frames.find((f) => f.type === "result")?.result?.sources ?? [];
    expect(sources.map((s) => s.url)).toEqual(["https://declared.example", "https://captured.example/1"]);
  });

  it("does not attach provenance for non-web tools", async () => {
    const events: HermesRunEvent[] = [
      {
        event: "tool.completed",
        data: {
          tool: "search_vault",
          results: [{ url: "https://fake.example", title: "Should not be captured" }],
        },
      },
      {
        event: "run.completed",
        data: {
          output: JSON.stringify({
            speech: "Vault answer.",
            title: "Vault",
            state: "complete",
            cards: [],
            sources: [],
          }),
        },
      },
    ];

    const provider = new HermesProvider({ client: createMockClient(events) });
    const frames: Array<{ type: string; result?: { sources: unknown[] } }> = [];
    for await (const frame of provider.executeRun({
      input: "Search my notes",
      conversation: [],
      sessionId: "research-session-3",
      instructions: "You are JARVIS.",
    })) {
      frames.push(frame as typeof frames[number]);
    }

    const sources = frames.find((f) => f.type === "result")?.result?.sources ?? [];
    expect(sources).toHaveLength(0);
  });
});

