import { z } from "zod";

// 5.1 Common Enums
export const diagnosticLevelSchema = z.enum(["debug", "info", "warn", "error"]);
export type DiagnosticLevel = z.infer<typeof diagnosticLevelSchema>;

export const diagnosticEventTypeSchema = z.enum([
  "agent_started",
  "plan_created",
  "skill_selected",
  "inference_started",
  "inference_completed",
  "memory_queried",
  "memory_stored",
  "capability_invoked",
  "tool_started",
  "tool_completed",
  "tool_failed",
  "confirmation_required",
  "confirmation_confirmed",
  "confirmation_cancelled",
  "confirmation_expired",
  "verification_started",
  "verification_completed",
  "intent_detected",
  "intent_routed",
  "intent_fallback",
  "specialist_spawned",
  "specialist_started",
  "specialist_completed",
  "specialist_failed",
  "specialist_cancelled",
  "provider_started",
  "provider_completed",
  "provider_failed",
  "response_ready",
  "audio_started",
  "audio_finished",
  "audio_interrupted",
  "task_state_changed",
  "run_completed",
  "run_failed",
  "run_cancelled",
]);
export type DiagnosticEventType = z.infer<typeof diagnosticEventTypeSchema>;

export const diagnosticRunStateSchema = z.enum([
  "queued",
  "planning",
  "waiting_for_approval",
  "executing",
  "verifying",
  "completed",
  "failed",
  "cancelled",
]);
export type DiagnosticRunState = z.infer<typeof diagnosticRunStateSchema>;

export const diagnosticOutcomeSchema = z.enum([
  "success",
  "failure",
  "cancelled",
  "expired",
  "pending",
]);
export type DiagnosticOutcome = z.infer<typeof diagnosticOutcomeSchema>;

export const failureCodeSchema = z.enum([
  "provider_unavailable",
  "provider_timeout",
  "provider_cancelled",
  "provider_invalid_output",
  "tool_validation_failed",
  "tool_permission_denied",
  "tool_execution_failed",
  "confirmation_cancelled",
  "confirmation_expired",
  "verification_failed",
  "verification_timeout",
  "verification_invalid_output",
  "stale_run",
  "integration_unavailable",
  "integration_unauthenticated",
  "structured_result_invalid",
  "unknown",
]);
export type FailureCode = z.infer<typeof failureCodeSchema>;

export const failureSourceSchema = z.enum([
  "provider",
  "tool",
  "confirmation",
  "verification",
  "runtime",
  "integration",
  "validation",
  "stale_event",
]);
export type FailureSource = z.infer<typeof failureSourceSchema>;

// 5.2 Timing
export const diagnosticTimingSchema = z
  .object({
    startedAt: z.string().refine((val) => !isNaN(Date.parse(val)), {
      message: "startedAt must be a valid date string",
    }),
    completedAt: z
      .string()
      .refine((val) => !isNaN(Date.parse(val)), {
        message: "completedAt must be a valid date string",
      })
      .optional(),
    durationMs: z.number().finite().nonnegative(),
  })
  .refine(
    (data) => {
      if (!data.completedAt) return true;
      return new Date(data.completedAt).getTime() >= new Date(data.startedAt).getTime();
    },
    {
      message: "completedAt must not precede startedAt",
      path: ["completedAt"],
    }
  );
export type DiagnosticTiming = z.infer<typeof diagnosticTimingSchema>;

// 5.3 Summary
export const diagnosticSummarySchema = z.object({
  label: z.string().min(1).max(120),
  detail: z.string().max(500).optional(),
});
export type DiagnosticSummary = z.infer<typeof diagnosticSummarySchema>;

// 5.4 Failure
export const diagnosticFailureSchema = z.object({
  code: failureCodeSchema,
  message: z.string().min(1).max(500),
  retryable: z.boolean(),
  source: failureSourceSchema,
});
export type DiagnosticFailure = z.infer<typeof diagnosticFailureSchema>;

