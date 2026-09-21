import { describe, expect, it, beforeEach } from "vitest";
import { DiagnosticService } from "@/lib/diagnostics/service";
import type { ToolDiagnostic, ConfirmationDiagnostic, VerificationDiagnostic, VoiceDiagnostic } from "@/lib/contracts/diagnostics";

describe("Phase 11 Diagnostic Correlation & Stale Run Protection", () => {
  let service: DiagnosticService;

  beforeEach(() => {
    service = new DiagnosticService();
  });

  it("correlates runId, taskId across provider, tools, confirmation, verification, and events", () => {
    const runId = "run-corr-1";
    const taskId = "task-corr-1";

    service.startRun(runId, "Create obsidian meeting note", taskId);

    // Provider correlated
    service.recordProvider(runId, {
      provider: "CommandCodeProvider",
      model: "default",
      timing: { startedAt: "2026-09-21T00:00:00.000Z", durationMs: 200 },
      outcome: "success",
      timeout: false,
      cancelled: false,
    });

    // Tool correlated
    const toolDiag: ToolDiagnostic = {
      id: "tool-call-1",
      runId,
      taskId,
      toolId: "create_note",
      permission: "write",
      state: "completed",
      timing: { startedAt: "2026-09-21T00:00:00.200Z", durationMs: 45 },
      outcome: "success",
      verificationId: "verif-1",
    };
    service.recordTool(runId, toolDiag);

    // Confirmation correlated
    const confDiag: ConfirmationDiagnostic = {
      confirmationId: "conf-1",
      runId,
      taskId,
      toolId: "create_note",
      state: "confirmed",
      createdAt: "2026-09-21T00:00:00.100Z",
      expiresAt: "2026-09-21T00:01:00.100Z",
      resolvedAt: "2026-09-21T00:00:00.180Z",
      outcome: "success",
    };
    service.recordConfirmation(runId, confDiag);

    // Verification correlated
    const verifDiag: VerificationDiagnostic = {
      verificationId: "verif-1",
      runId,
      taskId,
      toolId: "create_note",
      strategy: "vault_containment",
      state: "completed",
      timing: { startedAt: "2026-09-21T00:00:00.250Z", durationMs: 12 },
      outcome: "success",
      evidenceSummary: { label: "Vault check", detail: "File verified in vault" },
    };
    service.recordVerification(runId, verifDiag);

    const snapshot = service.getSnapshot();
    const active = snapshot.activeRun;
    expect(active).toBeDefined();
    expect(active?.runId).toBe(runId);
    expect(active?.taskId).toBe(taskId);
    expect(active?.tools[0].runId).toBe(runId);
    expect(active?.tools[0].taskId).toBe(taskId);
    expect(active?.confirmation?.runId).toBe(runId);
    expect(active?.confirmation?.taskId).toBe(taskId);
    expect(active?.verification?.runId).toBe(runId);
    expect(active?.verification?.taskId).toBe(taskId);

    // Events emitted during lifecycle contain the runId and taskId
    const runEvents = snapshot.events.filter((e) => e.runId === runId);
    expect(runEvents.length).toBeGreaterThanOrEqual(4);
    for (const ev of runEvents) {
      expect(ev.runId).toBe(runId);
      expect(ev.taskId).toBe(taskId);
    }
  });

  it("stale events from Run A do not contaminate or overwrite Run B", () => {
    // Run A starts and finishes
    service.startRun("run-A", "Request A", "task-A");
    service.completeRun("run-A", "success");

    // Run B starts
    service.startRun("run-B", "Request B", "task-B");

    // Late tool completion from Run A arrives
    service.recordTool("run-A", {
      id: "tool-late-A",
      runId: "run-A",
      taskId: "task-A",
      toolId: "search_vault",
      permission: "read",
      state: "completed",
      timing: { startedAt: "2026-09-21T00:00:00.000Z", durationMs: 100 },
      outcome: "success",
    });

    // Late state change from Run A arrives
    service.updateRunState("run-A", "completed", "success");

    const snapshot = service.getSnapshot();

    // Active run must strictly be Run B
    expect(snapshot.activeRun?.runId).toBe("run-B");
    expect(snapshot.activeRun?.taskId).toBe("task-B");
    expect(snapshot.activeRun?.requestSummary).toBe("Request B");
    expect(snapshot.activeRun?.tools.length).toBe(0);

    // Run A remains in history with its original state
    const histA = snapshot.recentRuns.find((r) => r.runId === "run-A");
    expect(histA).toBeDefined();
    expect(histA?.runId).toBe("run-A");
    expect(histA?.outcome).toBe("success");
  });

  it("records voice diagnostics independently while preserving run correlation where applicable", () => {
    const voiceDiag: VoiceDiagnostic = {
      operation: "transcription",
      timing: { startedAt: "2026-09-21T00:00:00.000Z", durationMs: 320 },
      outcome: "success",
      interrupted: false,
      staleAudioDiscarded: false,
    };

    service.recordVoice(voiceDiag);
    const snapshot = service.getSnapshot();
    expect(snapshot.recentVoice).toBeDefined();
    expect(snapshot.recentVoice?.length).toBe(1);
    expect(snapshot.recentVoice?.[0].operation).toBe("transcription");
    expect(snapshot.recentVoice?.[0].timing.durationMs).toBe(320);

    // Event stream logs the audio event
    const audioEvent = snapshot.events.find((e) => e.type === "audio_finished");
    expect(audioEvent).toBeDefined();
    expect(audioEvent?.durationMs).toBe(320);
  });
});
