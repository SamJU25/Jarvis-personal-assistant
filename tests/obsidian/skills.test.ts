import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  discoverObsidianSkills,
  loadObsidianSkill,
  toSkillDefinition,
} from "@/lib/obsidian/skills";

describe("Obsidian Canonical Skill Discovery (AI/Skills/)", () => {
  let vaultDir: string;

  beforeEach(async () => {
    vaultDir = await mkdtemp(path.join(tmpdir(), "obsidian-skills-test-"));
    const skillsDir = path.join(vaultDir, "AI", "Skills");

    // Directory-based skill: AI/Skills/daily-planner/SKILL.md
    const plannerDir = path.join(skillsDir, "daily-planner");
    await mkdir(plannerDir, { recursive: true });
    await writeFile(
      path.join(plannerDir, "SKILL.md"),
      `---
name: daily-planner
description: Organizes your daily tasks and schedule.
version: 1.2.0
author: JARVIS
category: organization
tags: [daily, planner, tasks]
---
# Daily Planner Instructions
When planning the day, check calendar events first and draft top 3 priorities.
`
    );

    // Standalone file-based skill: AI/Skills/code-review.md
    await writeFile(
      path.join(skillsDir, "code-review.md"),
      `---
name: code-review
description: Conducts automated review of code changes.
version: 2.0.0
author: JARVIS
tags: [coding, review]
---
# Code Review Instructions
Examine diffs for potential bugs and type errors.
`
    );
  });

  afterEach(async () => {
    await rm(vaultDir, { recursive: true, force: true });
  });

  it("discovers both directory-based and standalone skills", async () => {
    const skills = await discoverObsidianSkills(vaultDir);
    expect(skills.length).toBe(2);

    const names = skills.map((s) => s.name);
    expect(names).toContain("daily-planner");
    expect(names).toContain("code-review");

    const planner = skills.find((s) => s.name === "daily-planner");
    expect(planner?.description).toBe("Organizes your daily tasks and schedule.");
    expect(planner?.version).toBe("1.2.0");
    expect(planner?.tags).toEqual(["daily", "planner", "tasks"]);
    expect(planner?.content).toContain("check calendar events first");
  });

  it("loads a specific skill by name", async () => {
    const skill = await loadObsidianSkill("code-review", vaultDir);
    expect(skill).not.toBeNull();
    expect(skill?.name).toBe("code-review");
    expect(skill?.description).toBe("Conducts automated review of code changes.");

    const notFound = await loadObsidianSkill("non-existent-skill", vaultDir);
    expect(notFound).toBeNull();
  });

  it("adapts an ObsidianSkill into a standard SkillDefinition", () => {
    const adapted = toSkillDefinition({
      name: "daily-planner",
      description: "Organizes your daily tasks.",
      version: "1.0.0",
      author: "Test",
      tags: ["daily"],
      content: "Step 1: Check tasks.",
      relativePath: "AI/Skills/daily-planner/SKILL.md",
    });

    expect(adapted.name).toBe("daily-planner");
    expect(adapted.description).toBe("Organizes your daily tasks.");
    expect(adapted.whenToUse).toEqual(["daily"]);
    expect(adapted.id).toBe("daily-planner");
  });
});
