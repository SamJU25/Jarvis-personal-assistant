import { stat, readFile } from "node:fs/promises";
import type { VerificationRequest, VerificationResult } from "@/lib/contracts/verification";
import type { VerificationStrategy } from "../types";
import { getObsidianVaultPath } from "@/lib/obsidian/config";
import { resolveVaultPath, toVaultRelativePath } from "@/lib/obsidian/path";

export class CreateNoteVerificationStrategy implements VerificationStrategy {
  async verify(
    request: VerificationRequest,
    context?: { signal?: AbortSignal; timeoutMs?: number }
  ): Promise<VerificationResult> {
    const now = new Date().toISOString();

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
    const returnedTitle = typeof output.title === "string" ? output.title : "";

    if (!relativePath) {
      return {
        runId: request.runId,
        taskId: request.taskId,
        toolId: request.toolId,
        status: "failed",
        verifiedAt: now,
        evidence: [],
        reason: "Tool output missing vault-relative file path.",
      };
    }

    // 2. Verify vault root is configured
    const vaultRoot = getObsidianVaultPath();
    if (!vaultRoot) {
      return {
        runId: request.runId,
        taskId: request.taskId,
        toolId: request.toolId,
        status: "failed",
        verifiedAt: now,
        evidence: [],
        reason: "Obsidian vault path is not configured on the server.",
      };
    }

    // 3. Verify path containment: must resolve inside vault without escaping
    let resolvedPath: string;
    try {
      resolvedPath = await resolveVaultPath(vaultRoot, relativePath);
    } catch (pathError) {
      const msg = pathError instanceof Error ? pathError.message : "Path containment violation";
      return {
        runId: request.runId,
        taskId: request.taskId,
        toolId: request.toolId,
        status: "failed",
        verifiedAt: now,
        evidence: [],
        reason: `Vault path containment verification failed: ${msg}`,
      };
    }

    // 4. Verify file actually exists on disk
    try {
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

      const fileStat = await stat(resolvedPath);
      if (!fileStat.isFile()) {
        return {
          runId: request.runId,
          taskId: request.taskId,
          toolId: request.toolId,
          status: "failed",
          verifiedAt: now,
          evidence: [],
          reason: `Target path exists but is not a regular file: ${relativePath}`,
        };
      }

      // 5. Verify file content characteristics where practical
      const fileBuffer = await readFile(resolvedPath, "utf-8");
      const expectedTitle = typeof request.parameters.title === "string" ? request.parameters.title : "";
      if (expectedTitle && !fileBuffer.includes(expectedTitle) && returnedTitle !== expectedTitle) {
        return {
          runId: request.runId,
          taskId: request.taskId,
          toolId: request.toolId,
          status: "failed",
          verifiedAt: now,
          evidence: [],
          reason: "File on disk does not contain expected note title or header.",
        };
      }

      const canonicalRel = toVaultRelativePath(vaultRoot, resolvedPath);

      return {
        runId: request.runId,
        taskId: request.taskId,
        toolId: request.toolId,
        status: "passed",
        verifiedAt: now,
        evidence: [
          {
            type: "file",
            description: "Verified note file exists in Obsidian vault with valid containment and size.",
            details: {
              relativePath: canonicalRel,
              sizeBytes: fileStat.size,
              modifiedAt: fileStat.mtime.toISOString(),
            },
          },
        ],
        metadata: {
          path: canonicalRel,
          title: returnedTitle || expectedTitle,
        },
      };
    } catch (fsError: unknown) {
      const msg = fsError instanceof Error ? fsError.message : "File system access failed";
      return {
        runId: request.runId,
        taskId: request.taskId,
        toolId: request.toolId,
        status: "failed",
        verifiedAt: now,
        evidence: [],
        reason: `Note file was not found on disk in the Obsidian vault: ${msg}`,
      };
    }
  }
}
