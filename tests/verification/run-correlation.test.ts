import { describe, expect, it } from "vitest";
import { shellReducer, initialShellState } from "@/lib/shell/shell-reducer";
import type { AgentEvent } from "@/lib/contracts/event";
import type { StructuredResult } from "@/lib/contracts/result";

describe("Phase 10 Run Correlation & Stale-Run Protection", () => {
  const sampleResult: StructuredResult = {
    speech: "Run completed.",
    title: "Completed",
    state: "complete",
    cards: [],
    sources: [],
  };

  const sampleMeta = {
    provider: "Test",
    model: "test-model",
    durationMs: 50,
  };

  it("rejects late events from older runs", () => {
    // Start Run A
    let state = shellReducer(initialShellState, {
      type: "runRequested",
      runId: "run-A",
      command: "First request",
    });
    expect(state.activeRunId).toBe("run-A");

    // Start Run B (newer run)
    state = shellReducer(state, {
      type: "runRequested",
      runId: "run-B",
      command: "Second request",
    });
    expect(state.activeRunId).toBe("run-B");

    // Late event from Run A arrives
    const staleEvent: AgentEvent = {
      id: "event-stale",
      type: "verification_completed",
      timestamp: new Date().toISOString(),
      label: "Late verification from Run A",
    };

    const stateAfterStale = shellReducer(state, {
      type: "runEventReceived",
      runId: "run-A", // Mismatched old run!
      event: staleEvent,
    });

    // Stale event is completely rejected
    expect(stateAfterStale.events.length).toBe(0);
  });

  it("rejects late result from older run attempting to overwrite newer run", () => {
    // Start Run A then Run B
    let state = shellReducer(initialShellState, {
      type: "runRequested",
      runId: "run-A",
      command: "First command",
    });
    state = shellReducer(state, {
      type: "runRequested",
      runId: "run-B",
      command: "Second command",
    });

    // Late result from Run A arrives
    const stateAfterStaleResult = shellReducer(state, {
      type: "runResultReceived",
      runId: "run-A",
      result: sampleResult,
      meta: sampleMeta,
    });

    // State remains in active Run B, not completed Run A!
    expect(stateAfterStaleResult.activeRunId).toBe("run-B");
    expect(stateAfterStaleResult.runStatus).toBe("running");
    expect(stateAfterStaleResult.result).toBeNull();
  });

  it("prevents late result from resurrecting a cancelled run", () => {
    let state = shellReducer(initialShellState, {
      type: "runRequested",
      runId: "run-cancel-1",
      command: "To be cancelled",
    });

    // User cancels the run
    state = shellReducer(state, {
      type: "runCancelled",
      runId: "run-cancel-1",
    });
    expect(state.runStatus).toBe("cancelled");
    expect(state.activeRunId).toBeNull();

    // Late-arriving result from the cancelled run
    state = shellReducer(state, {
      type: "runResultReceived",
      runId: "run-cancel-1",
      result: sampleResult,
      meta: sampleMeta,
    });

    // Remains cancelled; does not resurrect into complete
    expect(state.runStatus).toBe("cancelled");
    expect(state.result).toBeNull();
  });

  it("prevents late failure event from resurrecting or overwriting active run", () => {
    let state = shellReducer(initialShellState, {
      type: "runRequested",
      runId: "run-active",
      command: "Active command",
    });

    state = shellReducer(state, {
      type: "runFailed",
      runId: "run-old",
      error: { code: "timeout", message: "Old timeout" },
    });

    expect(state.activeRunId).toBe("run-active");
    expect(state.runStatus).toBe("running");
    expect(state.error).toBeNull();
  });
});