// 5.5 Provider
export const providerDiagnosticSchema = z.object({
  provider: z.string().min(1).max(100),
  model: z.string().max(100).optional(),
  timing: diagnosticTimingSchema,
  outcome: diagnosticOutcomeSchema,
  timeout: z.boolean(),
  cancelled: z.boolean(),
  failure: diagnosticFailureSchema.optional(),
  safeSummary: diagnosticSummarySchema.optional(),
});
export type ProviderDiagnostic = z.infer<typeof providerDiagnosticSchema>;

// 5.6 Skill
export const skillDiagnosticSchema = z.object({
  skillId: z.string().min(1).max(100),
  selected: z.boolean(),
  timing: diagnosticTimingSchema.optional(),
  outcome: diagnosticOutcomeSchema.optional(),
  summary: diagnosticSummarySchema.optional(),
});
export type SkillDiagnostic = z.infer<typeof skillDiagnosticSchema>;

// 5.7 Tool
export const toolDiagnosticSchema = z.object({
  id: z.string().min(1).max(100),
  runId: z.string().min(1).max(100),
  taskId: z.string().max(100).optional(),
  toolId: z.string().min(1).max(100),
  permission: z.enum(["read", "write", "dangerous", "memory"]),
  state: z.string().min(1).max(50),
  timing: diagnosticTimingSchema,
  outcome: diagnosticOutcomeSchema,
  inputSummary: diagnosticSummarySchema.optional(),
  outputSummary: diagnosticSummarySchema.optional(),
  failure: diagnosticFailureSchema.optional(),
  verificationId: z.string().max(100).optional(),
});
export type ToolDiagnostic = z.infer<typeof toolDiagnosticSchema>;

// 5.8 Confirmation
export const confirmationDiagnosticSchema = z.object({
  confirmationId: z.string().min(1).max(100),
  runId: z.string().min(1).max(100),
  taskId: z.string().max(100).optional(),
  toolId: z.string().min(1).max(100),
  state: z.enum(["pending", "confirmed", "cancelled", "expired", "consumed"]),
  createdAt: z.string().refine((val) => !isNaN(Date.parse(val))),
  expiresAt: z.string().refine((val) => !isNaN(Date.parse(val))),
  resolvedAt: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)))
    .optional(),
  outcome: diagnosticOutcomeSchema,
});
export type ConfirmationDiagnostic = z.infer<typeof confirmationDiagnosticSchema>;

// 5.9 Verification
export const verificationDiagnosticSchema = z.object({
  verificationId: z.string().min(1).max(100),
  runId: z.string().min(1).max(100),
  taskId: z.string().max(100).optional(),
  toolId: z.string().min(1).max(100),
  strategy: z.string().min(1).max(100),
  state: z.enum(["pending", "running", "completed"]),
  timing: diagnosticTimingSchema,
  outcome: z.enum(["success", "failure"]),
  evidenceSummary: diagnosticSummarySchema.optional(),
  failure: diagnosticFailureSchema.optional(),
});
export type VerificationDiagnostic = z.infer<typeof verificationDiagnosticSchema>;

// 5.10 Voice
export const voiceDiagnosticSchema = z.object({
  operation: z.enum(["transcription", "synthesis", "playback"]),
  timing: diagnosticTimingSchema,
  outcome: diagnosticOutcomeSchema,
  interrupted: z.boolean(),
  staleAudioDiscarded: z.boolean(),
  failure: diagnosticFailureSchema.optional(),
});
export type VoiceDiagnostic = z.infer<typeof voiceDiagnosticSchema>;

// Structured Diagnostic Event Record
export const diagnosticEventRecordSchema = z.object({
  id: z.string().min(1).max(100),
  timestamp: z.string().refine((val) => !isNaN(Date.parse(val))),
  level: diagnosticLevelSchema,
  type: diagnosticEventTypeSchema,
  runId: z.string().max(100).optional(),
  taskId: z.string().max(100).optional(),
  message: z.string().min(1).max(300),
  durationMs: z.number().finite().nonnegative().optional(),
  outcome: diagnosticOutcomeSchema.optional(),
  failureCode: failureCodeSchema.optional(),
});
export type DiagnosticEventRecord = z.infer<typeof diagnosticEventRecordSchema>;

