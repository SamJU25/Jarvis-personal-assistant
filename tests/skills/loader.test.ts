import { describe, expect, it } from "vitest";
import path from "node:path";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { loadSkillFromFile, loadSkillsFromDirectory, SkillLoaderError } from "@/lib/skills/loader";

describe("Skill Loader", () => {
  const skillsDir = path.resolve(process.cwd(), "skills");

  it("loads all five default JARVIS skills from the skills/ directory", async () => {
    const skills = await loadSkillsFromDirectory(skillsDir);
    expect(skills.length).toBe(5);

    const ids = skills.map((s) => s.id).sort();
    expect(ids).toEqual(["capture-note", "loose-ends", "meeting-prep", "morning-briefing", "research"].sort());

    for (const skill of skills) {
      expect(skill.id).toBeTruthy();
      expect(skill.name).toBeTruthy();
      expect(skill.purpose).toBeTruthy();
      expect(skill.whenToUse.length).toBeGreaterThan(0);
      expect(skill.process.length).toBeGreaterThan(0);
      expect(skill.expectedOutput).toBeTruthy();
    }
  });

  it("loads individual skill file accurately", async () => {
    const meetingPrepPath = path.join(skillsDir, "meeting-prep", "SKILL.md");
    const skill = await loadSkillFromFile(meetingPrepPath);
    expect(skill.id).toBe("meeting-prep");
    expect(skill.name).toBe("Meeting Preparation");
    expect(skill.preferredTools).toContain("search_vault");
  });

  it("rejects skill file with missing frontmatter", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "jarvis-skill-test-"));
    try {
      const filePath = path.join(tempDir, "SKILL.md");
      await writeFile(filePath, "# Purpose\nSome text without frontmatter");
      await expect(loadSkillFromFile(filePath)).rejects.toThrow(SkillLoaderError);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("rejects skill file with malformed/missing fields", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "jarvis-skill-test-"));
    try {
      const filePath = path.join(tempDir, "SKILL.md");
      await writeFile(filePath, "---\nid: test\n---\n# Purpose\nOnly purpose");
      await expect(loadSkillFromFile(filePath)).rejects.toThrow(SkillLoaderError);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("rejects duplicate skill IDs in directory", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "jarvis-skill-test-"));
    try {
      const dir1 = path.join(tempDir, "skill-a");
      const dir2 = path.join(tempDir, "skill-b");
      await mkdir(dir1);
      await mkdir(dir2);

      const content = `---
id: duplicate-id
name: Duplicate
description: Desc
whenToUse:
  - trigger
preferredTools: []
---
# Purpose
Test
# Process
1. Do something
# Decision Rules
- Rule
# Expected Output
Output
`;
      await writeFile(path.join(dir1, "SKILL.md"), content);
      await writeFile(path.join(dir2, "SKILL.md"), content);

      await expect(loadSkillsFromDirectory(tempDir)).rejects.toThrow(/Duplicate skill ID detected/);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("throws for non-existent skills directory", async () => {
    await expect(loadSkillsFromDirectory(path.join(tmpdir(), "non-existent-dir-12345"))).rejects.toThrow(SkillLoaderError);
  });
});
