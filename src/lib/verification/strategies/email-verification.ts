import type { VerificationRequest, VerificationResult } from "@/lib/contracts/verification";
import type { VerificationStrategy } from "../types";

export class DraftEmailVerificationStrategy implements VerificationStrategy {
  async verify(
    request: VerificationRequest,
    context?: { signal?: AbortSignal; timeoutMs?: number }
  ): Promise<VerificationResult> {
    const now = new Date().toISOString();

    if (context?.signal?.aborted) {
      return {
        runId: request.runId,
        taskId: request.taskId,
        toolId: request.toolId,
        status: "failed",
        verifiedAt: now,
        evidence: [],
        reason: "Verification cancelled.",
      };
    }

    // 1. Tool execution must have succeeded
    if (request.toolResult.status !== "success" || !request.toolResult.output) {
      return {
        runId: request.runId,
        taskId: request.taskId,
        toolId: request.toolId,
        status: "failed",
        verifiedAt: now,
        evidence: [],
        reason: request.toolResult.error ?? "Gmail draft creation failed.",
      };
    }

    const output = request.toolResult.output as Record<string, unknown>;
    const draftId = typeof output.draftId === "string" ? output.draftId.trim() : "";
    const to = typeof output.to === "string" ? output.to.trim() : "";
    const subject = typeof output.subject === "string" ? output.subject.trim() : "";

    // 2. Confirm operation result represents a draft and NOT a sent email
    if ("sentAt" in output || ("messageId" in output && !("draftId" in output))) {
      return {
        runId: request.runId,
        taskId: request.taskId,
        toolId: request.toolId,
        status: "failed",
        verifiedAt: now,
        evidence: [],
        reason: "Verification violation: result does not conform to draft-only constraints.",
      };
    }

    // 3. Draft ID must exist and be non-empty
    if (!draftId) {
      return {
        runId: request.runId,
        taskId: request.taskId,
        toolId: request.toolId,
        status: "failed",
        verifiedAt: now,
        evidence: [],
        reason: "Verification failed: missing or empty Gmail draft ID.",
      };
    }

    // 4. Validate recipient/subject from the normalized result
    const expectedTo = typeof request.parameters.to === "string" ? request.parameters.to.trim() : "";
    const expectedSubject = typeof request.parameters.subject === "string" ? request.parameters.subject.trim() : "";

    if (expectedTo && to && to !== expectedTo && !to.includes(expectedTo)) {
      return {
        runId: request.runId,
        taskId: request.taskId,
        toolId: request.toolId,
        status: "failed",
        verifiedAt: now,
        evidence: [],
        reason: `Verification failed: recipient "${to}" does not match requested "${expectedTo}".`,
      };
    }

    if (expectedSubject && subject && subject !== expectedSubject && !subject.includes(expectedSubject)) {
      return {
        runId: request.runId,
        taskId: request.taskId,
        toolId: request.toolId,
        status: "failed",
        verifiedAt: now,
        evidence: [],
        reason: `Verification failed: subject "${subject}" does not match requested "${expectedSubject}".`,
      };
    }

    return {
      runId: request.runId,
      taskId: request.taskId,
      toolId: request.toolId,
      status: "passed",
      verifiedAt: now,
      evidence: [
        {
          type: "email",
          description: "Gmail draft created and verified (strictly draft-only, no outbound sending).",
          details: {
            draftId,
            to: to || expectedTo,
            subject: subject || expectedSubject,
            isDraftOnly: true,
          },
        },
      ],
      metadata: {
        draftId,
        to: to || expectedTo,
        subject: subject || expectedSubject,
      },
    };
  }
}
