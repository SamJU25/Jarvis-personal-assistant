import { describe, expect, it, beforeEach } from "vitest";
import {
  ConfirmationService,
  buildConfirmationDetails,
} from "@/lib/confirmation/service";
import {
  pendingConfirmationSchema,
  confirmationRequestSchema,
} from "@/lib/contracts/confirmation";

describe("Phase 9: Confirmation Contract & Service", () => {
  let service: ConfirmationService;

  beforeEach(() => {
    service = new ConfirmationService();
  });

  it("creates a valid pending confirmation adhering to Zod schema", () => {
    const details = buildConfirmationDetails("create_note", {
      title: "Architecture Decisions",
      content: "Use explicit human confirmation for write actions.",
    });

    const pending = service.createPendingConfirmation({
      originatingRunId: "run-101",
      toolId: "create_note",
      actionCategory: details.actionCategory,
      title: details.title,
      target: details.target,
      summary: details.summary,
      preview: details.preview,
      parameters: {
        title: "Architecture Decisions",
        content: "Use explicit human confirmation for write actions.",
      },
    });

    // Schema validation
    const parsed = pendingConfirmationSchema.safeParse(pending);
    expect(parsed.success).toBe(true);
    expect(pending.status).toBe("pending");
    expect(pending.actionCategory).toBe("note");
    expect(pending.title).toBe("CREATE NOTE");
    expect(pending.target).toContain("Architecture Decisions");
  });

  it("enforces expiration when TTL has passed", async () => {
    const pending = service.createPendingConfirmation({
      originatingRunId: "run-expire",
      toolId: "create_note",
      actionCategory: "note",
      title: "CREATE NOTE",
      target: "Inbox/JARVIS/Test.md",
      summary: "Test",
      preview: "Preview",
      parameters: { title: "Test" },
      ttlMs: 15, // 15ms TTL
    });

    expect(service.get(pending.id)?.status).toBe("pending");

    // Wait for TTL to expire
    await new Promise((r) => setTimeout(r, 30));

    // Retrieval marks expired
    const retrieved = service.get(pending.id);
    expect(retrieved?.status).toBe("expired");

    // Authorizing expired throws
    expect(() => service.authorize(pending.id)).toThrow(/expired/);
  });

  it("protects against replay attacks with single-use atomic consumption", () => {
    const pending = service.createPendingConfirmation({
      originatingRunId: "run-replay",
      toolId: "create_note",
      actionCategory: "note",
      title: "CREATE NOTE",
      target: "Inbox/JARVIS/Replay.md",
      summary: "Replay Test",
      preview: "Preview",
      parameters: { title: "Replay" },
    });

    // First authorization succeeds
    const authorized = service.authorize(pending.id);
    expect(authorized.status).toBe("consumed");

    // Second authorization attempt MUST throw
    expect(() => service.authorize(pending.id)).toThrow(/cannot be authorized because it is already consumed/);
  });

  it("allows cancellation and prevents subsequent authorization", () => {
    const pending = service.createPendingConfirmation({
      originatingRunId: "run-cancel",
      toolId: "create_note",
      actionCategory: "note",
      title: "CREATE NOTE",
      target: "Inbox/JARVIS/Cancel.md",
      summary: "Cancel Test",
      preview: "Preview",
      parameters: { title: "Cancel" },
    });

    const cancelled = service.cancel(pending.id);
    expect(cancelled.status).toBe("cancelled");

    // Attempting to authorize a cancelled confirmation MUST fail
    expect(() => service.authorize(pending.id)).toThrow(/already cancelled/);
  });

  it("maintains preview argument integrity: preview matches exact executed parameters", () => {
    const params = {
      title: "Critical Strategy",
      content: "Confidential plan details.",
    };
    const details = buildConfirmationDetails("create_note", params);

    const pending = service.createPendingConfirmation({
      originatingRunId: "run-integrity",
      toolId: "create_note",
      actionCategory: details.actionCategory,
      title: details.title,
      target: details.target,
      summary: details.summary,
      preview: details.preview,
      parameters: params,
    });

    // Verify stored parameters match the preview source exactly
    expect(pending.parameters).toEqual(params);
    expect(pending.preview).toBe(params.content);
  });

  it("validates confirmation request schemas", () => {
    const validConfirm = confirmationRequestSchema.safeParse({
      confirmationId: "conf-12345",
      action: "confirm",
    });
    expect(validConfirm.success).toBe(true);

    const validCancel = confirmationRequestSchema.safeParse({
      confirmationId: "conf-12345",
      action: "cancel",
    });
    expect(validCancel.success).toBe(true);

    const invalidAction = confirmationRequestSchema.safeParse({
      confirmationId: "conf-12345",
      action: "execute_anyway",
    });
    expect(invalidAction.success).toBe(false);
  });
});
