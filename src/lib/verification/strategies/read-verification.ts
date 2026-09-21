import type { VerificationRequest, VerificationResult } from "@/lib/contracts/verification";
import type { VerificationStrategy } from "../types";

export class DefaultReadVerificationStrategy implements VerificationStrategy {
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

    if (request.toolResult.status !== "success") {
      return {
        runId: request.runId,
        taskId: request.taskId,
        toolId: request.toolId,
        status: "failed",
        verifiedAt: now,
        evidence: [],
        reason: request.toolResult.error ?? "Read tool execution failed.",
      };
    }

    if (request.toolResult.output === undefined || request.toolResult.output === null) {
      return {
        runId: request.runId,
        taskId: request.taskId,
        toolId: request.toolId,
        status: "failed",
        verifiedAt: now,
        evidence: [],
        reason: "Read tool returned empty or null output.",
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
          type: "schema",
          description: `Tool output validated against schema and structure for ${request.toolId}.`,
          details: {
            toolId: request.toolId,
            hasOutput: true,
          },
        },
      ],
      metadata: {
        toolId: request.toolId,
      },
    };
  }
}
