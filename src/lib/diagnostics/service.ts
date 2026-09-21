import { randomUUID } from "node:crypto";
import {
  type DebugSnapshot,
  type DebugSnapshotTotals,
  type DiagnosticEventRecord,
  type DiagnosticFailure,
  type DiagnosticOutcome,
  type DiagnosticRunState,
  type ExecutionHistoryEntry,
  type ProviderDiagnostic,
  type RunDiagnostic,
  type SkillDiagnostic,
  type ToolDiagnostic,
  type ConfirmationDiagnostic,
  type VerificationDiagnostic,
  type VoiceDiagnostic,
  debugSnapshotSchema,
} from "@/lib/contracts/diagnostics";
import { safeSummaryText } from "./sanitizer";

export const MAX_DIAGNOSTIC_EVENTS = 200;
export const MAX_EXECUTION_HISTORY = 50;
export const MAX_VOICE_HISTORY = 50;

export class DiagnosticService {
  private readonly events: DiagnosticEventRecord[] = [];
  private readonly history: ExecutionHistoryEntry[] = [];
  private readonly activeRuns = new Map<string, RunDiagnostic>();
  private readonly recentVoice: VoiceDiagnostic[] = [];
  private currentActiveRunId: string | null = null;

  private totals: DebugSnapshotTotals = {
    runs: 0,
    successes: 0,
    failures: 0,
    cancelled: 0,
    confirmations: 0,
    verifications: 0,
  };

  /**
   * Records a structured diagnostic event.
   * Maintains a bounded event queue (max 200).
   */
  recordEvent(
    data: Omit<DiagnosticEventRecord, "id" | "timestamp" | "message"> & {
      message: string;
      timestamp?: string;
    }
  ): DiagnosticEventRecord {
    const event: DiagnosticEventRecord = {
      id: `evt-${randomUUID()}`,
      timestamp: data.timestamp ?? new Date().toISOString(),
      level: data.level,
      type: data.type,
      runId: data.runId,
      taskId: data.taskId,
      message: safeSummaryText(data.message, 300),
      durationMs: data.durationMs,
      outcome: data.outcome,
      failureCode: data.failureCode,
    };

    this.events.push(event);
    if (this.events.length > MAX_DIAGNOSTIC_EVENTS) {
      this.events.shift();
    }

    if (data.runId && this.activeRuns.has(data.runId)) {
      const run = this.activeRuns.get(data.runId)!;
      run.eventCount += 1;
      run.updatedAt = new Date().toISOString();
    }

    return event;
  }

  /**
   * Starts tracking a new agent run.
   */
  startRun(runId: string, request: string, taskId?: string): RunDiagnostic {
    const now = new Date().toISOString();
    const run: RunDiagnostic = {
      runId,
      taskId,
      requestSummary: safeSummaryText(request, 200),
      state: "planning",
      outcome: "pending",
      createdAt: now,
      updatedAt: now,
      timing: {
        startedAt: now,
        durationMs: 0,
      },
      tools: [],
      eventCount: 0,
    };

    this.activeRuns.set(runId, run);
    this.currentActiveRunId = runId;
    this.totals.runs += 1;

    this.recordEvent({
      level: "info",
      type: "agent_started",
      runId,
      taskId,
      message: `Run started: ${run.requestSummary}`,
    });

    return run;
  }

  /**
   * Updates state or properties of an active run.
   */
  updateRunState(runId: string, state: DiagnosticRunState, outcome?: DiagnosticOutcome): void {
    const run = this.activeRuns.get(runId);
    if (!run) return;

    // Terminal state protection: cancelled or failed runs cannot be revived to executing/completed
    if (run.state === "cancelled" && state !== "cancelled") {
      return;
    }

    run.state = state;
    if (outcome) run.outcome = outcome;
    run.updatedAt = new Date().toISOString();

    const nowMs = Date.now();
    const startMs = new Date(run.timing.startedAt).getTime();
    run.timing.durationMs = Math.max(0, nowMs - startMs);

    this.recordEvent({
      level: state === "failed" ? "error" : "info",
      type: "task_state_changed",
      runId,
      taskId: run.taskId,
      message: `Run state transitioned to: ${state}`,
      outcome: run.outcome,
    });
  }

