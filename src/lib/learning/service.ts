import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { getObsidianVaultPath } from "@/lib/obsidian/config";
import { resolveVaultPath, toVaultRelativePath } from "@/lib/obsidian/path";
import {
  skillNameSchema,
  type SkillProposal,
  type SkillWriteResult,
} from "@/lib/contracts/learning";
import { bumpVersion, buildSkillDiff } from "./diff";

/**
 * Phase 12 — application-owned controlled learning.
 *
 * Canonical skills live at `<vault>/AI/Skills/<name>/SKILL.md` (Obsidian is the
 * single source of truth). This service:
 *   - builds proposals with a safe diff preview (never writes),
 *   - applies a proposal only when the application calls it after human
 *     confirmation,
 *   - archives the previous version for rollback,
 *   - verifies the write by re-reading canonical content and recomputing the
 *     content hash,
 *   - never lets model output silently modify skills.
 */

const SKILLS_DIR = "AI/Skills";
const HISTORY_DIR = "history";
const MAX_PROPOSED_BYTES = 100_000;

export class SkillLearningError extends Error {
  constructor(
    public readonly code:
      | "not_configured"
      | "invalid_skill_name"
      | "skill_not_found"
      | "invalid_content"
      | "oversized"
      | "write_failed"
      | "verify_failed",
    message: string
  ) {
    super(message);
    this.name = "SkillLearningError";
  }
}

export interface CanonicalSkill {
  name: string;
  version: string;
  content: string;
  relativePath: string;
}

function requireVault(vaultRootOverride?: string): string {
  const vaultRoot = vaultRootOverride ?? getObsidianVaultPath();
  if (!vaultRoot) {
    throw new SkillLearningError(
      "not_configured",
      "Obsidian vault path is not configured (OBSIDIAN_VAULT_PATH)."
    );
  }
  return vaultRoot;
}

function requireSkillName(raw: string): string {
  const parsed = skillNameSchema.safeParse(raw);
  if (!parsed.success) {
    // Path-safe by construction: rejects traversal and separators.
    throw new SkillLearningError("invalid_skill_name", "Invalid skill name.");
  }
  return parsed.data;
}

