import { describe, expect, it } from "vitest";
import { TaskTracker, VerificationService } from "@/lib/verification/service";
import { VerificationRegistry } from "@/lib/verification/registry";
import { AgentRuntime } from "@/lib/agent/runtime";
import { createDefaultToolRegistry } from "@/lib/tools/demo-tools";
import type { AgentProvider } from "@/lib/contracts/provider";

describe("Phase 10 Formal Task Lifecycle", () => {
  it("TaskTracker transitions through queued -> planning -> executing -> verifying -> completed", () => {
    const tracker = new TaskTracker();
    const runId = "run-lifecycle-1";
    const task = tracker.createTask(runId, "create_note");

    expect(task.state).toBe("queued");

    tracker.updateState(task.id, "planning");
    expect(tracker.getTask(task.id)?.state).toBe("planning");

    tracker.updateState(task.id, "executing", { currentAction: "Create Note" });
    expect(tracker.getTask(task.id)?.state).toBe("executing");

    tracker.updateState(task.id, "verifying");
    expect(tracker.getTask(task.id)?.state).toBe("verifying");

    tracker.updateState(task.id, "completed", {
      verificationStatus: "passed",
      finalResult: {
        speech: "Done",
        title: "Title",
        state: "complete",
        cards: [],
        sources: [],
      },
    });
    expect(tracker.getTask(task.id)?.state).toBe("completed");
    expect(tracker.getTask(task.id)?.verificationStatus).toBe("passed");
  });

  it("TaskTracker prevents cancelled task from being resurrected into completed", () => {
    const tracker = new TaskTracker();
    const task = tracker.createTask("run-cancelled-1");

    tracker.updateState(task.id, "cancelled");
    expect(tracker.getTask(task.id)?.state).toBe("cancelled");

    // Late completion arrives
    tracker.updateState(task.id, "completed");
    expect(tracker.getTask(task.id)?.state).toBe("cancelled"); // remains cancelled!
  });

  it("AgentRuntime executes full lifecycle: tool execution -> verification -> completed", async () => {
    const registry = createDefaultToolRegistry();
    let turn = 0;

    const provider: AgentProvider = {
      id: "mock",
      name: "Mock Provider",
      async runAgent() {
        turn++;
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
        return {
          events: (async function* () {
            yield { id: "e2", type: "agent_synthesizing" as const, timestamp: "now", label: "Synthesizing" };
          })(),
          result: Promise.resolve({
            decision: {
              type: "direct",
              result: {
                speech: "The time is 12:00 UTC.",
                title: "Current Time",
                state: "complete",
                cards: [],
                sources: [],
              },
            },
            meta: { provider: "Mock Provider", model: "test", durationMs: 25 },
          }),
          cancel: async () => {},
        };
      },
    };

    const vService = new VerificationService();
    const runtime = new AgentRuntime(provider, registry, undefined, undefined, vService);

    const frames = [];
    for await (const frame of runtime.run(
      { message: "What time is it?", conversation: [] },
      new AbortController().signal
    )) {
      frames.push(frame);
    }

    const eventTypes = frames
      .filter((f) => f.type === "event")
      .map((f) => (f as { event: { type: string } }).event.type);

    expect(eventTypes).toContain("tool_requested");
    expect(eventTypes).toContain("tool_started");
    expect(eventTypes).toContain("tool_completed");
    expect(eventTypes).toContain("verification_started");
    expect(eventTypes).toContain("verification_completed");

    const resultFrame = frames.find((f) => f.type === "result");
    expect(resultFrame).toBeDefined();
    expect(resultFrame?.result.state).toBe("complete");
  });

  it("forces task to failed state when verification fails, ignoring model claims of success", async () => {
    const registry = createDefaultToolRegistry();
    let turn = 0;

    const provider: AgentProvider = {
      id: "mock",
      name: "Mock Provider",
      async runAgent() {
        turn++;
        if (turn === 1) {
          return {
            events: (async function* () {})(),
            result: Promise.resolve({
              decision: {
                type: "tool_call",
                request: {
                  type: "tool_call",
                  callId: "call_time_2",
                  toolId: "get_current_time",
                  arguments: {},
                },
              },
              meta: { provider: "Mock Provider", model: "test", durationMs: 10 },
            }),
            cancel: async () => {},
          };
        }
        return {
          events: (async function* () {})(),
          result: Promise.resolve({
            decision: {
              type: "direct",
              result: {
                // Model hallucinates/claims success despite failed verification
                speech: "I successfully checked the time for you!",
                title: "Time Checked",
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

    // Custom verification service where verification fails
    const vRegistry = new VerificationRegistry();
    vRegistry.register("get_current_time", {
      verify: async (req) => ({
        runId: req.runId,
        toolId: req.toolId,
        status: "failed",
        verifiedAt: new Date().toISOString(),
        evidence: [],
        reason: "Time server mismatch detected",
      }),
    });

    const vService = new VerificationService({ registry: vRegistry });
    const runtime = new AgentRuntime(provider, registry, undefined, undefined, vService);

    const frames = [];
    for await (const frame of runtime.run(
      { message: "What time is it?", conversation: [] },
      new AbortController().signal
    )) {
      frames.push(frame);
    }

    const resultFrame = frames.find((f) => f.type === "result");
    expect(resultFrame).toBeDefined();
    // Application ownership strictly forces failed state!
    expect(resultFrame?.result.state).toBe("failed");
    // Application overwrote hallucinated success speech with truthful failure
    expect(resultFrame?.result.speech).toContain("couldn't verify that the action was completed");
    expect(resultFrame?.result.speech).toContain("Time server mismatch detected");
  });

  it("write proposal transitions planning -> waiting_for_approval without entering executing", async () => {
    const registry = createDefaultToolRegistry();
    let turnCount = 0;
    const provider: AgentProvider = {
      id: "mock",
      name: "Mock Provider",
      async runAgent() {
        turnCount++;
        if (turnCount === 1) {
          return {
            events: (async function* () {})(),
            result: Promise.resolve({
              decision: {
                type: "tool_call",
                request: {
                  type: "tool_call",
                  callId: "call_note_1",
                  toolId: "create_note",
                  arguments: { title: "Test Note", content: "Test Content" },
                },
              },
              meta: { provider: "Mock Provider", model: "test", durationMs: 10 },
            }),
            cancel: async () => {},
          };
        }
        return {
          events: (async function* () {})(),
          result: Promise.resolve({
            decision: {
              type: "direct",
              result: {
                speech: "I've prepared the note. Please confirm to proceed.",
                title: "Create Note",
                state: "waiting_for_approval",
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

    const vService = new VerificationService();
    const runtime = new AgentRuntime(provider, registry, undefined, undefined, vService);

    const frames = [];
    for await (const frame of runtime.run(
      { message: "Create a note for me", conversation: [] },
      new AbortController().signal
    )) {
      frames.push(frame);
    }

    // Events should include confirmation_required, but NEVER tool_started
    const eventTypes = frames
      .filter((f) => f.type === "event")
      .map((f) => (f as { event: { type: string } }).event.type);

    expect(eventTypes).toContain("tool_requested");
    expect(eventTypes).toContain("confirmation_required");
    expect(eventTypes).not.toContain("tool_started");
    expect(eventTypes).not.toContain("verification_started");

    // Task state must be waiting_for_approval, NOT executing
    const confFrame = frames.find((f) => f.type === "confirmation_required");
    expect(confFrame).toBeDefined();

    const task = vService.taskTracker.getTask(
      (confFrame as { confirmation: { originatingRunId: string } }).confirmation.originatingRunId
    );
    expect(task).toBeDefined();
    expect(task?.state).toBe("waiting_for_approval");

    // Final result frame must have state waiting_for_approval
    const resultFrame = frames.find((f) => f.type === "result");
    expect(resultFrame).toBeDefined();
    expect(resultFrame?.result.state).toBe("waiting_for_approval");
  });

  it("TaskTracker protects cancelled tasks against late resurrection to executing, verifying, or completed", () => {
    const tracker = new TaskTracker();
    const task = tracker.createTask("run-cancel-resurrection");

    tracker.updateState(task.id, "planning");
    tracker.updateState(task.id, "waiting_for_approval");
    expect(tracker.getTask(task.id)?.state).toBe("waiting_for_approval");

    tracker.updateState(task.id, "cancelled");
    expect(tracker.getTask(task.id)?.state).toBe("cancelled");

    // Late execution attempts cannot change cancelled state
    tracker.updateState(task.id, "executing");
    expect(tracker.getTask(task.id)?.state).toBe("cancelled");

    // Late verification attempts cannot change cancelled state
    tracker.updateState(task.id, "verifying");
    expect(tracker.getTask(task.id)?.state).toBe("cancelled");

    // Late completion attempts cannot change cancelled state
    tracker.updateState(task.id, "completed");
    expect(tracker.getTask(task.id)?.state).toBe("cancelled");
  });
});