  /**
   * Records provider diagnostics for a run.
   */
  recordProvider(runId: string, providerDiag: ProviderDiagnostic): void {
    const run = this.activeRuns.get(runId);
    if (!run) return;
    run.provider = providerDiag;
    run.updatedAt = new Date().toISOString();

    this.recordEvent({
      level: providerDiag.outcome === "failure" ? "error" : "info",
      type: providerDiag.outcome === "failure" ? "provider_failed" : "provider_completed",
      runId,
      taskId: run.taskId,
      message: `Provider ${providerDiag.provider} (${providerDiag.model ?? "default"}) finished with ${providerDiag.outcome} in ${providerDiag.timing.durationMs}ms`,
      durationMs: providerDiag.timing.durationMs,
      outcome: providerDiag.outcome,
      failureCode: providerDiag.failure?.code,
    });
  }

  /**
   * Records skill diagnostics for a run.
   */
  recordSkill(runId: string, skillDiag: SkillDiagnostic): void {
    const run = this.activeRuns.get(runId);
    if (!run) return;
    run.skill = skillDiag;
    run.updatedAt = new Date().toISOString();

    this.recordEvent({
      level: "info",
      type: "skill_selected",
      runId,
      taskId: run.taskId,
      message: `Skill selected: ${skillDiag.skillId}`,
      outcome: skillDiag.outcome ?? "success",
    });
  }

  /**
   * Records tool diagnostics for a run.
   */
  recordTool(runId: string, toolDiag: ToolDiagnostic): void {
    const run = this.activeRuns.get(runId);
    if (!run) return;

    const existingIndex = run.tools.findIndex((t) => t.id === toolDiag.id);
    if (existingIndex >= 0) {
      run.tools[existingIndex] = toolDiag;
    } else {
      run.tools.push(toolDiag);
    }
    run.updatedAt = new Date().toISOString();

    this.recordEvent({
      level: toolDiag.outcome === "failure" ? "error" : "info",
      type: toolDiag.outcome === "failure" ? "tool_failed" : "tool_completed",
      runId,
      taskId: run.taskId,
      message: `Tool ${toolDiag.toolId} (${toolDiag.permission}) finished with ${toolDiag.outcome} in ${toolDiag.timing.durationMs}ms`,
      durationMs: toolDiag.timing.durationMs,
      outcome: toolDiag.outcome,
      failureCode: toolDiag.failure?.code,
    });
  }

  /**
   * Records confirmation diagnostics for a run.
   */
  recordConfirmation(runId: string, confirmationDiag: ConfirmationDiagnostic): void {
    const run = this.activeRuns.get(runId);
    if (run) {
      run.confirmation = confirmationDiag;
      run.updatedAt = new Date().toISOString();
    }
    this.totals.confirmations += 1;

    const eventType =
      confirmationDiag.state === "confirmed"
        ? "confirmation_confirmed"
        : confirmationDiag.state === "cancelled"
        ? "confirmation_cancelled"
        : confirmationDiag.state === "expired"
        ? "confirmation_expired"
        : "confirmation_required";

    this.recordEvent({
      level: confirmationDiag.state === "cancelled" || confirmationDiag.state === "expired" ? "warn" : "info",
      type: eventType,
      runId,
      taskId: run?.taskId ?? confirmationDiag.taskId,
      message: `Confirmation for ${confirmationDiag.toolId} state: ${confirmationDiag.state}`,
      outcome: confirmationDiag.outcome,
      failureCode:
        confirmationDiag.state === "cancelled"
          ? "confirmation_cancelled"
          : confirmationDiag.state === "expired"
          ? "confirmation_expired"
          : undefined,
    });
  }

  /**
   * Records verification diagnostics for a run.
   */
  recordVerification(runId: string, verificationDiag: VerificationDiagnostic): void {
    const run = this.activeRuns.get(runId);
    if (run) {
      run.verification = verificationDiag;
      run.updatedAt = new Date().toISOString();
    }
    this.totals.verifications += 1;

    this.recordEvent({
      level: verificationDiag.outcome === "failure" ? "error" : "info",
      type: "verification_completed",
      runId,
      taskId: run?.taskId ?? verificationDiag.taskId,
      message: `Verification (${verificationDiag.strategy}) for ${verificationDiag.toolId}: ${verificationDiag.outcome} in ${verificationDiag.timing.durationMs}ms`,
      durationMs: verificationDiag.timing.durationMs,
      outcome: verificationDiag.outcome === "success" ? "success" : "failure",
      failureCode: verificationDiag.failure?.code,
    });
  }

  /**
   * Records voice diagnostics (ephemeral, zero audio persistence).
   */
  recordVoice(voiceDiag: VoiceDiagnostic): void {
    this.recentVoice.push(voiceDiag);
    if (this.recentVoice.length > MAX_VOICE_HISTORY) {
      this.recentVoice.shift();
    }

    this.recordEvent({
      level: voiceDiag.outcome === "failure" ? "error" : "info",
      type: voiceDiag.interrupted ? "audio_interrupted" : "audio_finished",
      message: `Voice ${voiceDiag.operation} ${voiceDiag.interrupted ? "interrupted" : voiceDiag.outcome} (${voiceDiag.timing.durationMs}ms)`,
      durationMs: voiceDiag.timing.durationMs,
      outcome: voiceDiag.outcome,
      failureCode: voiceDiag.failure?.code,
    });
  }