// Phase 06: Inference Diagnostic
export const inferenceDiagnosticSchema = z.object({
  provider: z.string().min(1).max(100),
  model: z.string().max(100).optional(),
  timing: diagnosticTimingSchema,
  outcome: diagnosticOutcomeSchema,
  promptChars: z.number().int().nonnegative().optional(),
  completionChars: z.number().int().nonnegative().optional(),
  tokenUsage: z
    .object({
      prompt: z.number().int().nonnegative().optional(),
      completion: z.number().int().nonnegative().optional(),
      total: z.number().int().nonnegative().optional(),
    })
    .optional(),
  failure: diagnosticFailureSchema.optional(),
});
export type InferenceDiagnostic = z.infer<typeof inferenceDiagnosticSchema>;

// Phase 06: Memory Diagnostic
export const memoryDiagnosticSchema = z.object({
  operation: z.enum(["query", "retrieval", "store", "delete"]),
  timing: diagnosticTimingSchema,
  outcome: diagnosticOutcomeSchema,
  querySummary: z.string().max(200).optional(),
  count: z.number().int().nonnegative().optional(),
  // Phase 11: vault-relative paths of notes that influenced the answer.
  sourcePaths: z.array(z.string().max(300)).max(10).optional(),
  failure: diagnosticFailureSchema.optional(),
});
export type MemoryDiagnostic = z.infer<typeof memoryDiagnosticSchema>;

// Phase 07: Intent Diagnostic
export const intentDiagnosticSchema = z.object({
  matched: z.boolean(),
  intentId: z.string().max(100).optional(),
  aliasMatched: z.string().max(150).optional(),
  confidence: z.number().min(0).max(1).optional(),
  route: z.enum(["deterministic", "semantic_hint", "fallback"]),
  targetHandler: z.string().max(100).optional(),
  isDeterministic: z.boolean(),
  activeCapability: z.boolean().default(true),
  candidateSummary: z.string().max(300).optional(),
});
export type IntentDiagnostic = z.infer<typeof intentDiagnosticSchema>;

// Phase 08: Specialist Diagnostic
export const specialistDiagnosticSchema = z.object({
  subagentId: z.string().max(100),
  specialistId: z.string().max(100),
  displayName: z.string().max(150),
  goal: z.string().max(300),
  status: z.enum(["spawned", "running", "completed", "failed", "cancelled"]),
  timing: diagnosticTimingSchema.optional(),
  toolCount: z.number().int().nonnegative().default(0),
  summary: z.string().max(500).optional(),
  error: z.string().max(300).optional(),
});
export type SpecialistDiagnostic = z.infer<typeof specialistDiagnosticSchema>;

// Phase 06: Final Result Diagnostic
export const finalResultDiagnosticSchema = z.object({
  state: z.string().max(50),
  outcome: diagnosticOutcomeSchema,
  title: z.string().max(150).optional(),
  speechSummary: z.string().max(300).optional(),
  cardCount: z.number().int().nonnegative().default(0),
  sourceCount: z.number().int().nonnegative().default(0),
});
export type FinalResultDiagnostic = z.infer<typeof finalResultDiagnosticSchema>;

// 5.11 Run
export const runDiagnosticSchema = z.object({
  runId: z.string().min(1).max(100),
  taskId: z.string().max(100).optional(),
  sessionId: z.string().max(100).optional(),
  hermesRunId: z.string().max(100).optional(),
  requestSummary: z.string().min(1).max(200),
  state: diagnosticRunStateSchema,
  outcome: diagnosticOutcomeSchema,
  createdAt: z.string().refine((val) => !isNaN(Date.parse(val))),
  updatedAt: z.string().refine((val) => !isNaN(Date.parse(val))),
  timing: diagnosticTimingSchema,
  intent: intentDiagnosticSchema.optional(),
  specialists: z.array(specialistDiagnosticSchema).default([]),
  provider: providerDiagnosticSchema.optional(),
  skill: skillDiagnosticSchema.optional(),
  inference: inferenceDiagnosticSchema.optional(),
  memory: memoryDiagnosticSchema.optional(),
  tools: z.array(toolDiagnosticSchema),
  confirmation: confirmationDiagnosticSchema.optional(),
  verification: verificationDiagnosticSchema.optional(),
  finalResult: finalResultDiagnosticSchema.optional(),
  failure: diagnosticFailureSchema.optional(),
  eventCount: z.number().int().nonnegative(),
});
export type RunDiagnostic = z.infer<typeof runDiagnosticSchema>;

