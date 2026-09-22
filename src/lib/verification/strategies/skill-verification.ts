import { stat, readFile } from "node:fs/promises";
import type { VerificationRequest, VerificationResult } from "@/lib/contracts/verification";
import type { VerificationStrategy } from "../types";
import { getObsidianVaultPath } from "@/lib/obsidian/config";
import { resolveVaultPath, toVaultRelativePath } from "@/lib/obsidian/path";
import { discoverObsidianSkills } from "@/lib/obsidian/skills";
import { hashContent } from "@/lib/learning/service";

/**
 * Phase 12 — verification for controlled skill changes.
 *
 * Proves all of the following from application-owned evidence:
 *   1. the tool reported success with a vault-relative path, version and hash,
 *   2. the path is contained inside the configured vault,
 *   3. the file exists on disk and its content hash matches the reported hash,
 *   4. the previous version was archived (rollback is available) when one existed,
 *   5. vault/Hermes skill discovery actually sees the new version.
 *
 * The model's claims are never trusted: every check reads the canonical file.
 */
export class SkillVerificationStrategy implements VerificationStrategy {
  readonly id = "skill_verification";
  readonly name = "SkillVerificationStrategy";

  async verify(
    request: VerificationRequest,
    context?: { signal?: AbortSignal; timeoutMs?: number }
  ): Promise<VerificationResult> {
    const now = new Date().toISOString();

    const fail = (reason: string): VerificationResult => ({
      runId: request.runId,
      taskId: request.taskId,
      toolId: request.toolId,
      status: "failed",
      verifiedAt: now,
      evidence: [],
      reason,
    });

    if (request.toolResult.status !== "success" || !request.toolResult.output) {
      return fail(request.toolResult.error ?? "Tool execution failed before verification.");
    }

    const output = request.toolResult.output as Record<string, unknown>;
    const relativePath = typeof output.relativePath === "string" ? output.relativePath : "";
    const reportedVersion = typeof output.version === "string" ? output.version : "";
    const reportedHash = typeof output.contentHash === "string" ? output.contentHash : "";
    const historyPath = typeof output.historyPath === "string" ? output.historyPath : null;
    const skillName = typeof output.skillName === "string" ? output.skillName : "";

    if (!relativePath || !reportedVersion || !reportedHash) {
      return fail("Tool output missing skill path, version, or content hash.");
    }

    const vaultRoot = getObsidianVaultPath();
    if (!vaultRoot) {
      return fail("Obsidian vault path is not configured on the server.");
    }

    // 2. Path containment
    let resolvedPath: string;
    try {
      resolvedPath = await resolveVaultPath(vaultRoot, relativePath);
    } catch (pathError) {
      const msg = pathError instanceof Error ? pathError.message : "Path containment violation";
      return fail(`Vault path containment verification failed: ${msg}`);
    }

    // Must be inside AI/Skills/<name>/SKILL.md — never elsewhere in the vault.
    if (!/^AI\/Skills\/[a-z0-9][a-z0-9-]*\/SKILL\.md$/i.test(relativePath.replace(/\\/g, "/"))) {
      return fail(`Skill path is outside the canonical AI/Skills/ layout: ${relativePath}`);
    }

    if (context?.signal?.aborted) {
      return fail("Verification cancelled.");
    }


    try {
      // 3. File exists and content matches the confirmed hash
      const fileStat = await stat(resolvedPath);
      if (!fileStat.isFile()) {
        return fail(`Target path exists but is not a regular file: ${relativePath}`);
      }

      const onDisk = await readFile(resolvedPath, "utf-8");
      const actualHash = hashContent(onDisk);
      if (actualHash !== reportedHash) {
        return fail("On-disk skill content does not match the confirmed content hash.");
      }

      const diskVersion = onDisk.match(/^version:\s*["']?(\d+\.\d+\.\d+)["']?\s*$/m)?.[1] ?? "";
      if (diskVersion !== reportedVersion) {
        return fail(
          `On-disk skill version (${diskVersion || "none"}) does not match the reported version (${reportedVersion}).`
        );
      }

      // 4. Previous version archived for rollback
      if (historyPath) {
        try {
          const historyFull = await resolveVaultPath(vaultRoot, historyPath);
          const historyStat = await stat(historyFull);
          if (!historyStat.isFile()) {
            return fail("Archived previous version is not a regular file (rollback unavailable).");
          }
        } catch {
          return fail("Archived previous version could not be verified (rollback unavailable).");
        }
      }

      // 5. Vault skill discovery sees the new version (Hermes can discover it)
      const discovered = await discoverObsidianSkills(vaultRoot);
      const found = discovered.find(
        (s) => s.name.toLowerCase() === skillName.toLowerCase() && s.version === reportedVersion
      );
      if (!found) {
        return fail(`Skill discovery did not report version ${reportedVersion} for "${skillName}".`);
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
            description:
              "Verified canonical SKILL.md exists in the vault with matching content hash and version.",
            details: {
              relativePath: canonicalRel,
              sizeBytes: fileStat.size,
              modifiedAt: fileStat.mtime.toISOString(),
              contentHash: actualHash,
              version: diskVersion,
            },
          },
          {
            type: "schema",
            description:
              "Verified vault skill discovery reports the new version (Hermes can discover it).",
            details: { skillName, version: reportedVersion },
          },
          ...(historyPath
            ? [
                {
                  type: "file" as const,
                  description: "Verified the previous version is archived for rollback.",
                  details: { historyPath },
                },
              ]
            : []),
        ],
        metadata: {
          path: canonicalRel,
          skillName,
          version: reportedVersion,
          historyPath: historyPath ?? "none",
        },
      };
    } catch (fsError: unknown) {
      const msg = fsError instanceof Error ? fsError.message : "File system access failed";
      return fail(`Skill file could not be verified on disk: ${msg}`);
    }
  }
}
