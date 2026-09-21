import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { skillDefinitionSchema, type SkillDefinition } from "@/lib/contracts/skill";

export class SkillLoaderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SkillLoaderError";
  }
}

/**
 * Parses frontmatter key-value pairs and simple arrays.
 */
function parseFrontmatter(raw: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = raw.split(/\r?\n/);
  let currentKey: string | null = null;
  let currentArray: string[] | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    // Check for array item: "  - value" or "- value"
    const arrayItemMatch = line.match(/^\s*-\s+(.+)$/);
    if (arrayItemMatch && currentKey && currentArray) {
      const val = arrayItemMatch[1].trim().replace(/^["']|["']$/g, "");
      currentArray.push(val);
      continue;
    }

    // Check for key: value
    const kvMatch = line.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
    if (kvMatch) {
      if (currentKey && currentArray) {
        result[currentKey] = currentArray;
      }
      currentKey = kvMatch[1].trim();
      const val = kvMatch[2].trim();
      if (val === "" || val === "[]") {
        currentArray = [];
        result[currentKey] = currentArray;
      } else {
        currentArray = null;
        result[currentKey] = val.replace(/^["']|["']$/g, "");
      }
    }
  }

  if (currentKey && currentArray) {
    result[currentKey] = currentArray;
  }

  return result;
}

/**
 * Extracts content under a markdown heading (# Heading or ## Heading).
 */
function extractSection(content: string, heading: string): string {
  const regex = new RegExp(`(?:^|\\n)#{1,3}\\s+${heading}\\s*\\n([\\s\\S]*?)(?=\\n#{1,3}\\s+|$)`, "i");
  const match = content.match(regex);
  return match ? match[1].trim() : "";
}

/**
 * Extracts bullet points or numbered list items from section text.
 */
function extractListItems(sectionText: string): string[] {
  const items: string[] = [];
  const lines = sectionText.split(/\r?\n/);

  for (const line of lines) {
    const match = line.match(/^\s*(?:[-*]|\d+\.)\s+(.+)$/);
    if (match && match[1].trim()) {
      items.push(match[1].trim());
    } else if (line.trim() && !line.trim().startsWith("#")) {
      // Allow raw non-empty lines if no bullet format
      items.push(line.trim());
    }
  }

  return items;
}

/**
 * Loads and validates a single SKILL.md file.
 */
export async function loadSkillFromFile(filePath: string): Promise<SkillDefinition> {
  let rawContent: string;
  try {
    rawContent = await readFile(filePath, "utf-8");
  } catch {
    throw new SkillLoaderError(`Failed to read skill file: ${filePath}`);
  }

  const fmMatch = rawContent.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fmMatch) {
    throw new SkillLoaderError(`Skill file missing YAML frontmatter: ${filePath}`);
  }

  const frontmatter = parseFrontmatter(fmMatch[1]);
  const body = rawContent.slice(fmMatch[0].length);

  const purpose = extractSection(body, "Purpose") || (typeof frontmatter.purpose === "string" ? frontmatter.purpose : "");
  const processItems = extractListItems(extractSection(body, "Process"));
  const decisionRules = extractListItems(extractSection(body, "Decision Rules"));
  const expectedOutput = extractSection(body, "Expected Output") || (typeof frontmatter.expectedOutput === "string" ? frontmatter.expectedOutput : "");

  const whenToUseRaw = Array.isArray(frontmatter.whenToUse)
    ? frontmatter.whenToUse.map(String)
    : extractListItems(extractSection(body, "When to use"));

  const preferredToolsRaw = Array.isArray(frontmatter.preferredTools)
    ? frontmatter.preferredTools.map(String)
    : extractListItems(extractSection(body, "Preferred Tools"));

  const candidate = {
    id: typeof frontmatter.id === "string" ? frontmatter.id.trim() : "",
    name: typeof frontmatter.name === "string" ? frontmatter.name.trim() : "",
    purpose: purpose.trim(),
    description: typeof frontmatter.description === "string" ? frontmatter.description.trim() : purpose.trim(),
    whenToUse: whenToUseRaw,
    process: processItems,
    preferredTools: preferredToolsRaw,
    decisionRules,
    expectedOutput: expectedOutput.trim(),
  };

  const parsed = skillDefinitionSchema.safeParse(candidate);
  if (!parsed.success) {
    const errorDetails = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ");
    throw new SkillLoaderError(`Invalid skill definition in ${filePath} (${errorDetails})`);
  }

  return parsed.data;
}

/**
 * Loads all skills from a parent directory containing <skill-name>/SKILL.md subdirectories.
 */
export async function loadSkillsFromDirectory(skillsDir: string): Promise<SkillDefinition[]> {
  let entries;
  try {
    entries = await readdir(skillsDir, { withFileTypes: true });
  } catch {
    throw new SkillLoaderError(`Skills directory not accessible: ${skillsDir}`);
  }

  const skills: SkillDefinition[] = [];
  const seenIds = new Set<string>();

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const skillFilePath = path.join(skillsDir, entry.name, "SKILL.md");
    try {
      const fileStat = await stat(skillFilePath);
      if (!fileStat.isFile()) continue;
    } catch {
      // No SKILL.md in this directory, skip safely
      continue;
    }

    const skill = await loadSkillFromFile(skillFilePath);
    if (seenIds.has(skill.id)) {
      throw new SkillLoaderError(`Duplicate skill ID detected: "${skill.id}" in ${skillFilePath}`);
    }

    seenIds.add(skill.id);
    skills.push(skill);
  }

  return skills;
}
