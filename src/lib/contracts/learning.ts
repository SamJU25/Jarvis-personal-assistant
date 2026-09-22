import { z } from "zod";

/**
 * Phase 12 — Obsidian Skills + Controlled Learning.
 *
 * A skill improvement flows through:
 *   observed workflow → proposal (no write) → human-readable diff preview
 *   → explicit human confirmation → write SKILL.md → verification
 *   → Hermes discovery of the new version
 *
 * Model output can never write a skill silently: only the confirmed
 * application path calls `applyProposal`.
 */

/** Canonical skill identifier — lowercase slug, path-safe by construction. */
export const skillNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9][a-z0-9-]*$/, "Skill name must be a lowercase slug (a-z, 0-9, -)");

export const skillVersionSchema = z
  .string()
  .regex(/^\d+\.\d+\.\d+$/, "Version must be semantic (major.minor.patch)");

export const skillDiffSchema = z.object({
  /** Lines present in the proposal but not in the current skill. */
  added: z.array(z.string()).max(500),
  /** Lines present in the current skill but removed by the proposal. */
  removed: z.array(z.string()).max(500),
  /** Rendered human-readable diff preview. */
  rendered: z.string().max(4000),
  addedCount: z.number().int().nonnegative(),
  removedCount: z.number().int().nonnegative(),
  truncated: z.boolean(),
});

export type SkillDiff = z.infer<typeof skillDiffSchema>;

export const skillProposalSchema = z.object({
  skillName: skillNameSchema,
  baseVersion: skillVersionSchema,
  proposedVersion: skillVersionSchema,
  /** Provenance: why this change is proposed (observed workflow, user request…). */
  rationale: z.string().trim().min(1).max(1000),
  proposedContent: z.string().min(1).max(100_000),
  diff: skillDiffSchema,
  createdAt: z.string(),
});

export type SkillProposal = z.infer<typeof skillProposalSchema>;

/** Result of a confirmed skill write (or rollback). */
export const skillWriteResultSchema = z.object({
  skillName: skillNameSchema,
  version: skillVersionSchema,
  previousVersion: skillVersionSchema.nullable(),
  /** Vault-relative path of the canonical SKILL.md. */
  relativePath: z.string(),
  /** Vault-relative path of the archived previous version, when one existed. */
  historyPath: z.string().nullable(),
  contentHash: z.string(),
  byteSize: z.number().int().nonnegative(),
  operation: z.enum(["update", "rollback"]),
});

export type SkillWriteResult = z.infer<typeof skillWriteResultSchema>;

/** Tool input: the model proposes; it never writes. */
export const proposeSkillImprovementInputSchema = z.object({
  skill: skillNameSchema,
  rationale: z.string().trim().min(1).max(1000),
  content: z.string().trim().min(1).max(100_000),
});

export type ProposeSkillImprovementInput = z.infer<typeof proposeSkillImprovementInputSchema>;
