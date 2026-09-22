import type { JarvisTool } from "@/lib/contracts/tool";
import type { ToolRegistry } from "@/lib/tools/registry";
import {
  proposeSkillImprovementInputSchema,
  skillWriteResultSchema,
  type ProposeSkillImprovementInput,
  type SkillWriteResult,
} from "@/lib/contracts/learning";
import { buildProposal, applyProposal, readCanonicalSkill } from "./service";

/**
 * Phase 12 — controlled learning capability.
 *
 * The model may only PROPOSE an improvement. Because this capability is
 * `write` class with an `explicit` confirmation policy, the application runtime
 * intercepts the call, renders the human-readable diff preview, and waits for
 * human approval. The actual write runs later through the confirmed
 * application path (`/api/agent/confirm`), then `skill_verification` proves it.
 *
 * Model output can never silently modify a skill.
 */
export const proposeSkillImprovementTool: JarvisTool<
  ProposeSkillImprovementInput,
  SkillWriteResult
> = {
  id: "propose_skill_improvement",
  name: "Propose Skill Improvement",
  description:
    "Proposes an improvement to an existing Obsidian skill (AI/Skills/<name>/SKILL.md) after a workflow proved useful or a procedure needs correcting. Requires the skill name, a short rationale explaining why the change is justified, and the complete proposed SKILL.md content including YAML frontmatter. This creates a reviewable proposal with a diff preview and REQUIRES explicit human confirmation before anything is written. Never claim a skill was updated.",
  inputSchema: proposeSkillImprovementInputSchema,
  outputSchema: skillWriteResultSchema,
  permission: "write",
  riskLevel: "medium",
  capabilityClass: "write",
  confirmationPolicy: "explicit",
  verificationStrategy: "skill_verification",
  reversible: true, // previous version is archived for rollback
  timeoutMs: 10000,
  idempotent: false,
  renderer: "document",
  source: "learning",
  async execute(input, context) {
    if (context.signal?.aborted) {
      throw new Error("Skill improvement was cancelled.");
    }

    // Guard: the skill must exist so proposals always diff against something real.
    const current = await readCanonicalSkill(input.skill);
    if (!current) {
      throw new Error(
        `Skill "${input.skill}" was not found in the vault at AI/Skills/${input.skill}/SKILL.md.`
      );
    }

    // Recompute the proposal at execution time to confirm the diff is still valid.
    await buildProposal({
      skill: input.skill,
      rationale: input.rationale,
      content: input.content,
    });

    return applyProposal({ skill: input.skill, content: input.content });
  },
};

export function registerLearningTools(registry: ToolRegistry): void {
  registry.register(proposeSkillImprovementTool);
}
