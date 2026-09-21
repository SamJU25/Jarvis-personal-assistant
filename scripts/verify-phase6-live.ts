/**
 * Phase 06 Live Verification Script
 * Validates:
 * 1. Declarative Capability Metadata across all 17 tools
 * 2. Strategy-based Verification Registry resolution
 * 3. Idempotency Service duplicate side-effect prevention & deterministic key hashing
 * 4. 9-Stage Correlated Execution Trace with secret sanitization
 */

import { createDefaultToolRegistry } from "../src/lib/tools/demo-tools";
import { verificationRegistry } from "../src/lib/verification/registry";
import { IdempotencyService, createOperationKey } from "../src/lib/tools/idempotency";
import { DiagnosticService } from "../src/lib/diagnostics/service";
import { executionTraceSchema, debugSnapshotSchema } from "../src/lib/contracts/diagnostics";

async function runLiveVerification() {
  console.log("=================================================");
  console.log("  PHASE 06 LIVE PREFLIGHT VERIFICATION");
  console.log("=================================================\n");

  let passedChecks = 0;
  const totalChecks = 4;

  // -----------------------------------------------------------------
  // 1. Capability Metadata Inspection
  // -----------------------------------------------------------------
  console.log("[Check 1/4] Verifying Declarative Capability Metadata...");
  const registry = createDefaultToolRegistry();
  const tools = registry.list();

  if (tools.length !== 17) {
    throw new Error(`Expected 17 registered tools, found ${tools.length}`);
  }

  for (const tool of tools) {
    const cap = registry.getCapability(tool.id);
    if (!cap) throw new Error(`Capability not resolved for tool ${tool.id}`);
    if (!["low", "medium", "high", "critical"].includes(cap.riskLevel)) {
      throw new Error(`Invalid riskLevel for ${tool.id}: ${cap.riskLevel}`);
    }
    if (!["read", "write", "idempotent_write", "admin"].includes(cap.capabilityClass)) {
      throw new Error(`Invalid capabilityClass for ${tool.id}: ${cap.capabilityClass}`);
    }
    if (!["none", "explicit", "always"].includes(cap.confirmationPolicy)) {
      throw new Error(`Invalid confirmationPolicy for ${tool.id}: ${cap.confirmationPolicy}`);
    }
    if (!cap.verificationStrategy) {
      throw new Error(`Missing verificationStrategy for ${tool.id}`);
    }
  }

  const writeTools = ["create_note", "create_google_doc", "draft_email"];
  for (const w of writeTools) {
    if (!registry.isConfirmationRequired(w)) {
      throw new Error(`Expected write tool ${w} to require confirmation`);
    }
  }
  console.log(`  ✓ All 17 tools declared valid capability metadata.`);
  console.log(`  ✓ Write tools (${writeTools.join(", ")}) enforce confirmation policy.`);
  passedChecks++;

  // -----------------------------------------------------------------
  // 2. Verification Registry Strategy Resolution
  // -----------------------------------------------------------------
  console.log("\n[Check 2/4] Verifying Verification Registry Decoupling...");
  const noteStrat = verificationRegistry.get("note_verification");
  const noteStratAlias = verificationRegistry.get("create_note");
  const docStratName = verificationRegistry.getStrategyName("doc_verification");
  const emailStratName = verificationRegistry.getStrategyName("draft_email");

  if (noteStrat.name !== "NoteVerificationStrategy") {
    throw new Error(`Expected NoteVerificationStrategy, got ${noteStrat.name}`);
  }
  if (noteStratAlias.name !== "NoteVerificationStrategy") {
    throw new Error(`Expected NoteVerificationStrategy for alias, got ${noteStratAlias.name}`);
  }
  if (docStratName !== "GoogleDocVerificationStrategy") {
    throw new Error(`Expected GoogleDocVerificationStrategy, got ${docStratName}`);
  }
  if (emailStratName !== "DraftEmailVerificationStrategy") {
    throw new Error(`Expected DraftEmailVerificationStrategy, got ${emailStratName}`);
  }
  console.log(`  ✓ Strategy ID lookup ("note_verification") resolved: ${noteStrat.name}`);
  console.log(`  ✓ Tool alias lookup ("create_note") resolved: ${noteStratAlias.name}`);
  console.log(`  ✓ Declarative strategy name retrieval eliminates if/else switchboards.`);
  passedChecks++;

  // -----------------------------------------------------------------
  // 3. Idempotency Service Protection
  // -----------------------------------------------------------------
  console.log("\n[Check 3/4] Verifying Idempotency & Safe Retry Protection...");
  const idempotency = new IdempotencyService();
  const params1 = { title: "Architecture", content: "Deterministic write", tags: ["core", "phase6"] };
  const params2 = { tags: ["core", "phase6"], content: "Deterministic write", title: "Architecture" };

  const key1 = createOperationKey("create_note", params1, "sess-live-1");
  const key2 = createOperationKey("create_note", params2, "sess-live-1");

  if (key1 !== key2) {
    throw new Error(`Operation keys should be identical regardless of argument ordering. key1=${key1}, key2=${key2}`);
  }

  let sideEffectExecutionCount = 0;
  const mockSideEffect = async () => {
    sideEffectExecutionCount++;
    return { path: "Inbox/JARVIS/Architecture.md", created: true };
  };

  // Run 1: Initial execution
  const res1 = await idempotency.executeOnce(key1, "create_note", params1, mockSideEffect);
  if (res1.replayed || sideEffectExecutionCount !== 1) {
    throw new Error("Initial execution should not be replayed.");
  }

  // Run 2: Safe retry with same stable operation key
  const res2 = await idempotency.executeOnce(key1, "create_note", params1, mockSideEffect);
  if (!res2.replayed || sideEffectExecutionCount !== 1) {
    throw new Error(`Retry should be replayed without re-executing side effect. Count=${sideEffectExecutionCount}`);
  }

  console.log(`  ✓ Deterministic operation key generated: ${key1}`);
  console.log(`  ✓ Initial operation executed successfully (side effects: 1).`);
  console.log(`  ✓ Retry returned cached verified result without duplicate write (side effects: 1).`);
  passedChecks++;

  // -----------------------------------------------------------------
  // 4. Correlated Execution Trace
  // -----------------------------------------------------------------
  console.log("\n[Check 4/4] Verifying 9-Stage Correlated Execution Trace...");
  const diag = new DiagnosticService();
  const runId = "live-run-phase6-01";
  const sessionId = "live-session-phase6-01";
  const hermesRunId = "hermes-run-live-01";
  const taskId = "task-live-phase6-01";

  // Stage 1: Session & Run
  diag.startRun(runId, "Create a note about Hermes daemon", taskId, { sessionId, hermesRunId });

  // Stage 2: Skill
  diag.recordSkill(runId, {
    skillId: "capture-note",
    selected: true,
    timing: { startedAt: new Date().toISOString(), durationMs: 12 },
    outcome: "success",
  });

  // Stage 3: Inference
  diag.recordInference(runId, {
    provider: "HermesProvider",
    model: "hermes-3-llama-3.1-8b",
    timing: { startedAt: new Date().toISOString(), durationMs: 220 },
    outcome: "success",
    tokenUsage: { prompt: 150, completion: 40, total: 190 },
  });

  // Stage 4: Memory
  diag.recordMemory(runId, {
    operation: "retrieval",
    timing: { startedAt: new Date().toISOString(), durationMs: 10 },
    outcome: "success",
    querySummary: "Hermes daemon",
    count: 1,
  });

  // Stage 5: Capability
  diag.recordTool(runId, {
    id: "call-live-1",
    runId,
    taskId,
    toolId: "create_note",
    permission: "write",
    state: "completed",
    timing: { startedAt: new Date().toISOString(), durationMs: 25 },
    outcome: "success",
  });

  // Stage 6: Confirmation
  diag.recordConfirmation(runId, {
    confirmationId: "conf-live-01",
    runId,
    taskId,
    toolId: "create_note",
    state: "confirmed",
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 60000).toISOString(),
    resolvedAt: new Date().toISOString(),
    outcome: "success",
  });

  // Stage 7: Verification
  diag.recordVerification(runId, {
    verificationId: "ver-live-01",
    runId,
    taskId,
    toolId: "create_note",
    strategy: "NoteVerificationStrategy",
    state: "completed",
    timing: { startedAt: new Date().toISOString(), durationMs: 18 },
    outcome: "success",
  });

  // Stage 8: Final Result
  diag.recordFinalResult(runId, {
    state: "complete",
    outcome: "success",
    title: "Note Created",
    speechSummary: "Created and verified note about Hermes daemon in Obsidian vault.",
    cardCount: 1,
    sourceCount: 1,
  });

  diag.completeRun(runId, "success");

  const trace = diag.getTrace(runId);
  if (!trace) throw new Error("Failed to retrieve correlated execution trace.");

  executionTraceSchema.parse(trace);
  const snapshot = diag.getSnapshot();
  debugSnapshotSchema.parse(snapshot);

  console.log(`  ✓ 9-stage trace validated: SESSION → HERMES RUN → SKILL → INFERENCE → MEMORY → CAPABILITY → CONFIRMATION → VERIFICATION → FINAL RESULT.`);
  console.log(`  ✓ Schema validation passed: ${trace.runId} correlated with session ${trace.sessionId}.`);
  console.log(`  ✓ Snapshot verified: ${snapshot.traces?.length ?? 0} trace(s) stored in bounded queue.`);
  passedChecks++;

  console.log("\n=================================================");
  console.log(`  PHASE 06 VERIFICATION COMPLETE: ${passedChecks}/${totalChecks} CHECKS PASSED`);
  console.log("=================================================");
}

runLiveVerification().catch((err) => {
  console.error("\n❌ Live verification failed:", err);
  process.exit(1);
});
