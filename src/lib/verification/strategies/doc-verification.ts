import type { VerificationRequest, VerificationResult } from "@/lib/contracts/verification";
import type { VerificationStrategy } from "../types";

export class CreateGoogleDocVerificationStrategy implements VerificationStrategy {
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
        reason: request.toolResult.error ?? "Google Workspace document creation failed.",
      };
    }

    const output = request.toolResult.output as Record<string, unknown>;
    const documentId = typeof output.documentId === "string" ? output.documentId.trim() : "";
    const title = typeof output.title === "string" ? output.title.trim() : "";
    const webLink = typeof output.webLink === "string" ? output.webLink.trim() : "";

    // 2. Document ID requirement: must be non-empty and valid string
    if (!documentId) {
      return {
        runId: request.runId,
        taskId: request.taskId,
        toolId: request.toolId,
        status: "failed",
        verifiedAt: now,
        evidence: [],
        reason: "Verification failed: missing or empty Google Document ID.",
      };
    }

    // 3. Validate safe link when available
    if (webLink && !webLink.startsWith("https://docs.google.com/document/d/")) {
      return {
        runId: request.runId,
        taskId: request.taskId,
        toolId: request.toolId,
        status: "failed",
        verifiedAt: now,
        evidence: [],
        reason: "Verification failed: document web link format is invalid or unsafe.",
      };
    }

    // 4. Validate title matches expectation when provided
    const expectedTitle = typeof request.parameters.title === "string" ? request.parameters.title.trim() : "";
    if (expectedTitle && title && title !== expectedTitle && !title.includes(expectedTitle)) {
      return {
        runId: request.runId,
        taskId: request.taskId,
        toolId: request.toolId,
        status: "failed",
        verifiedAt: now,
        evidence: [],
        reason: `Verification failed: returned title "${title}" does not match requested "${expectedTitle}".`,
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
          type: "document",
          description: "Google Document created and verified with valid document ID and link.",
          details: {
            documentId,
            title: title || expectedTitle || "Untitled Document",
            webLink: webLink || `https://docs.google.com/document/d/${documentId}/edit`,
          },
        },
      ],
      metadata: {
        documentId,
        title: title || expectedTitle,
        webLink,
      },
    };
  }
}
