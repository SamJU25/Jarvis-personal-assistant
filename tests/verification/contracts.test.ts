import { describe, expect, it } from "vitest";
import {
  verificationRequestSchema,
  verificationResultSchema,
  type VerificationRequest,
} from "@/lib/contracts/verification";
import { VerificationService } from "@/lib/verification/service";
import { VerificationRegistry } from "@/lib/verification/registry";

describe("Phase 10 Verification Contracts", () => {
  it("validates valid verification request", () => {
    const valid: VerificationRequest = {
      runId: "run-123",
      taskId: "task-456",
      toolId: "create_note",
      parameters: { title: "Test Note", content: "Hello" },
      toolResult: {
        callId: "call-1",
        toolId: "create_note",
        status: "success",
        output: { path: "Inbox/JARVIS/Test Note.md", title: "Test Note" },
      },
      timestamp: new Date().toISOString(),
    };

    const parsed = verificationRequestSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
  });

  it("rejects invalid verification request missing runId or toolResult", () => {
    const invalid = {
      toolId: "create_note",
      timestamp: new Date().toISOString(),
    };

    const parsed = verificationRequestSchema.safeParse(invalid);
    expect(parsed.success).toBe(false);
  });

  it("validates valid verification result", () => {
    const result = {
      runId: "run-123",
      taskId: "task-456",
      toolId: "create_note",
      status: "passed",
      verifiedAt: new Date().toISOString(),
      evidence: [
        {
          type: "file",
          description: "Note exists in vault",
          details: { sizeBytes: 120 },
        },
      ],
      metadata: { path: "Inbox/JARVIS/Test Note.md" },
    };

    const parsed = verificationResultSchema.safeParse(result);
    expect(parsed.success).toBe(true);
  });

  it("rejects invalid verification result with unrecognized status", () => {
    const invalid = {
      runId: "run-123",
      toolId: "create_note",
      status: "unverified_ok", // not in enum
      verifiedAt: new Date().toISOString(),
      evidence: [],
    };

    const parsed = verificationResultSchema.safeParse(invalid);
    expect(parsed.success).toBe(false);
  });

  it("handles verification timeout deterministically without unhandled promise rejections", async () => {
    const registry = new VerificationRegistry();
    // Register a strategy that hangs indefinitely
    registry.register("hanging_tool", {
      verify: async () => new Promise(() => {}), // never resolves
    });

    const service = new VerificationService({
      registry,
      defaultTimeoutMs: 50, // 50ms timeout for test
    });

    const result = await service.verify({
      runId: "run-timeout",
      toolId: "hanging_tool",
      parameters: {},
      toolResult: {
        callId: "call-timeout",
        toolId: "hanging_tool",
        status: "success",
        output: {},
      },
      timestamp: new Date().toISOString(),
    });

    expect(result.status).toBe("failed");
    expect(result.error).toBe("timeout");
    expect(result.reason).toContain("timed out");
  });

  it("handles aborted signal immediately without waiting for timeout", async () => {
    const registry = new VerificationRegistry();
    registry.register("hanging_tool", {
      verify: async () => new Promise(() => {}),
    });

    const service = new VerificationService({
      registry,
      defaultTimeoutMs: 5000,
    });

    const controller = new AbortController();
    controller.abort(); // already aborted

    const result = await service.verify(
      {
        runId: "run-aborted",
        toolId: "hanging_tool",
        parameters: {},
        toolResult: {
          callId: "call-aborted",
          toolId: "hanging_tool",
          status: "success",
          output: {},
        },
        timestamp: new Date().toISOString(),
      },
      { signal: controller.signal }
    );

    expect(result.status).toBe("failed");
    expect(result.error).toBe("cancelled");
  });
});
