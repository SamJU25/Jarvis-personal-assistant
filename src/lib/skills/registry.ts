import path from "node:path";
import type { SkillDefinition, SkillMetadata } from "@/lib/contracts/skill";
import { loadSkillsFromDirectory } from "@/lib/skills/loader";

export class SkillRegistry {
  private readonly skills = new Map<string, SkillDefinition>();

  register(skill: SkillDefinition): void {
    if (this.skills.has(skill.id)) {
      throw new Error(`Duplicate skill registration: "${skill.id}" is already registered.`);
    }
    this.skills.set(skill.id, skill);
  }

  get(id: string): SkillDefinition | undefined {
    return this.skills.get(id);
  }

  has(id: string): boolean {
    return this.skills.has(id);
  }

  list(): readonly SkillDefinition[] {
    return Array.from(this.skills.values());
  }

  getMetadata(): readonly SkillMetadata[] {
    return Array.from(this.skills.values()).map((skill) => ({
      id: skill.id,
      name: skill.name,
      description: skill.description,
      whenToUse: skill.whenToUse,
      preferredTools: skill.preferredTools,
    }));
  }
}

/**
 * Creates the default skill registry by loading skills from the project's skills/ directory.
 */
export async function createDefaultSkillRegistry(customDir?: string): Promise<SkillRegistry> {
  const registry = new SkillRegistry();
  const skillsDir = customDir ?? path.resolve(process.cwd(), "skills");

  try {
    const loadedSkills = await loadSkillsFromDirectory(skillsDir);
    for (const skill of loadedSkills) {
      registry.register(skill);
    }
  } catch (error) {
    // If loading fails (e.g. skills directory doesn't exist in a custom test), return empty registry
    console.warn(`[SkillRegistry] Notice: Could not load default skills from ${skillsDir}:`, error);
  }

  return registry;
}
