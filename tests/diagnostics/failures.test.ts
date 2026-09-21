import { describe, expect, it } from "vitest";
import { failureCodeSchema, type FailureCode, diagnosticFailureSchema } from "@/lib/contracts/diagnostics";
import { DiagnosticService } from "@/lib/diagnostics/service";

describe("Phase 11 Failure Code Classification", () => {
  const ALL_ALLOWED_CODES: FailureCode[] = [
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
  ];

  it("validates every required application-owned failure code", () => {
    for (const code of ALL_ALLOWED_CODES) {
      expect(failureCodeSchema.safeParse(code).success).toBe(true);
    }
    expect(
      diagnosticFailureSchema.safeParse({
        code: "tool_permission_denied",
        message: "Tool permission denied",
        retryable: false,
        source: "tool",
      }).success
    ).toBe(true);
  });

  it("strictly rejects arbitrary model-generated failure codes", () => {
    const invalidCodes = [
      "user_was_mean",
      "model_hallucination_detected",
      "custom_error_123",
      "FAILED_TOTALLY",
      "",
      "null",
    ];

    for (const code of invalidCodes) {
      expect(failureCodeSchema.safeParse(code).success).toBe(false);
    }
  });

  it("records diagnostic failures with correct sources and codes in DiagnosticService", () => {
    const service = new DiagnosticService();
    service.startRun("run-fail-1", "Failing tool call");

    service.recordTool("run-fail-1", {
      id: "tool-err",
      runId: "run-fail-1",
      toolId: "create_note",
      permission: "write",
      state: "failed",
      timing: { startedAt: "2026-09-21T00:00:00.000Z", durationMs: 40 },
      outcome: "failure",
      failure: {
        code: "tool_permission_denied",
        message: "Confirmation expired before approval",
        retryable: false,
        source: "confirmation",
      },
    });

    service.completeRun("run-fail-1", "failure", {
      code: "tool_permission_denied",
      message: "Tool execution prevented",
      retryable: false,
      source: "tool",
    });

    const snapshot = service.getSnapshot();
    const entry = snapshot.recentRuns.find((r) => r.runId === "run-fail-1");
    expect(entry).toBeDefined();
    expect(entry?.outcome).toBe("failure");
    expect(entry?.failureSummary).toContain("Tool execution prevented");

    // Event stream should capture the failure code
    const failEvent = snapshot.events.find((e) => e.failureCode === "tool_permission_denied");
    expect(failEvent).toBeDefined();
  });
});