// Phase 06: Correlated Execution Trace
export const executionTraceSchema = z.object({
  sessionId: z.string().min(1).max(100),
  runId: z.string().min(1).max(100),
  hermesRunId: z.string().max(100).optional(),
  taskId: z.string().max(100).optional(),
  startedAt: z.string().refine((val) => !isNaN(Date.parse(val))),
  completedAt: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)))
    .optional(),
  durationMs: z.number().finite().nonnegative(),
  state: diagnosticRunStateSchema,
  outcome: diagnosticOutcomeSchema,
  session: z
    .object({
      sessionId: z.string().min(1).max(100),
      channel: z.string().max(50).optional(),
      startedAt: z.string(),
    })
    .optional(),
  intent: intentDiagnosticSchema.optional(),
  specialists: z.array(specialistDiagnosticSchema).default([]),
  run: z.object({
    runId: z.string().min(1).max(100),
    hermesRunId: z.string().max(100).optional(),
    requestSummary: z.string().min(1).max(200),
    state: z.string(),
  }),
  skill: skillDiagnosticSchema.optional(),
  inference: inferenceDiagnosticSchema.optional(),
  memory: memoryDiagnosticSchema.optional(),
  capabilities: z.array(toolDiagnosticSchema).default([]),
  confirmation: confirmationDiagnosticSchema.optional(),
  verification: verificationDiagnosticSchema.optional(),
  finalResult: finalResultDiagnosticSchema.optional(),
  failure: diagnosticFailureSchema.optional(),
});
export type ExecutionTrace = z.infer<typeof executionTraceSchema>;

// 5.12 Execution History
export const executionHistoryEntrySchema = z.object({
  runId: z.string().min(1).max(100),
  taskId: z.string().max(100).optional(),
  sessionId: z.string().max(100).optional(),
  hermesRunId: z.string().max(100).optional(),
  startedAt: z.string().refine((val) => !isNaN(Date.parse(val))),
  completedAt: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)))
    .optional(),
  durationMs: z.number().finite().nonnegative(),
  state: diagnosticRunStateSchema,
  outcome: diagnosticOutcomeSchema,
  requestSummary: z.string().min(1).max(200),
  providerSummary: z.string().max(200).optional(),
  skillSummary: z.string().max(200).optional(),
  specialistSummary: z.string().max(200).optional(),
  inferenceSummary: z.string().max(200).optional(),
  memorySummary: z.string().max(200).optional(),
  toolSummaries: z.array(z.string().max(200)),
  confirmationSummary: z.string().max(200).optional(),
  verificationSummary: z.string().max(200).optional(),
  finalResultSummary: z.string().max(200).optional(),
  failureSummary: z.string().max(200).optional(),
});
export type ExecutionHistoryEntry = z.infer<typeof executionHistoryEntrySchema>;

// 5.13 Debug Snapshot
export const debugSnapshotTotalsSchema = z.object({
  runs: z.number().int().nonnegative(),
  successes: z.number().int().nonnegative(),
  failures: z.number().int().nonnegative(),
  cancelled: z.number().int().nonnegative(),
  confirmations: z.number().int().nonnegative(),
  verifications: z.number().int().nonnegative(),
});
export type DebugSnapshotTotals = z.infer<typeof debugSnapshotTotalsSchema>;

export const debugSnapshotSchema = z.object({
  generatedAt: z.string().refine((val) => !isNaN(Date.parse(val))),
  activeRun: runDiagnosticSchema.optional(),
  recentRuns: z.array(executionHistoryEntrySchema).max(50),
  events: z.array(diagnosticEventRecordSchema).max(200),
  totals: debugSnapshotTotalsSchema,
  recentVoice: z.array(voiceDiagnosticSchema).max(50).optional(),
  traces: z.array(executionTraceSchema).max(50).optional(),
});
export type DebugSnapshot = z.infer<typeof debugSnapshotSchema>;