  /**
   * Completes an active run, records execution history, and maintains bounds.
   */
  completeRun(
    runId: string,
    outcome: DiagnosticOutcome,
    failure?: DiagnosticFailure
  ): ExecutionHistoryEntry | undefined {
    const run = this.activeRuns.get(runId);
    if (!run) return undefined;

    const now = new Date().toISOString();
    run.timing.completedAt = now;
    const startMs = new Date(run.timing.startedAt).getTime();
    run.timing.durationMs = Math.max(0, new Date(now).getTime() - startMs);

    run.outcome = outcome;
    run.state =
      outcome === "success"
        ? "completed"
        : outcome === "cancelled"
        ? "cancelled"
        : "failed";
    if (failure) run.failure = failure;

    if (outcome === "success") this.totals.successes += 1;
    else if (outcome === "cancelled") this.totals.cancelled += 1;
    else this.totals.failures += 1;

    const historyEntry: ExecutionHistoryEntry = {
      runId: run.runId,
      taskId: run.taskId,
      startedAt: run.timing.startedAt,
      completedAt: now,
      durationMs: run.timing.durationMs,
      state: run.state,
      outcome: run.outcome,
      requestSummary: run.requestSummary,
      providerSummary: run.provider ? `${run.provider.provider} (${run.provider.timing.durationMs}ms)` : undefined,
      skillSummary: run.skill?.skillId,
      toolSummaries: run.tools.map((t) => `${t.toolId}: ${t.outcome} (${t.timing.durationMs}ms)`),
      confirmationSummary: run.confirmation ? `${run.confirmation.toolId}: ${run.confirmation.state}` : undefined,
      verificationSummary: run.verification
        ? `${run.verification.toolId}: ${run.verification.outcome} (${run.verification.strategy})`
        : undefined,
      failureSummary: run.failure?.message,
    };

    this.history.push(historyEntry);
    if (this.history.length > MAX_EXECUTION_HISTORY) {
      this.history.shift();
    }

    this.recordEvent({
      level: outcome === "failure" ? "error" : "info",
      type: outcome === "failure" ? "run_failed" : outcome === "cancelled" ? "run_cancelled" : "run_completed",
      runId,
      taskId: run.taskId,
      message: `Run finished with outcome ${outcome} in ${run.timing.durationMs}ms`,
      durationMs: run.timing.durationMs,
      outcome,
      failureCode: failure?.code,
    });

    if (this.currentActiveRunId === runId) {
      this.currentActiveRunId = null;
    }
    this.activeRuns.delete(runId);

    return historyEntry;
  }

  /**
   * Produces a sanitized, validated DebugSnapshot.
   */
  getSnapshot(): DebugSnapshot {
    const activeRun = this.currentActiveRunId
      ? this.activeRuns.get(this.currentActiveRunId)
      : undefined;

    const rawSnapshot = {
      generatedAt: new Date().toISOString(),
      activeRun: activeRun ? JSON.parse(JSON.stringify(activeRun)) : undefined,
      recentRuns: JSON.parse(JSON.stringify(this.history.slice(-MAX_EXECUTION_HISTORY))),
      events: JSON.parse(JSON.stringify(this.events.slice(-MAX_DIAGNOSTIC_EVENTS))),
      totals: { ...this.totals },
      recentVoice: JSON.parse(JSON.stringify(this.recentVoice.slice(-MAX_VOICE_HISTORY))),
    };

    return debugSnapshotSchema.parse(rawSnapshot);
  }

  /**
   * Resets all diagnostics state (useful for tests).
   */
  clear(): void {
    this.events.length = 0;
    this.history.length = 0;
    this.activeRuns.clear();
    this.recentVoice.length = 0;
    this.currentActiveRunId = null;
    this.totals = {
      runs: 0,
      successes: 0,
      failures: 0,
      cancelled: 0,
      confirmations: 0,
      verifications: 0,
    };
  }
}

// Global singleton instance for application runtime
let globalDiagnosticService: DiagnosticService | undefined;

export function getDiagnosticService(): DiagnosticService {
  if (!globalDiagnosticService) {
    globalDiagnosticService = new DiagnosticService();
  }
  return globalDiagnosticService;
}
