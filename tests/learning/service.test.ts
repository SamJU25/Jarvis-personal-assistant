import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, mkdir, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  applyProposal,
  buildProposal,
  hashContent,
  listSkillHistory,
  readCanonicalSkill,
  rollbackSkill,
  SkillLearningError,
} from "@/lib/learning/service";

const SKILL_V1 = `---
name: "demo-skill"
description: "A demo skill"
version: "1.0.0"
author: "JARVIS"
category: "productivity"
tags: ["demo"]
---

# Purpose
Do the demo thing.

# Process
1. Step one.
`;

const SKILL_V2 = `---
name: "demo-skill"
description: "A demo skill"
version: "1.0.0"
author: "JARVIS"
category: "productivity"
tags: ["demo"]
---

# Purpose
Do the demo thing, improved.

# Process
1. Step one.
2. Step two added after observing the workflow.
`;

describe("Phase 12: controlled skill learning service", () => {
  let vaultDir: string;
  let skillPath: string;

  beforeEach(async () => {
    vaultDir = await mkdtemp(path.join(tmpdir(), "jarvis-learning-test-"));
    const dir = path.join(vaultDir, "AI", "Skills", "demo-skill");
    await mkdir(dir, { recursive: true });
    skillPath = path.join(dir, "SKILL.md");
    await writeFile(skillPath, SKILL_V1, "utf-8");
  });

  afterEach(async () => {
    await rm(vaultDir, { recursive: true, force: true });
  });

  it("builds a proposal with version bump and diff preview without writing", async () => {
    const before = await readFile(skillPath, "utf-8");

    const proposal = await buildProposal(
      { skill: "demo-skill", rationale: "Observed a two-step workflow succeed twice.", content: SKILL_V2 },
      vaultDir
    );

    expect(proposal.skillName).toBe("demo-skill");
    expect(proposal.baseVersion).toBe("1.0.0");
    expect(proposal.proposedVersion).toBe("1.0.1");
    expect(proposal.diff.addedCount).toBeGreaterThan(0);
    expect(proposal.rationale).toContain("Observed");

    // Proposal must NOT modify the canonical file.
    expect(await readFile(skillPath, "utf-8")).toBe(before);
  });

  it("rejects proposals for skills that do not exist", async () => {
    await expect(
      buildProposal({ skill: "missing-skill", rationale: "why", content: SKILL_V2 }, vaultDir)
    ).rejects.toBeInstanceOf(SkillLearningError);
  });

  it("rejects path traversal attempts in the skill name", async () => {
    await expect(
      buildProposal({ skill: "../../etc", rationale: "why", content: SKILL_V2 }, vaultDir)
    ).rejects.toMatchObject({ code: "invalid_skill_name" });
    await expect(
      applyProposal({ skill: "../evil", content: SKILL_V2 }, vaultDir)
    ).rejects.toMatchObject({ code: "invalid_skill_name" });
  });

  it("rejects proposed content without frontmatter", async () => {
    await expect(
      buildProposal({ skill: "demo-skill", rationale: "why", content: "no frontmatter here" }, vaultDir)
    ).rejects.toMatchObject({ code: "invalid_content" });
  });

  it("applies a confirmed change, archives the previous version, and verifies the write", async () => {
    const result = await applyProposal({ skill: "demo-skill", content: SKILL_V2 }, vaultDir);

    expect(result.skillName).toBe("demo-skill");
    expect(result.previousVersion).toBe("1.0.0");
    expect(result.version).toBe("1.0.1");
    expect(result.relativePath).toMatch(/AI[\\/]Skills[\\/]demo-skill[\\/]SKILL\.md$/);
    expect(result.historyPath).toMatch(/AI[\\/]Skills[\\/]demo-skill[\\/]history[\\/]1\.0\.0\.md$/);
    expect(result.operation).toBe("update");

    // On-disk content matches the reported hash (verification basis).
    const onDisk = await readFile(skillPath, "utf-8");
    expect(hashContent(onDisk)).toBe(result.contentHash);
    expect(onDisk).toContain('version: "1.0.1"');
    expect(onDisk).toContain("Step two added");

    // Previous version archived intact.
    const archived = await readFile(path.join(vaultDir, result.historyPath as string), "utf-8");
    expect(archived).toBe(SKILL_V1);
  });

  it("lists history and rolls back to an archived version", async () => {
    const applied = await applyProposal({ skill: "demo-skill", content: SKILL_V2 }, vaultDir);

    const history = await listSkillHistory("demo-skill", vaultDir);
    expect(history.some((h) => h.version === "1.0.0")).toBe(true);

    const rolledBack = await rollbackSkill("demo-skill", "1.0.0", vaultDir);
    expect(rolledBack.operation).toBe("rollback");
    expect(rolledBack.version).toBe("1.0.2");

    const current = await readCanonicalSkill("demo-skill", vaultDir);
    expect(current?.content).toContain("Do the demo thing.");
    expect(current?.content).not.toContain("Step two added");

    // The pre-rollback version was archived too.
    expect(applied.version).toBe("1.0.1");
    const history2 = await listSkillHistory("demo-skill", vaultDir);
    expect(history2.some((h) => h.version === "1.0.1")).toBe(true);
  });

  it("fails rollback when no archived version exists", async () => {
    await expect(rollbackSkill("demo-skill", "9.9.9", vaultDir)).rejects.toMatchObject({
      code: "skill_not_found",
    });
  });
});
