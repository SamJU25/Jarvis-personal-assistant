import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { getObsidianVaultPath } from "./config";
import { resolveVaultPath, toVaultRelativePath } from "./path";
import { containsSecret } from "@/lib/memory/secrets";

export interface ObsidianMemoryEntry {
  id: string;
  title: string;
  category: string;
  tags: string[];
  content: string;
  relativePath: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoreObsidianMemoryInput {
  content: string;
  title?: string;
  category?: string;
  tags?: string[];
}

export interface SearchObsidianMemoryOptions {
  category?: string;
  limit?: number;
}

const MEMORY_DIR = "AI/Memory";

/**
 * Ensures the canonical memory directory exists inside the configured Obsidian vault.
 */
async function ensureMemoryDir(vaultRoot: string): Promise<string> {
  const fullDir = await resolveVaultPath(vaultRoot, MEMORY_DIR);
  await fs.mkdir(fullDir, { recursive: true });
  return fullDir;
}

/**
 * Parses simple YAML-style frontmatter from markdown file.
 */
function parseFrontmatter(raw: string): {
  frontmatter: Record<string, string | string[]>;
  body: string;
} {
  const frontmatter: Record<string, string | string[]> = {};
  const trimmed = raw.trim();

  if (!trimmed.startsWith("---")) {
    return { frontmatter, body: trimmed };
  }

  const endIdx = trimmed.indexOf("\n---", 3);
  if (endIdx === -1) {
    return { frontmatter, body: trimmed };
  }

  const header = trimmed.slice(3, endIdx).trim();
  const body = trimmed.slice(endIdx + 4).trim();

  for (const line of header.split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const val = line.slice(colonIdx + 1).trim();

    if (val.startsWith("[") && val.endsWith("]")) {
      const items = val
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
      frontmatter[key] = items;
    } else {
      frontmatter[key] = val.replace(/^["']|["']$/g, "");
    }
  }

  return { frontmatter, body };
}

/**
 * Serializes frontmatter and body into Markdown content.
 */
function serializeMemory(entry: Omit<ObsidianMemoryEntry, "relativePath">): string {
  const tagsStr = `[${entry.tags.map((t) => `"${t}"`).join(", ")}]`;
  return `---
id: "${entry.id}"
title: "${entry.title.replace(/"/g, '\\"')}"
category: "${entry.category}"
tags: ${tagsStr}
createdAt: "${entry.createdAt}"
updatedAt: "${entry.updatedAt}"
---

${entry.content.trim()}
`;
}

/**
 * Stores a new memory into the canonical Obsidian AI/Memory/ directory.
 * Fails closed if the content contains credentials or private keys.
 */
export async function storeObsidianMemory(
  input: StoreObsidianMemoryInput,
  vaultRootOverride?: string
): Promise<ObsidianMemoryEntry> {
  const vaultRoot = vaultRootOverride ?? getObsidianVaultPath();
  if (!vaultRoot) {
    throw new Error("Obsidian vault path is not configured (OBSIDIAN_VAULT_PATH).");
  }

  const secretCheck = containsSecret(input.content);
  if (secretCheck.hasSecret) {
    throw new Error(
      `Cannot store memory: Content contains sensitive information (${secretCheck.reason || "secret pattern detected"}).`
    );
  }

  await ensureMemoryDir(vaultRoot);

  const now = new Date().toISOString();
  const id = `mem-${crypto.randomUUID().slice(0, 8)}`;
  const title = input.title?.trim() || `Memory ${new Date().toLocaleDateString()}`;
  const category = input.category?.trim().toLowerCase() || "general";
  const tags = Array.isArray(input.tags)
    ? input.tags.map((t) => t.trim().toLowerCase()).filter(Boolean)
    : ["memory"];

  if (!tags.includes(category)) {
    tags.push(category);
  }

  const safeFilename = `${title.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40)}_${id}.md`;
  const relativePath = `${MEMORY_DIR}/${safeFilename}`;
  const fullPath = await resolveVaultPath(vaultRoot, relativePath);

  const entry: ObsidianMemoryEntry = {
    id,
    title,
    category,
    tags,
    content: input.content.trim(),
    relativePath,
    createdAt: now,
    updatedAt: now,
  };

  const fileContent = serializeMemory(entry);
  await fs.writeFile(fullPath, fileContent, "utf-8");

  return entry;
}

/**
 * Lists all memory entries in the canonical Obsidian AI/Memory/ directory.
 */
export async function listObsidianMemory(
  options?: { category?: string; limit?: number },
  vaultRootOverride?: string
): Promise<ObsidianMemoryEntry[]> {
  const vaultRoot = vaultRootOverride ?? getObsidianVaultPath();
  if (!vaultRoot) {
    return [];
  }

  const memDir = await ensureMemoryDir(vaultRoot);

  let fileNames: string[] = [];
  try {
    fileNames = await fs.readdir(memDir);
  } catch {
    return [];
  }

  const entries: ObsidianMemoryEntry[] = [];
  const mdFiles = fileNames.filter((f) => f.endsWith(".md"));

  for (const file of mdFiles) {
    try {
      const fullPath = path.join(memDir, file);
      const raw = await fs.readFile(fullPath, "utf-8");
      const { frontmatter, body } = parseFrontmatter(raw);

      const id = (frontmatter.id as string) || path.basename(file, ".md");
      const title = (frontmatter.title as string) || path.basename(file, ".md");
      const category = (frontmatter.category as string) || "general";
      const tags = Array.isArray(frontmatter.tags)
        ? (frontmatter.tags as string[])
        : typeof frontmatter.tags === "string"
        ? [frontmatter.tags]
        : [];
      const createdAt = (frontmatter.createdAt as string) || new Date().toISOString();
      const updatedAt = (frontmatter.updatedAt as string) || createdAt;

      if (options?.category && category.toLowerCase() !== options.category.toLowerCase()) {
        continue;
      }

      entries.push({
        id,
        title,
        category,
        tags,
        content: body,
        relativePath: toVaultRelativePath(vaultRoot, fullPath),
        createdAt,
        updatedAt,
      });
    } catch {
      // skip unreadable files gracefully
    }
  }

  entries.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  if (options?.limit && options.limit > 0) {
    return entries.slice(0, options.limit);
  }

  return entries;
}

/**
 * Searches memories inside Obsidian AI/Memory/ based on query terms matching title, tags, category, and body.
 */
export async function searchObsidianMemory(
  query: string,
  options?: SearchObsidianMemoryOptions,
  vaultRootOverride?: string
): Promise<ObsidianMemoryEntry[]> {
  const allEntries = await listObsidianMemory({ category: options?.category }, vaultRootOverride);
  if (!query || !query.trim()) {
    const limit = options?.limit ?? 10;
    return allEntries.slice(0, limit);
  }

  const queryTrimmed = query.trim().toLowerCase();
  const words = queryTrimmed
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1);

  if (words.length === 0) {
    const limit = options?.limit ?? 10;
    return allEntries.slice(0, limit);
  }

  const scored = allEntries.map((entry) => {
    let score = 0;
    const titleLower = entry.title.toLowerCase();
    const contentLower = entry.content.toLowerCase();
    const tagsLower = entry.tags.map((t) => t.toLowerCase());

    if (titleLower.includes(queryTrimmed)) score += 10;
    if (contentLower.includes(queryTrimmed)) score += 8;

    for (const w of words) {
      if (titleLower.includes(w)) score += 5;
      if (tagsLower.some((t) => t.includes(w))) score += 4;
      if (entry.category.toLowerCase().includes(w)) score += 3;
      if (contentLower.includes(w)) score += 1;
    }

    return { entry, score };
  });

  const matches = scored
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.entry);

  const limit = options?.limit ?? 10;
  return matches.slice(0, limit);
}

/**
 * Deletes a memory entry by ID from the Obsidian vault.
 */
export async function deleteObsidianMemory(
  id: string,
  vaultRootOverride?: string
): Promise<boolean> {
  const vaultRoot = vaultRootOverride ?? getObsidianVaultPath();
  if (!vaultRoot) return false;

  const entries = await listObsidianMemory(undefined, vaultRoot);
  const target = entries.find((e) => e.id === id);
  if (!target) return false;

  try {
    const fullPath = await resolveVaultPath(vaultRoot, target.relativePath);
    await fs.unlink(fullPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Formats retrieved Obsidian memories into bounded context for agent system instructions.
 */
export function formatObsidianMemoryContext(
  memories: ObsidianMemoryEntry[],
  options?: { maxChars?: number }
): string | null {
  if (memories.length === 0) return null;

  const maxChars = options?.maxChars ?? 2000;
  const lines: string[] = ["--- RETRIEVED OBSIDIAN MEMORIES (Untrusted Reference) ---"];

  let charCount = lines[0].length;
  for (const m of memories) {
    const item = `- [${m.category}] ${m.title}: ${m.content}`;
    if (charCount + item.length > maxChars) {
      lines.push("... (additional memories truncated)");
      break;
    }
    lines.push(item);
    charCount += item.length + 1;
  }

  lines.push("--- END MEMORIES ---");
  return lines.join("\n");
}
