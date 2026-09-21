import { describe, expect, it } from "vitest";
import {
  diagnosticLevelSchema,
  diagnosticEventTypeSchema,
  diagnosticRunStateSchema,
  diagnosticOutcomeSchema,
  failureCodeSchema,
  diagnosticTimingSchema,
  diagnosticSummarySchema,
  diagnosticFailureSchema,
  providerDiagnosticSchema,
  toolDiagnosticSchema,
  confirmationDiagnosticSchema,
  verificationDiagnosticSchema,
  voiceDiagnosticSchema,
  diagnosticEventRecordSchema,
  runDiagnosticSchema,
  executionHistoryEntrySchema,
  debugSnapshotSchema,
} from "@/lib/contracts/diagnostics";

describe("Phase 11 Canonical Diagnostic Contract", () => {
  it("validates diagnostic enums", () => {
    expect(diagnosticLevelSchema.safeParse("info").success).toBe(true);
    expect(diagnosticLevelSchema.safeParse("unknown_level").success).toBe(false);

    expect(diagnosticEventTypeSchema.safeParse("tool_started").success).toBe(true);
    expect(diagnosticEventTypeSchema.safeParse("verification_completed").success).toBe(true);
    expect(diagnosticEventTypeSchema.safeParse("audio_interrupted").success).toBe(true);
    expect(diagnosticEventTypeSchema.safeParse("invalid_event").success).toBe(false);

    expect(diagnosticRunStateSchema.safeParse("waiting_for_approval").success).toBe(true);
    expect(diagnosticOutcomeSchema.safeParse("cancelled").success).toBe(true);
    expect(failureCodeSchema.safeParse("verification_failed").success).toBe(true);
    expect(failureCodeSchema.safeParse("stale_run").success).toBe(true);
  });

  it("validates DiagnosticTiming with valid ISO timestamps and non-negative duration", () => {
    const valid = diagnosticTimingSchema.safeParse({
      startedAt: "2026-09-21T00:00:00.000Z",
      completedAt: "2026-09-21T00:00:01.500Z",
      durationMs: 1500,
    });
    expect(valid.success).toBe(true);

    // Negative duration should fail
    const negativeDuration = diagnosticTimingSchema.safeParse({
      startedAt: "2026-09-21T00:00:00.000Z",
      durationMs: -50,
    });
    expect(negativeDuration.success).toBe(false);

    // completedAt preceding startedAt should fail
    const invertedTimes = diagnosticTimingSchema.safeParse({
      startedAt: "2026-09-21T00:00:05.000Z",
      completedAt: "2026-09-21T00:00:01.000Z",
      durationMs: 4000,
    });
    expect(invertedTimes.success).toBe(false);
  });

  it("validates DiagnosticSummary constraints", () => {
    expect(diagnosticSummarySchema.safeParse({ label: "Short label" }).success).toBe(true);
    // Label over 120 chars must fail
    expect(diagnosticSummarySchema.safeParse({ label: "a".repeat(121) }).success).toBe(false);
    // Detail over 500 chars must fail
    expect(
      diagnosticSummarySchema.safeParse({ label: "Ok", detail: "d".repeat(501) }).success
    ).toBe(false);
  });

  it("validates DiagnosticFailure", () => {
    const failure = diagnosticFailureSchema.safeParse({
      code: "tool_execution_failed",
      message: "Process exited with error",
      retryable: false,
      source: "tool",
    });
    expect(failure.success).toBe(true);

    const invalidSource = diagnosticFailureSchema.safeParse({
      code: "unknown",
      message: "Err",
      retryable: false,
      source: "arbitrary_model_code",
    });
    expect(invalidSource.success).toBe(false);
  });

  it("validates ProviderDiagnostic and ToolDiagnostic", () => {
    const provider = providerDiagnosticSchema.safeParse({
      provider: "CommandCodeProvider",
      model: "default",
      timing: { startedAt: "2026-09-21T00:00:00.000Z", durationMs: 120 },
      outcome: "success",
      timeout: false,
      cancelled: false,
    });
    expect(provider.success).toBe(true);

    const tool = toolDiagnosticSchema.safeParse({
      id: "tool-1",
      runId: "run-1",
      toolId: "create_note",
      permission: "write",
      state: "completed",
      timing: { startedAt: "2026-09-21T00:00:00.000Z", durationMs: 45 },
      outcome: "success",
    });
    expect(tool.success).toBe(true);
  });

  it("validates ConfirmationDiagnostic and VerificationDiagnostic", () => {
    const conf = confirmationDiagnosticSchema.safeParse({
      confirmationId: "conf-123",
      runId: "run-1",
      toolId: "create_note",
      state: "pending",
      createdAt: "2026-09-21T00:00:00.000Z",
      expiresAt: "2026-09-21T00:01:00.000Z",
      outcome: "pending",
    });
    expect(conf.success).toBe(true);

    const ver = verificationDiagnosticSchema.safeParse({
      verificationId: "ver-1",
      runId: "run-1",
      toolId: "create_note",
      strategy: "NoteVerificationStrategy",
      state: "completed",
      timing: { startedAt: "2026-09-21T00:00:00.000Z", durationMs: 30 },
      outcome: "success",
    });
    expect(ver.success).toBe(true);
  });

  it("validates DiagnosticEventRecord and RunDiagnostic", () => {
    const event = diagnosticEventRecordSchema.safeParse({
      id: "evt-123",
      timestamp: "2026-09-21T00:00:00.000Z",
      level: "info",
      type: "tool_completed",
      runId: "run-123",
      taskId: "task-123",
      message: "Tool finished",
      durationMs: 45,
      outcome: "success",
    });
    expect(event.success).toBe(true);

    const run = runDiagnosticSchema.safeParse({
      runId: "run-123",
      taskId: "task-123",
      requestSummary: "Read note",
      state: "completed",
      outcome: "success",
      createdAt: "2026-09-21T00:00:00.000Z",
      updatedAt: "2026-09-21T00:00:01.000Z",
      timing: { startedAt: "2026-09-21T00:00:00.000Z", durationMs: 1000 },
      tools: [],
      eventCount: 2,
    });
    expect(run.success).toBe(true);
  });

  it("validates VoiceDiagnostic", () => {
    const voice = voiceDiagnosticSchema.safeParse({
      operation: "transcription",
      timing: { startedAt: "2026-09-21T00:00:00.000Z", durationMs: 250 },
      outcome: "success",
      interrupted: false,
      staleAudioDiscarded: false,
    });
    expect(voice.success).toBe(true);
  });

  it("validates ExecutionHistoryEntry and DebugSnapshot bounded structure", () => {
    const historyEntry = executionHistoryEntrySchema.safeParse({
      runId: "run-abc",
      startedAt: "2026-09-21T00:00:00.000Z",
      durationMs: 500,
      state: "completed",
      outcome: "success",
      requestSummary: "Take a note",
      toolSummaries: ["create_note: Note created"],
    });
    expect(historyEntry.success).toBe(true);

    const snapshot = debugSnapshotSchema.safeParse({
      generatedAt: "2026-09-21T00:00:01.000Z",
      recentRuns: [historyEntry.data!],
      events: [
        {
          id: "evt-1",
          timestamp: "2026-09-21T00:00:00.000Z",
          level: "info",
          type: "agent_started",
          message: "Agent run started",
        },
      ],
      totals: {
        runs: 1,
        successes: 1,
        failures: 0,
        cancelled: 0,
        confirmations: 0,
        verifications: 0,
      },
    });
    expect(snapshot.success).toBe(true);
  });
});
