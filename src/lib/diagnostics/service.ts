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
  type InferenceDiagnostic,
  type MemoryDiagnostic,
  type IntentDiagnostic,
  type SpecialistDiagnostic,
  type DiagnosticEventType,
  type FinalResultDiagnostic,
  type ExecutionTrace,
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
  private readonly traces: ExecutionTrace[] = [];
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
  startRun(
    runId: string,
    request: string,
    taskId?: string,
    context?: { sessionId?: string; hermesRunId?: string }
  ): RunDiagnostic {
    const now = new Date().toISOString();
    const run: RunDiagnostic = {
      runId,
      taskId,
      sessionId: context?.sessionId,
      hermesRunId: context?.hermesRunId,
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
      specialists: [],
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
   * Records inference diagnostics for a run.
   */
  recordInference(runId: string, inferenceDiag: InferenceDiagnostic): void {
    const run = this.activeRuns.get(runId);
    if (!run) return;
    run.inference = inferenceDiag;
    run.updatedAt = new Date().toISOString();

    this.recordEvent({
      level: inferenceDiag.outcome === "failure" ? "error" : "info",
      type: "inference_completed",
      runId,
      taskId: run.taskId,
      message: `Inference (${inferenceDiag.provider}/${inferenceDiag.model ?? "default"}) finished with ${inferenceDiag.outcome} in ${inferenceDiag.timing.durationMs}ms`,
      durationMs: inferenceDiag.timing.durationMs,
      outcome: inferenceDiag.outcome,
      failureCode: inferenceDiag.failure?.code,
    });
  }

  /**
   * Records memory diagnostics for a run.
   */
  recordMemory(runId: string, memoryDiag: MemoryDiagnostic): void {
    const run = this.activeRuns.get(runId);
    if (!run) return;
    run.memory = memoryDiag;
    run.updatedAt = new Date().toISOString();

    this.recordEvent({
      level: memoryDiag.outcome === "failure" ? "warn" : "info",
      type: memoryDiag.operation === "store" ? "memory_stored" : "memory_queried",
      runId,
      taskId: run.taskId,
      message: `Memory ${memoryDiag.operation} (${memoryDiag.count ?? 0} items) finished with ${memoryDiag.outcome} in ${memoryDiag.timing.durationMs}ms`,
      durationMs: memoryDiag.timing.durationMs,
      outcome: memoryDiag.outcome,
      failureCode: memoryDiag.failure?.code,
    });
  }

  /**
   * Records final result diagnostics for a run.
   */
  recordFinalResult(runId: string, finalResultDiag: FinalResultDiagnostic): void {
    const run = this.activeRuns.get(runId);
    if (!run) return;
    run.finalResult = finalResultDiag;
    run.updatedAt = new Date().toISOString();
  }

  /**
   * Records intent diagnostics for a run.
   */
  recordIntent(runId: string, intentDiag: IntentDiagnostic): void {
    const run = this.activeRuns.get(runId);
    if (!run) return;
    run.intent = intentDiag;
    run.updatedAt = new Date().toISOString();

    const eventType: DiagnosticEventType = intentDiag.matched
      ? intentDiag.route === "deterministic"
        ? "intent_routed"
        : "intent_detected"
      : "intent_fallback";

    this.recordEvent({
      level: "info",
      type: eventType,
      runId,
      taskId: run.taskId,
      message: intentDiag.matched
        ? `Intent [${intentDiag.intentId}] matched via alias "${intentDiag.aliasMatched}" -> ${intentDiag.route} (${intentDiag.targetHandler})`
        : `Intent fallback: ${intentDiag.candidateSummary ?? "routed to Hermes"}`,
      outcome: "success",
    });
  }

  /**
   * Records specialist subagent diagnostics for a run.
   */
  recordSpecialist(runId: string, specialistDiag: SpecialistDiagnostic): void {
    const run = this.activeRuns.get(runId);
    if (!run) return;
    if (!run.specialists) {
      run.specialists = [];
    }
    const existingIndex = run.specialists.findIndex((s) => s.subagentId === specialistDiag.subagentId);
    if (existingIndex >= 0) {
      run.specialists[existingIndex] = specialistDiag;
    } else {
      run.specialists.push(specialistDiag);
    }
    run.updatedAt = new Date().toISOString();

    const eventType: DiagnosticEventType =
      specialistDiag.status === "completed"
        ? "specialist_completed"
        : specialistDiag.status === "failed"
        ? "specialist_failed"
        : specialistDiag.status === "cancelled"
        ? "specialist_cancelled"
        : specialistDiag.status === "running"
        ? "specialist_started"
        : "specialist_spawned";

    this.recordEvent({
      level: specialistDiag.status === "failed" ? "warn" : "info",
      type: eventType,
      runId,
      taskId: run.taskId,
      message: `Specialist [${specialistDiag.displayName}] (${specialistDiag.specialistId}) ${specialistDiag.status}: "${specialistDiag.goal.slice(0, 100)}"`,
      outcome:
        specialistDiag.status === "completed"
          ? "success"
          : specialistDiag.status === "failed"
          ? "failure"
          : "pending",
      durationMs: specialistDiag.timing?.durationMs,
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
      sessionId: run.sessionId,
      hermesRunId: run.hermesRunId,
      startedAt: run.timing.startedAt,
      completedAt: now,
      durationMs: run.timing.durationMs,
      state: run.state,
      outcome: run.outcome,
      requestSummary: run.requestSummary,
      providerSummary: run.provider ? `${run.provider.provider} (${run.provider.timing.durationMs}ms)` : undefined,
      skillSummary: run.skill?.skillId,
      specialistSummary:
        run.specialists && run.specialists.length > 0
          ? `${run.specialists.length} subagents (${run.specialists.map((s) => s.displayName).join(", ")})`
          : undefined,
      inferenceSummary: run.inference ? `${run.inference.provider} (${run.inference.timing.durationMs}ms)` : undefined,
      memorySummary: run.memory ? `${run.memory.operation}: ${run.memory.count ?? 0} items` : undefined,
      toolSummaries: run.tools.map((t) => `${t.toolId}: ${t.outcome} (${t.timing.durationMs}ms)`),
      confirmationSummary: run.confirmation ? `${run.confirmation.toolId}: ${run.confirmation.state}` : undefined,
      verificationSummary: run.verification
        ? `${run.verification.toolId}: ${run.verification.outcome} (${run.verification.strategy})`
        : undefined,
      finalResultSummary: run.finalResult?.speechSummary,
      failureSummary: run.failure?.message,
    };

    this.history.push(historyEntry);
    if (this.history.length > MAX_EXECUTION_HISTORY) {
      this.history.shift();
    }

    // Build unified correlated execution trace
    const trace: ExecutionTrace = {
      sessionId: run.sessionId ?? run.runId,
      runId: run.runId,
      hermesRunId: run.hermesRunId,
      taskId: run.taskId,
      startedAt: run.timing.startedAt,
      completedAt: now,
      durationMs: run.timing.durationMs,
      state: run.state,
      outcome: run.outcome,
      session: {
        sessionId: run.sessionId ?? run.runId,
        startedAt: run.timing.startedAt,
      },
      intent: run.intent,
      run: {
        runId: run.runId,
        hermesRunId: run.hermesRunId,
        requestSummary: run.requestSummary,
        state: run.state,
      },
      skill: run.skill,
      specialists: [...(run.specialists ?? [])],
      inference: run.inference,
      memory: run.memory,
      capabilities: [...run.tools],
      confirmation: run.confirmation,
      verification: run.verification,
      finalResult: run.finalResult,
      failure: run.failure,
    };

    this.traces.push(trace);
    if (this.traces.length > MAX_EXECUTION_HISTORY) {
      this.traces.shift();
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
   * Retrieves a correlated execution trace by runId.
   */
  getTrace(runId: string): ExecutionTrace | undefined {
    return this.traces.find((t) => t.runId === runId);
  }

  /**
   * Retrieves all correlated execution traces.
   */
  getTraces(): ExecutionTrace[] {
    return [...this.traces];
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
      traces: JSON.parse(JSON.stringify(this.traces.slice(-MAX_EXECUTION_HISTORY))),
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
    this.traces.length = 0;
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
