import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { POST } from "@/app/api/agent/confirm/route";
import { getConfirmationService } from "@/lib/confirmation/service";
import { getVerificationRegistry } from "@/lib/verification/registry";
import { getVerificationService } from "@/lib/verification/service";
import { NextRequest } from "next/server";

const VAULT_FIXTURE = join(process.cwd(), "tests", "fixtures", "confirm-route-vault");

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/agent/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/agent/confirm with Phase 10 Verification", () => {
  const confirmationService = getConfirmationService();

  beforeEach(async () => {
    process.env.OBSIDIAN_VAULT_PATH = VAULT_FIXTURE;
    await mkdir(VAULT_FIXTURE, { recursive: true });
    confirmationService.clear();
  });

  afterEach(async () => {
    delete process.env.OBSIDIAN_VAULT_PATH;
    await rm(VAULT_FIXTURE, { recursive: true, force: true });
    confirmationService.clear();
    getVerificationRegistry().clear();
  });

  it("rejects invalid request body with HTTP 400", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("handles cancel action properly", async () => {
    const pending = confirmationService.createPendingConfirmation({
      originatingRunId: "run-cancel",
      toolId: "create_note",
      actionCategory: "note",
      title: "CREATE NOTE",
      target: "Inbox/JARVIS/Cancel.md",
      summary: "Cancel note",
      preview: "Preview",
      parameters: { title: "Cancel", content: "Content" },
    });

    const res = await POST(
      makeRequest({
        confirmationId: pending.id,
        action: "cancel",
      })
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("cancelled");
    expect(data.result.speech).toBe("Action was cancelled.");
  });

  it("rejects replaying an already consumed confirmation with HTTP 409", async () => {
    const pending = confirmationService.createPendingConfirmation({
      originatingRunId: "run-replay",
      toolId: "create_note",
      actionCategory: "note",
      title: "CREATE NOTE",
      target: "Inbox/JARVIS/Replay.md",
      summary: "Replay test",
      preview: "Preview",
      parameters: { title: "Replay", content: "Content" },
    });

    // First confirmation execution
    const res1 = await POST(
      makeRequest({
        confirmationId: pending.id,
        action: "confirm",
      })
    );
    expect(res1.status).toBe(200);

    // Replay attempt
    const res2 = await POST(
      makeRequest({
        confirmationId: pending.id,
        action: "confirm",
      })
    );
    expect(res2.status).toBe(409);
    const data2 = await res2.json();
    expect(data2.message).toContain("already been used");
  });

  it("executes write tool, verifies outcome on disk, and returns complete status with verified speech", async () => {
    const pending = confirmationService.createPendingConfirmation({
      originatingRunId: "run-note-ok",
      toolId: "create_note",
      actionCategory: "note",
      title: "CREATE NOTE",
      target: "Inbox/JARVIS/My New Note.md",
      summary: "Create note",
      preview: "Note content",
      parameters: {
        title: "My New Note",
        content: "Important ideas recorded here.",
      },
    });

    const res = await POST(
      makeRequest({
        confirmationId: pending.id,
        action: "confirm",
      })
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("success");
    expect(data.result.state).toBe("complete");
    expect(data.result.speech).toContain("verified");
    expect(data.result.cards.length).toBe(1);
    expect(data.result.cards[0].type).toBe("note");
  });

  it("handles verification failure truthfully by returning state failed and non-success speech", async () => {
    const pending = confirmationService.createPendingConfirmation({
      originatingRunId: "run-note-fail",
      toolId: "create_note",
      actionCategory: "note",
      title: "CREATE NOTE",
      target: "Inbox/JARVIS/Failing Note.md",
      summary: "Failing note",
      preview: "Preview",
      parameters: {
        title: "Failing Note",
        content: "Content",
      },
    });

    // Mock verification strategy to fail verification
    getVerificationRegistry().register("create_note", {
      verify: async (req) => ({
        runId: req.runId,
        toolId: req.toolId,
        status: "failed",
        verifiedAt: new Date().toISOString(),
        evidence: [],
        reason: "File integrity check failed",
      }),
    });

    const res = await POST(
      makeRequest({
        confirmationId: pending.id,
        action: "confirm",
      })
    );

    expect(res.status).toBe(502);
    const data = await res.json();
    expect(data.status).toBe("failed");
    expect(data.result.state).toBe("failed");
    expect(data.result.speech).toContain("couldn't verify that the note was created");
    expect(data.result.speech).toContain("File integrity check failed");
  });

  it("updates task state to completed upon successful confirmation and verification", async () => {
    const vService = getVerificationService();
    const runId = "run-task-track-ok";
    const task = vService.taskTracker.createTask(runId);
    vService.taskTracker.updateState(task.id, "waiting_for_approval", { toolId: "create_note" });

    const pending = confirmationService.createPendingConfirmation({
      originatingRunId: runId,
      toolId: "create_note",
      actionCategory: "note",
      title: "CREATE NOTE",
      target: "Inbox/JARVIS/Tracked Note.md",
      summary: "Tracked note",
      preview: "Preview content",
      parameters: {
        title: "Tracked Note",
        content: "Tracked note content.",
      },
    });

    const res = await POST(
      makeRequest({
        confirmationId: pending.id,
        action: "confirm",
      })
    );

    expect(res.status).toBe(200);
    const updatedTask = vService.taskTracker.getTask(task.id);
    expect(updatedTask?.state).toBe("completed");
    expect(updatedTask?.verificationStatus).toBe("passed");
  });

  it("updates task state to cancelled upon cancellation", async () => {
    const vService = getVerificationService();
    const runId = "run-task-track-cancel";
    const task = vService.taskTracker.createTask(runId);
    vService.taskTracker.updateState(task.id, "waiting_for_approval", { toolId: "create_note" });

    const pending = confirmationService.createPendingConfirmation({
      originatingRunId: runId,
      toolId: "create_note",
      actionCategory: "note",
      title: "CREATE NOTE",
      target: "Inbox/JARVIS/Cancel Tracked.md",
      summary: "Cancel tracked",
      preview: "Preview",
      parameters: { title: "Cancel Tracked", content: "Content" },
    });

    const res = await POST(
      makeRequest({
        confirmationId: pending.id,
        action: "cancel",
      })
    );

    expect(res.status).toBe(200);
    const updatedTask = vService.taskTracker.getTask(task.id);
    expect(updatedTask?.state).toBe("cancelled");
  });

  it("replays cached verified result on safe retry with idempotencyKey without duplicating write", async () => {
    const pending = confirmationService.createPendingConfirmation({
      originatingRunId: "run-idempotent-confirm",
      toolId: "create_note",
      actionCategory: "note",
      title: "CREATE NOTE",
      target: "Inbox/JARVIS/Idempotent.md",
      summary: "Idempotent write",
      preview: "Preview",
      parameters: { title: "Idempotent Note", content: "Deterministic body" },
    });

    const idempotencyKey = "op_idemp_key_12345";

    // First attempt with idempotencyKey: executes and verifies
    const res1 = await POST(
      makeRequest({
        confirmationId: pending.id,
        action: "confirm",
        idempotencyKey,
      })
    );
    expect(res1.status).toBe(200);
    const data1 = await res1.json();
    expect(data1.status).toBe("success");
    expect(res1.headers.get("X-Idempotent-Replay")).toBeNull();

    // Safe retry with same idempotencyKey: returns cached verified result without error
    const res2 = await POST(
      makeRequest({
        confirmationId: pending.id,
        action: "confirm",
        idempotencyKey,
      })
    );
    expect(res2.status).toBe(200);
    expect(res2.headers.get("X-Idempotent-Replay")).toBe("true");
    const data2 = await res2.json();
    expect(data2.status).toBe("success");
    expect(data2.result.title).toBe(data1.result.title);
  });
});
