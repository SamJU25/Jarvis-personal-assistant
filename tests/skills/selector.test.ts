import { describe, expect, it } from "vitest";
import path from "node:path";
import { loadSkillsFromDirectory } from "@/lib/skills/loader";
import { selectSkill } from "@/lib/skills/selector";
import type { SkillDefinition } from "@/lib/contracts/skill";

describe("Skill Selector", () => {
  let skills: SkillDefinition[];

  it("loads default skills for testing", async () => {
    skills = await loadSkillsFromDirectory(path.resolve(process.cwd(), "skills"));
    expect(skills.length).toBe(5);
  });

  it("selects meeting-prep for meeting preparation requests", () => {
    expect(selectSkill("Prepare me for my next meeting.", skills)?.id).toBe("meeting-prep");
    expect(selectSkill("Get me ready for my meeting with Yusuf.", skills)?.id).toBe("meeting-prep");
    expect(selectSkill("Meeting prep", skills)?.id).toBe("meeting-prep");
    expect(selectSkill("What do I need for my upcoming sync?", skills)?.id).toBe("meeting-prep");
  });

  it("selects morning-briefing for morning briefing requests", () => {
    expect(selectSkill("Give me my morning briefing.", skills)?.id).toBe("morning-briefing");
    expect(selectSkill("Morning briefing", skills)?.id).toBe("morning-briefing");
    expect(selectSkill("What does my day look like?", skills)?.id).toBe("morning-briefing");
    expect(selectSkill("Start my day", skills)?.id).toBe("morning-briefing");
    expect(selectSkill("Brief me on today", skills)?.id).toBe("morning-briefing");
  });

  it("selects capture-note for note capturing requests", () => {
    expect(selectSkill("Take a note: my next video should start with the result.", skills)?.id).toBe("capture-note");
    expect(selectSkill("Remember this note: test note", skills)?.id).toBe("capture-note");
    expect(selectSkill("Put this in my second brain.", skills)?.id).toBe("capture-note");
    expect(selectSkill("Write down that the client prefers dark mode.", skills)?.id).toBe("capture-note");
  });

  it("selects research for personal knowledge retrieval requests", () => {
    expect(selectSkill("What did I write down about DeepSeek?", skills)?.id).toBe("research");
    expect(selectSkill("Find everything I have on agentic harnesses.", skills)?.id).toBe("research");
    expect(selectSkill("What do I know about React 19?", skills)?.id).toBe("research");
    expect(selectSkill("Search my notes for deployment guides", skills)?.id).toBe("research");
  });

  it("selects loose-ends for forgotten items requests", () => {
    expect(selectSkill("What am I forgetting?", skills)?.id).toBe("loose-ends");
    expect(selectSkill("What are my loose ends?", skills)?.id).toBe("loose-ends");
    expect(selectSkill("Any pending follow-ups?", skills)?.id).toBe("loose-ends");
    expect(selectSkill("Did I leave anything unfinished?", skills)?.id).toBe("loose-ends");
    expect(selectSkill("Check for loose ends", skills)?.id).toBe("loose-ends");
  });

  it("returns null for unrelated requests (does not force a skill)", () => {
    expect(selectSkill("Hello Jarvis.", skills)).toBeNull();
    expect(selectSkill("What is 2 + 2?", skills)).toBeNull();
    expect(selectSkill("Why is the sky blue?", skills)).toBeNull();
    expect(selectSkill("Tell me a funny joke.", skills)).toBeNull();
  });
});
