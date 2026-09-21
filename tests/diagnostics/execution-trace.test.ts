import { describe, expect, it } from "vitest";
import { DiagnosticService } from "@/lib/diagnostics/service";
import { executionTraceSchema, debugSnapshotSchema } from "@/lib/contracts/diagnostics";

describe("Phase 06: Correlated Execution Trace", () => {
  it("correlates all 9 stages in an execution trace", () => {
    const service = new DiagnosticService();
    const runId = "run-trace-01";
    const sessionId = "session-alpha-99";
    const hermesRunId = "hermes-run-77";
    const taskId = "task-trace-01";

    // 1. Session & Hermes Run
    service.startRun(runId, "Create a meeting note about Project Phoenix", taskId, {
      sessionId,
      hermesRunId,
    });

    // 2. Skill
    service.recordSkill(runId, {
      skillId: "capture-note",
      selected: true,
      timing: { startedAt: new Date().toISOString(), durationMs: 15 },
      outcome: "success",
    });

    // 3. Inference
    service.recordInference(runId, {
      provider: "HermesProvider",
      model: "hermes-3-llama-3.1-8b",
      timing: { startedAt: new Date().toISOString(), durationMs: 250 },
      outcome: "success",
      tokenUsage: { prompt: 120, completion: 45, total: 165 },
    });

    // 4. Memory
    service.recordMemory(runId, {
      operation: "retrieval",
      timing: { startedAt: new Date().toISOString(), durationMs: 8 },
      outcome: "success",
      querySummary: "Project Phoenix",
      count: 2,
    });

    // 5. Capability / Tool
    service.recordTool(runId, {
      id: "call-note-1",
      runId,
      taskId,
      toolId: "create_note",
      permission: "write",
      state: "completed",
      timing: { startedAt: new Date().toISOString(), durationMs: 30 },
      outcome: "success",
    });

    // 6. Confirmation
    service.recordConfirmation(runId, {
      confirmationId: "conf-101",
      runId,
      taskId,
      toolId: "create_note",
      state: "confirmed",
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60000).toISOString(),
      resolvedAt: new Date().toISOString(),
      outcome: "success",
    });

    // 7. Verification
    service.recordVerification(runId, {
      verificationId: "ver-101",
      runId,
      taskId,
      toolId: "create_note",
      strategy: "NoteVerificationStrategy",
      state: "completed",
      timing: { startedAt: new Date().toISOString(), durationMs: 22 },
      outcome: "success",
    });

    // 8. Final Result
    service.recordFinalResult(runId, {
      state: "complete",
      outcome: "success",
      title: "Note Created",
      speechSummary: "Created and verified note in Obsidian vault.",
      cardCount: 1,
      sourceCount: 1,
    });

    // Complete run
    const historyEntry = service.completeRun(runId, "success");
    expect(historyEntry).toBeDefined();
    expect(historyEntry?.sessionId).toBe(sessionId);
    expect(historyEntry?.hermesRunId).toBe(hermesRunId);

    // Retrieve correlated trace
    const trace = service.getTrace(runId);
    expect(trace).toBeDefined();

    // Validate trace against strict schema
    const parseResult = executionTraceSchema.safeParse(trace);
    expect(parseResult.success).toBe(true);

    if (trace) {
      expect(trace.sessionId).toBe(sessionId);
      expect(trace.hermesRunId).toBe(hermesRunId);
      expect(trace.runId).toBe(runId);
      expect(trace.skill?.skillId).toBe("capture-note");
      expect(trace.inference?.provider).toBe("HermesProvider");
      expect(trace.memory?.operation).toBe("retrieval");
      expect(trace.capabilities).toHaveLength(1);
      expect(trace.capabilities[0].toolId).toBe("create_note");
      expect(trace.confirmation?.confirmationId).toBe("conf-101");
      expect(trace.verification?.strategy).toBe("NoteVerificationStrategy");
      expect(trace.finalResult?.title).toBe("Note Created");
    }
  });

  it("includes sanitized traces in DebugSnapshot", () => {
    const service = new DiagnosticService();
    const runId = "run-trace-snap";

    service.startRun(runId, "Read my emails", undefined, { sessionId: "sess-snap" });
    service.completeRun(runId, "success");

    const snapshot = service.getSnapshot();
    const parsed = debugSnapshotSchema.safeParse(snapshot);
    expect(parsed.success).toBe(true);
    expect(snapshot.traces).toBeDefined();
    expect(snapshot.traces?.length).toBeGreaterThanOrEqual(1);
  });

  it("never persists secrets or tokens in execution trace", () => {
    const service = new DiagnosticService();
    const runId = "run-secret-trace";
    const sensitiveMsg = "Use token sk-proj-1234567890abcdef1234567890 to access C:\\Users\\Administrator\\keys.pem";

    service.startRun(runId, sensitiveMsg);
    service.completeRun(runId, "success");

    const trace = service.getTrace(runId);
    expect(trace).toBeDefined();

    const serialized = JSON.stringify(trace);
    expect(serialized).not.toContain("sk-proj-1234567890abcdef1234567890");
    expect(serialized).not.toContain("C:\\Users\\Administrator");
  });
});
