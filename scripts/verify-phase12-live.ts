import fs from "node:fs";

// Load .env.local (server-side only)
if (fs.existsSync(".env.local")) {
  const content = fs.readFileSync(".env.local", "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const idx = trimmed.indexOf("=");
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

import { getObsidianVaultPath } from "../src/lib/obsidian/config";
import { discoverObsidianSkills } from "../src/lib/obsidian/skills";
import {
  buildProposal,
  applyProposal,
  listSkillHistory,
  rollbackSkill,
} from "../src/lib/learning/service";
import { getVerificationRegistry } from "../src/lib/verification/registry";

/**
 * Phase 12 live verification on the configured vault:
 *   observed workflow → proposal → diff preview → (simulated human confirm)
 *   → apply → strategy verification → discovery check → rollback restore.
 * The skill ends exactly as it started.
 */
async function main() {
  const vault = getObsidianVaultPath();
  console.log("=== Phase 12 Live Verification (real vault) ===\nVault:", vault, "\n");
  if (!vault) throw new Error("OBSIDIAN_VAULT_PATH not configured");

  // 1. Snapshot the canonical skill
  const before = await discoverObsidianSkills(vault);
  const research = before.find((s) => s.name === "research");
  if (!research) throw new Error("Vault skill 'research' not found — run migrate-memory-skills.ts first");
  console.log(`1. Canonical 'research' skill at version ${research.version}`);

  // 2. Candidate improvement (simulating an observed successful workflow).
  // Replace only the Process section anchor in the RAW canonical file; leave
  // frontmatter delimiters and version fields untouched.
  const canonicalRaw = fs.readFileSync(vault + "/AI/Skills/research/SKILL.md", "utf-8");
  const anchor = "# Process\n1. ";
  if (!canonicalRaw.includes(anchor)) throw new Error("Could not construct improvement variant");
  const improved = canonicalRaw.replace(
    anchor,
    "# Process\n0. Consult the Derived Retrieval Index first (freshness detection keeps it current), then proceed.\n1. "
  );

  const proposal = await buildProposal({
    skill: "research",
    rationale: "Observed a research run succeed after explicitly consulting the retrieval index; recording that step.",
    content: improved,
  });
  console.log(`2. Proposal ${proposal.baseVersion} → ${proposal.proposedVersion} (added ${proposal.diff.addedCount}, removed ${proposal.diff.removedCount})`);
  console.log("   Diff preview:\n" + proposal.diff.rendered.split("\n").slice(0, 8).join("\n"));

  // 3. Human confirmation gate: building the proposal must NOT write.
  const diskBefore = fs.readFileSync(vault + "/AI/Skills/research/SKILL.md", "utf-8");
  if (diskBefore.includes("Consult the Derived Retrieval Index")) {
    throw new Error("Proposal step wrote to disk — confirmation gate violated.");
  }
  console.log("3. Proposal created with zero disk writes (gate holds)");

  // 4. Human approves (simulated here by explicit operator action) → apply.
  const applied = await applyProposal({ skill: "research", content: proposal.proposedContent });
  console.log(`4. Applied: v${applied.previousVersion} → v${applied.version}, history: ${applied.historyPath}`);

  // 5. Application-owned verification (the strategy, not model claims).
  const verification = await getVerificationRegistry()
    .get("skill_verification")
    .verify({
      runId: "phase12-live",
      taskId: "phase12-live",
      toolId: "propose_skill_improvement",
      parameters: { skill: "research" },
      toolResult: {
        callId: "phase12-live-c1",
        toolId: "propose_skill_improvement",
        status: "success",
        output: applied,
      },
      timestamp: new Date().toISOString(),
    });
  if (verification.status !== "passed") {
    throw new Error(`Strategy verification failed: ${verification.reason}`);
  }
  console.log("5. Strategy verification PASSED —", verification.evidence.map((e) => e.type).join("+"));

  // 6. Hermes can discover the new version.
  const after = await discoverObsidianSkills(vault);
  const updated = after.find((s) => s.name === "research");
  if (!updated || updated.version !== applied.version) {
    throw new Error("Discoverability check failed.");
  }
  console.log(`6. Discovery reports 'research' v${updated.version}`);

  // 7. Roll back so the vault ends exactly as it started.
  const history = await listSkillHistory("research");
  const restorable = history.find((h) => h.version === proposal.baseVersion);
  if (!restorable) throw new Error("Base version not archived.");
  const rolledBack = await rollbackSkill("research", proposal.baseVersion);
  console.log(`7. Rolled back to v${proposal.baseVersion} (new canonical v${rolledBack.version})`);

  const diskAfter = fs.readFileSync(vault + "/AI/Skills/research/SKILL.md", "utf-8");
  const current = await discoverObsidianSkills(vault);
  if (current.find((s) => s.name === "research")?.content !== research.content) {
    throw new Error("Rollback did not restore the original content.");
  }
  console.log(`   history retained: ${(await listSkillHistory("research")).length} version(s) in history/`);

  console.log("\n=== PHASE 12 LIVE VERIFICATION PASSED ===");
}

main().catch((err) => {
  console.error("Live verification FAILED:", err);
  process.exit(1);
});
