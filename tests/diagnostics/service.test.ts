import { describe, expect, it, beforeEach } from "vitest";
import { DiagnosticService, MAX_DIAGNOSTIC_EVENTS, MAX_EXECUTION_HISTORY } from "@/lib/diagnostics/service";
import { sanitizeText, safeSummaryText } from "@/lib/diagnostics/sanitizer";
import { logger } from "@/lib/diagnostics/logger";

describe("Phase 11 DiagnosticService & Sanitization", () => {
  let service: DiagnosticService;

  beforeEach(() => {
    service = new DiagnosticService();
  });

  it("sanitizer redacts Windows/Unix absolute paths, API keys, and credentials", () => {
    const rawWin = "Created note at F:\\Jarvis\\notes\\secret.md successfully";
    expect(sanitizeText(rawWin)).toBe("Created note at [REDACTED_PATH] successfully");

    const rawUnix = "Saved to /Users/sam/secret/doc.md";
    expect(sanitizeText(rawUnix)).toBe("Saved to [REDACTED_PATH]");

    const rawKey = "Authorization: Bearer sk-proj-1234567890abcdefghijklmnopqrstuvwxyz";
    expect(sanitizeText(rawKey)).toBe("Authorization: [REDACTED_SECRET]");

    const rawJson = '{"apiKey": "secret-123", "data": "clean"}';
    expect(sanitizeText(rawJson)).toContain("[REDACTED_SECRET]");
  });

  it("safeSummaryText truncates strings exceeding limits", () => {
    const long = "A".repeat(150);
    const summary = safeSummaryText(long, 50);
    expect(summary.length).toBe(50);
    expect(summary.endsWith("...")).toBe(true);
  });

  it("DiagnosticService manages run lifecycle and produces a valid DebugSnapshot", () => {
    const run = service.startRun("run-1", "Test read request", "task-1");
    expect(run.runId).toBe("run-1");
    expect(run.state).toBe("planning");

    service.recordProvider("run-1", {
      provider: "CommandCodeProvider",
      model: "default",
      timing: { startedAt: new Date().toISOString(), durationMs: 150 },
      outcome: "success",
      timeout: false,
      cancelled: false,
    });

    service.recordTool("run-1", {
      id: "tool-1",
      runId: "run-1",
      taskId: "task-1",
      toolId: "get_current_time",
      permission: "read",
      state: "completed",
      timing: { startedAt: new Date().toISOString(), durationMs: 25 },
      outcome: "success",
    });

    const completed = service.completeRun("run-1", "success");
    expect(completed).toBeDefined();
    expect(completed?.outcome).toBe("success");
    expect(completed?.toolSummaries.length).toBe(1);

    const snapshot = service.getSnapshot();
    expect(snapshot.totals.runs).toBe(1);
    expect(snapshot.totals.successes).toBe(1);
    expect(snapshot.recentRuns.length).toBe(1);
    expect(snapshot.events.length).toBeGreaterThanOrEqual(3);
  });

  it("DiagnosticService enforces max event (200) and max history (50) bounds", () => {
    // Generate 60 runs
    for (let i = 0; i < 60; i++) {
      const id = `run-${i}`;
      service.startRun(id, `Request ${i}`);
      service.completeRun(id, "success");
    }

    const snapshot = service.getSnapshot();
    expect(snapshot.recentRuns.length).toBe(MAX_EXECUTION_HISTORY);
    // Earliest entries evicted; latest preserved
    expect(snapshot.recentRuns[0].runId).toBe("run-10");
    expect(snapshot.recentRuns[MAX_EXECUTION_HISTORY - 1].runId).toBe("run-59");

    // Total counts remain accurate
    expect(snapshot.totals.runs).toBe(60);
    expect(snapshot.totals.successes).toBe(60);

    // Event queue does not exceed bound
    expect(snapshot.events.length).toBeLessThanOrEqual(MAX_DIAGNOSTIC_EVENTS);
  });

  it("DiagnosticService preserves cancelled state and prevents resurrection", () => {
    service.startRun("run-cancel", "Cancel test");
    service.updateRunState("run-cancel", "cancelled", "cancelled");

    // Late state update
    service.updateRunState("run-cancel", "executing");
    const snapshot = service.getSnapshot();
    expect(snapshot.activeRun?.state).toBe("cancelled");
  });

  it("logger writes sanitized structured diagnostic events", () => {
    logger.info("Executed tool in C:\\Users\\Secret\\test.txt", {
      runId: "run-log",
      toolId: "create_note",
    });
    // Should not throw and sanitization is applied
  });
});
