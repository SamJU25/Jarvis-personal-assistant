import { stat, readFile } from "node:fs/promises";
import crypto from "node:crypto";
import type { VerificationRequest, VerificationResult } from "@/lib/contracts/verification";
import type { VerificationStrategy } from "../types";
import { resolveAllowedPath } from "@/lib/documents/path";

export class DocumentVerificationStrategy implements VerificationStrategy {
  readonly id = "document_verification";
  readonly name = "DocumentVerificationStrategy";

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
        reason: "Verification was cancelled.",
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
        reason: request.toolResult.error ?? "Tool execution failed before verification.",
      };
    }

    const output = request.toolResult.output as Record<string, unknown>;
    const relativePath = typeof output.path === "string" ? output.path : "";
    const rootId = typeof output.rootId === "string" ? output.rootId : undefined;
    const expectedSha256 = typeof output.sha256 === "string" ? output.sha256 : "";

    if (!relativePath) {
      return {
        runId: request.runId,
        taskId: request.taskId,
        toolId: request.toolId,
        status: "failed",
        verifiedAt: now,
        evidence: [],
        reason: "Tool output missing document path.",
      };
    }

    // 2. Verify path containment: must resolve inside allowed root without escaping
    let resolved;
    try {
      resolved = await resolveAllowedPath(relativePath, rootId);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Path resolution failed";
      return {
        runId: request.runId,
        taskId: request.taskId,
        toolId: request.toolId,
        status: "failed",
        verifiedAt: now,
        evidence: [],
        reason: `Containment violation: ${message}`,
      };
    }

    // 3. Verify on-disk file existence and stat properties
    let fileStat;
    try {
      fileStat = await stat(resolved.absolutePath);
    } catch {
      return {
        runId: request.runId,
        taskId: request.taskId,
        toolId: request.toolId,
        status: "failed",
        verifiedAt: now,
        evidence: [],
        reason: `File not found on disk at resolved location: "${resolved.relativePath}".`,
      };
    }

    if (!fileStat.isFile()) {
      return {
        runId: request.runId,
        taskId: request.taskId,
        toolId: request.toolId,
        status: "failed",
        verifiedAt: now,
        evidence: [],
        reason: `Target "${resolved.relativePath}" is not a regular file.`,
      };
    }

    // 4. Content and checksum verification
    try {
      const diskContent = await readFile(resolved.absolutePath);
      const diskSha256 = crypto.createHash("sha256").update(diskContent).digest("hex");

      if (expectedSha256 && diskSha256 !== expectedSha256) {
        return {
          runId: request.runId,
          taskId: request.taskId,
          toolId: request.toolId,
          status: "failed",
          verifiedAt: now,
          evidence: [],
          reason: `On-disk content hash mismatch for "${resolved.relativePath}".`,
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
            description: `Verified document exists on disk within allowed root "${resolved.rootId}" with matching checksum.`,
            details: {
              path: resolved.relativePath,
              rootId: resolved.rootId,
              sizeBytes: fileStat.size,
              sha256: diskSha256,
              modifiedAt: fileStat.mtime.toISOString(),
            },
          },
        ],
        metadata: {
          path: resolved.relativePath,
          rootId: resolved.rootId,
          sizeBytes: fileStat.size,
        },
      };
    } catch (readErr: unknown) {
      const readMessage = readErr instanceof Error ? readErr.message : "Disk read error";
      return {
        runId: request.runId,
        taskId: request.taskId,
        toolId: request.toolId,
        status: "failed",
        verifiedAt: now,
        evidence: [],
        reason: `Failed to read created document for hash verification: ${readMessage}`,
      };
    }
  }
}
