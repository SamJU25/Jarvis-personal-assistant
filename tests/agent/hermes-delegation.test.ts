import { describe, expect, it, vi, beforeEach } from "vitest";
import { HermesProvider } from "@/lib/agent/providers/hermes-provider";
import { HermesClient } from "@/lib/hermes/client";
import type { HermesRunEvent } from "@/lib/contracts/hermes";

/**
 * Tests for Hermes specialist delegation via executeRun SSE event handling.
 * Validates: subagent.start / subagent.complete event handling,
 * specialist tree card synthesis, and cancellation semantics.
 */
describe("HermesProvider executeRun delegation", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  function createMockClient(events: HermesRunEvent[]) {
    const mockClient = {
      createRun: vi.fn().mockResolvedValue({
        run_id: "run-delegation-test-1",
        status: "running",
      }),
      getRunStatus: vi.fn().mockResolvedValue({
        run_id: "run-delegation-test-1",
        status: "completed",
        output: JSON.stringify({
          speech: "Task completed.",
          title: "Result",
          state: "complete",
          cards: [],
          sources: [],
        }),
      }),
      stopRun: vi.fn().mockResolvedValue({ status: "stopped" }),
      streamRunEvents: vi.fn().mockImplementation(async function* () {
        for (const ev of events) {
          yield ev;
        }
      }),
    } as unknown as HermesClient;
    return mockClient;
  }

  it("handles subagent.start and subagent.complete SSE events and emits specialist frames", async () => {
    const events: HermesRunEvent[] = [
      {
        event: "subagent.start",
        data: {
          subagent_id: "sa-research-1",
          goal: "Search vault for project research documents",
        },
      },
      {
        event: "subagent.complete",
        data: {
          subagent_id: "sa-research-1",
          status: "completed",
          summary: "Found 3 relevant documents.",
          duration_seconds: 5.2,
          tool_count: 4,
        },
      },
      {
        event: "run.completed",
        data: {
          output: JSON.stringify({
            speech: "Research complete. Found 3 relevant documents.",
            title: "Research Results",
            state: "complete",
            cards: [],
            sources: [],
          }),
        },
      },
    ];

    const mockClient = createMockClient(events);
    const provider = new HermesProvider({ client: mockClient });

    const frames: Array<{ type: string; event?: { type: string; label: string }; result?: unknown }> = [];
    for await (const frame of provider.executeRun({
      input: "Search vault for project research documents",
      conversation: [],
      sessionId: "test-session-1",
      instructions: "You are JARVIS.",
    })) {
      frames.push(frame as typeof frames[number]);
    }

    // Should have: agent_started, specialist_started, specialist_completed, result
    const eventTypes = frames
      .filter((f) => f.type === "event" && f.event)
      .map((f) => f.event!.type);

    expect(eventTypes).toContain("agent_started");
    expect(eventTypes).toContain("specialist_started");
    expect(eventTypes).toContain("specialist_completed");

    // Specialist started label should include the display name
    const startedFrame = frames.find((f) => f.event?.type === "specialist_started");
    expect(startedFrame?.event?.label).toContain("Specialist started:");

    // Result frame should include specialist tree card
    const resultFrame = frames.find((f) => f.type === "result");
    expect(resultFrame).toBeDefined();
    const result = resultFrame?.result as { cards?: Array<{ title: string; body: string }> };
    expect(result?.cards).toBeDefined();
    const specialistCard = result?.cards?.find((c: { title: string }) => c.title === "Specialist Team");
    expect(specialistCard).toBeDefined();
    expect(specialistCard?.body).toContain("HERMES");
    expect(specialistCard?.body).toContain("✓");
    expect(specialistCard?.body).toContain("Synthesis");
  });

  it("emits specialist_failed event for failed subagent", async () => {
    const events: HermesRunEvent[] = [
      {
        event: "subagent.start",
        data: {
          subagent_id: "sa-coding-1",
          goal: "Inspect repository architecture",
        },
      },
      {
        event: "subagent.complete",
        data: {
          subagent_id: "sa-coding-1",
          status: "failed",
          summary: "Tool access denied.",
          duration_seconds: 1.3,
          tool_count: 0,
        },
      },
      {
        event: "run.completed",
        data: {
          output: JSON.stringify({
            speech: "Specialist failed to complete the task.",
            title: "Partial Result",
            state: "complete",
            cards: [],
            sources: [],
          }),
        },
      },
    ];

    const mockClient = createMockClient(events);
    const provider = new HermesProvider({ client: mockClient });

    const frames: Array<{ type: string; event?: { type: string; label: string } }> = [];
    for await (const frame of provider.executeRun({
      input: "Inspect repository architecture",
      conversation: [],
      sessionId: "test-session-2",
      instructions: "You are JARVIS.",
    })) {
      frames.push(frame as typeof frames[number]);
    }

    const eventTypes = frames
      .filter((f) => f.type === "event" && f.event)
      .map((f) => f.event!.type);

    expect(eventTypes).toContain("specialist_failed");

    const failedFrame = frames.find((f) => f.event?.type === "specialist_failed");
    expect(failedFrame?.event?.label).toContain("failed");

    // Specialist tree card should show ✗ for the failed specialist
    const resultFrame = frames.find((f) => f.type === "result");
    const result = resultFrame as unknown as { result: { cards: Array<{ body: string }> } };
    const treeCard = result?.result?.cards?.find((c: { body: string }) => c.body?.includes("✗"));
    expect(treeCard).toBeDefined();
  });

  it("emits specialist_cancelled event for cancelled subagent", async () => {
    const events: HermesRunEvent[] = [
      {
        event: "subagent.start",
        data: {
          subagent_id: "sa-prod-1",
          goal: "Check calendar events for tomorrow",
        },
      },
      {
        event: "subagent.complete",
        data: {
          subagent_id: "sa-prod-1",
          status: "cancelled",
          summary: "Interrupted by parent cancellation.",
          duration_seconds: 0.8,
          tool_count: 1,
        },
      },
      {
        event: "run.completed",
        data: {
          output: JSON.stringify({
            speech: "Operation was cancelled.",
            title: "Cancelled",
            state: "complete",
            cards: [],
            sources: [],
          }),
        },
      },
    ];

    const mockClient = createMockClient(events);
    const provider = new HermesProvider({ client: mockClient });

    const frames: Array<{ type: string; event?: { type: string } }> = [];
    for await (const frame of provider.executeRun({
      input: "Check calendar events for tomorrow",
      conversation: [],
      sessionId: "test-session-3",
      instructions: "You are JARVIS.",
    })) {
      frames.push(frame as typeof frames[number]);
    }

    const eventTypes = frames
      .filter((f) => f.type === "event" && f.event)
      .map((f) => f.event!.type);

    expect(eventTypes).toContain("specialist_cancelled");
  });

  it("synthesizes specialist tree card with multiple specialists", async () => {
    const events: HermesRunEvent[] = [
      {
        event: "subagent.start",
        data: { subagent_id: "sa-1", goal: "Check calendar meetings" },
      },
      {
        event: "subagent.start",
        data: { subagent_id: "sa-2", goal: "Search vault for research notes" },
      },
      {
        event: "subagent.complete",
        data: { subagent_id: "sa-1", status: "completed", summary: "Found 2 meetings.", duration_seconds: 2.1, tool_count: 3 },
      },
      {
        event: "subagent.complete",
        data: { subagent_id: "sa-2", status: "completed", summary: "Found 5 notes.", duration_seconds: 3.5, tool_count: 6 },
      },
      {
        event: "run.completed",
        data: {
          output: JSON.stringify({
            speech: "Here is your briefing combining calendar and research.",
            title: "Morning Briefing",
            state: "complete",
            cards: [],
            sources: [],
          }),
        },
      },
    ];

    const mockClient = createMockClient(events);
    const provider = new HermesProvider({ client: mockClient });

    const frames: Array<{ type: string; result?: { cards: Array<{ title: string; body: string }> } }> = [];
    for await (const frame of provider.executeRun({
      input: "Check my calendar and research vault notes for morning briefing",
      conversation: [],
      sessionId: "test-session-4",
      instructions: "You are JARVIS.",
    })) {
      frames.push(frame as typeof frames[number]);
    }

    const resultFrame = frames.find((f) => f.type === "result");
    expect(resultFrame).toBeDefined();
    const cards = resultFrame?.result?.cards ?? [];
    // First card should be the specialist team card
    expect(cards[0]?.title).toBe("Specialist Team");
    const treeBody = cards[0]?.body || "";
    expect(treeBody).toContain("HERMES");
    expect(treeBody).toContain("Synthesis");
    // Should show two specialist lines
    const specLines = treeBody.split("\n").filter((l: string) => l.includes("├─"));
    expect(specLines.length).toBe(2);
  });

  it("handles cancellation by aborting SSE stream without resurrecting parent run", async () => {
    const abortController = new AbortController();
    const events: HermesRunEvent[] = [
      {
        event: "subagent.start",
        data: { subagent_id: "sa-cancel-1", goal: "Long running task" },
      },
      // No more events — will be interrupted
    ];

    const mockClient = createMockClient(events);
    // Make streamRunEvents throw abort
    vi.spyOn(mockClient, "streamRunEvents" as keyof typeof mockClient).mockImplementation(async function* () {
      yield events[0];
      // Simulate hang then abort
      abortController.abort();
      throw new Error("AbortError");
    } as () => AsyncGenerator<HermesRunEvent>);

    const provider = new HermesProvider({ client: mockClient });

    const frames: Array<{ type: string }> = [];
    try {
      for await (const frame of provider.executeRun({
        input: "Long running task",
        conversation: [],
        sessionId: "test-session-cancel",
        instructions: "You are JARVIS.",
        signal: abortController.signal,
      })) {
        frames.push(frame);
      }
    } catch (err: unknown) {
      // Expected: should throw cancelled or server error
      expect(err).toBeDefined();
    }

    // stopRun should have been called or attempted on abort
    // The run should NOT produce a result frame after cancellation
    const resultFrames = frames.filter((f) => f.type === "result");
    expect(resultFrames).toHaveLength(0);
  });
});
