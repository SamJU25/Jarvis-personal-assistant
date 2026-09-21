import { describe, expect, it } from "vitest";
import { skillDefinitionSchema, skillMetadataSchema } from "@/lib/contracts/skill";

describe("Skill Contract Schemas", () => {
  const validSkill = {
    id: "test-skill",
    name: "Test Skill",
    purpose: "Test skill purpose",
    description: "Test skill description",
    whenToUse: ["When testing skills"],
    process: ["Step 1", "Step 2"],
    preferredTools: ["search_vault"],
    decisionRules: ["Rule 1"],
    expectedOutput: "Expected output description",
  };

  it("validates a complete skill definition", () => {
    const result = skillDefinitionSchema.safeParse(validSkill);
    expect(result.success).toBe(true);
  });

  it("rejects skill with missing id", () => {
    const result = skillDefinitionSchema.safeParse({ ...validSkill, id: "" });
    expect(result.success).toBe(false);
  });

  it("rejects skill with missing name", () => {
    const result = skillDefinitionSchema.safeParse({ ...validSkill, name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects skill with empty whenToUse array", () => {
    const result = skillDefinitionSchema.safeParse({ ...validSkill, whenToUse: [] });
    expect(result.success).toBe(false);
  });

  it("rejects skill with empty process array", () => {
    const result = skillDefinitionSchema.safeParse({ ...validSkill, process: [] });
    expect(result.success).toBe(false);
  });

  it("validates sanitized skill metadata", () => {
    const metadata = {
      id: "test-skill",
      name: "Test Skill",
      description: "Test skill description",
      whenToUse: ["When testing skills"],
      preferredTools: ["search_vault"],
    };
    const result = skillMetadataSchema.safeParse(metadata);
    expect(result.success).toBe(true);
  });

  it("rejects metadata with empty id or name", () => {
    expect(skillMetadataSchema.safeParse({ id: "", name: "Test", description: "Desc", whenToUse: [], preferredTools: [] }).success).toBe(false);
    expect(skillMetadataSchema.safeParse({ id: "test", name: "", description: "Desc", whenToUse: [], preferredTools: [] }).success).toBe(false);
  });
});