function extractVersion(content: string): string {
  const match = content.match(/^version:\s*["']?(\d+\.\d+\.\d+)["']?\s*$/m);
  return match ? match[1] : "1.0.0";
}

function withVersion(content: string, version: string): string {
  if (/^version:\s*["']?\d+\.\d+\.\d+["']?\s*$/m.test(content)) {
    return content.replace(
      /^version:\s*["']?\d+\.\d+\.\d+["']?\s*$/m,
      `version: "${version}"`
    );
  }
  // No version field: insert one after the opening frontmatter delimiter.
  if (content.trimStart().startsWith("---")) {
    return content.replace(/^---\r?\n/, `---\nversion: "${version}"\n`);
  }
  throw new SkillLearningError(
    "invalid_content",
    "Proposed skill content must include YAML frontmatter."
  );
}

export function hashContent(content: string): string {
  return crypto.createHash("sha256").update(content, "utf8").digest("hex").slice(0, 32);
}

/**
 * Reads the canonical skill from the vault. Returns null when absent.
 */
export async function readCanonicalSkill(
  skillName: string,
  vaultRootOverride?: string
): Promise<CanonicalSkill | null> {
  const vaultRoot = requireVault(vaultRootOverride);
  const name = requireSkillName(skillName);
  const relativePath = `${SKILLS_DIR}/${name}/SKILL.md`;

  let fullPath: string;
  try {
    fullPath = await resolveVaultPath(vaultRoot, relativePath);
  } catch {
    return null;
  }

  try {
    const content = await fs.readFile(fullPath, "utf-8");
    return { name, version: extractVersion(content), content, relativePath };
  } catch {
    return null;
  }
}

/**
 * Builds a proposal with a safe diff preview. NEVER writes anything.
 */
export async function buildProposal(
  input: { skill: string; rationale: string; content: string },
  vaultRootOverride?: string
): Promise<SkillProposal> {
  const current = await readCanonicalSkill(input.skill, vaultRootOverride);
  if (!current) {
    throw new SkillLearningError(
      "skill_not_found",
      `Skill "${input.skill}" was not found in the vault.`
    );
  }

  if (Buffer.byteLength(input.content, "utf8") > MAX_PROPOSED_BYTES) {
    throw new SkillLearningError("oversized", "Proposed skill content exceeds the allowed size.");
  }

  if (!/^\s*---/.test(input.content)) {
    throw new SkillLearningError(
      "invalid_content",
      "Proposed skill content must begin with YAML frontmatter."
    );
  }

  const proposedVersion = bumpVersion(current.version);
  const proposedContent = withVersion(input.content.trim(), proposedVersion);

  return {
    skillName: current.name,
    baseVersion: current.version,
    proposedVersion,
    rationale: input.rationale.trim(),
    proposedContent,
    diff: buildSkillDiff(current.content, proposedContent),
    createdAt: new Date().toISOString(),
  };
}

/**
 * Applies a confirmed skill change: archives the previous version, writes the
 * new canonical SKILL.md, then verifies by re-reading from disk.
 * Only the application's confirmed path may call this.
 */
export async function applyProposal(
  input: { skill: string; content: string },
  vaultRootOverride?: string
): Promise<SkillWriteResult> {
  const vaultRoot = requireVault(vaultRootOverride);
  const name = requireSkillName(input.skill);

  const relativePath = `${SKILLS_DIR}/${name}/SKILL.md`;
  const fullPath = await resolveVaultPath(vaultRoot, relativePath);

  const current = await readCanonicalSkill(name, vaultRoot);
  const previousVersion = current?.version ?? null;
  const newVersion = bumpVersion(previousVersion ?? "0.0.0");
  const content = withVersion(input.content.trim(), newVersion);

  // 1. Archive the previous version for rollback (best-effort).
  let historyPath: string | null = null;
  if (current) {
    const historyRelative = `${SKILLS_DIR}/${name}/${HISTORY_DIR}/${current.version}.md`;
    try {
      const historyFull = await resolveVaultPath(vaultRoot, historyRelative);
      await fs.mkdir(path.dirname(historyFull), { recursive: true });
      await fs.writeFile(historyFull, current.content, "utf-8");
      historyPath = historyRelative;
    } catch {
      historyPath = null;
    }
  }

  // 2. Write the new canonical version.
  try {
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content, "utf-8");
  } catch (err) {
    throw new SkillLearningError(
      "write_failed",
      `Failed to write skill: ${err instanceof Error ? err.message : "unknown error"}`
    );
  }

  // 3. Verify by re-reading canonical content from disk.
  let written: string;
  try {
    written = await fs.readFile(fullPath, "utf-8");
  } catch {
    throw new SkillLearningError("verify_failed", "Skill file could not be re-read after writing.");
  }

  const expectedHash = hashContent(content);
  if (hashContent(written) !== expectedHash) {
    throw new SkillLearningError(
      "verify_failed",
      "On-disk skill content does not match the confirmed content."
    );
  }

  return {
    skillName: name,
    version: extractVersion(written),
    previousVersion,
    relativePath: toVaultRelativePath(vaultRoot, fullPath),
    historyPath,
    contentHash: expectedHash,
    byteSize: Buffer.byteLength(written, "utf8"),
    operation: "update",
  };
}

/**
 * Lists archived versions available for rollback (newest first).
 */
export async function listSkillHistory(
  skillName: string,
  vaultRootOverride?: string
): Promise<Array<{ version: string; relativePath: string; createdAt: string }>> {
  const vaultRoot = requireVault(vaultRootOverride);
  const name = requireSkillName(skillName);
  const historyRelative = `${SKILLS_DIR}/${name}/${HISTORY_DIR}`;

  let dir: string;
  try {
    dir = await resolveVaultPath(vaultRoot, historyRelative);
    await fs.access(dir);
  } catch {
    return [];
  }

  const entries = await fs.readdir(dir).catch(() => [] as string[]);
  const versions: Array<{ version: string; relativePath: string; createdAt: string }> = [];

  for (const entry of entries) {
    if (!entry.toLowerCase().endsWith(".md")) continue;
    const version = path.basename(entry, ".md");
    if (!/^\d+\.\d+\.\d+$/.test(version)) continue;
    try {
      const st = await fs.stat(path.join(dir, entry));
      versions.push({
        version,
        relativePath: `${historyRelative}/${entry}`,
        createdAt: st.mtime.toISOString(),
      });
    } catch {
      // skip unreadable entries
    }
  }

  versions.sort((a, b) => (a.version < b.version ? 1 : -1));
  return versions;
}

/**
 * Rolls the skill back to an archived version. Confirmed application path only.
 */
export async function rollbackSkill(
  skillName: string,
  version: string,
  vaultRootOverride?: string
): Promise<SkillWriteResult> {
  const vaultRoot = requireVault(vaultRootOverride);
  const name = requireSkillName(skillName);

  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new SkillLearningError("invalid_content", "Invalid version for rollback.");
  }

  const historyRelative = `${SKILLS_DIR}/${name}/${HISTORY_DIR}/${version}.md`;
  let historyFull: string;
  try {
    historyFull = await resolveVaultPath(vaultRoot, historyRelative);
  } catch {
    throw new SkillLearningError("skill_not_found", "Archived version not found.");
  }

  let archived: string;
  try {
    archived = await fs.readFile(historyFull, "utf-8");
  } catch {
    throw new SkillLearningError(
      "skill_not_found",
      `No archived version ${version} for skill "${name}".`
    );
  }

  const result = await applyProposal({ skill: name, content: archived }, vaultRoot);
  return { ...result, operation: "rollback" };
}
