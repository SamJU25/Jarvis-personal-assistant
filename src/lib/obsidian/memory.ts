import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { getObsidianVaultPath } from "./config";
import { resolveVaultPath } from "./path";
import { containsSecret } from "@/lib/memory/secrets";
import { getIndexedMemoryFiles, invalidateMemoryIndex } from "./memory-index";

export { invalidateMemoryIndex };
export type { ParsedMemoryFile } from "./memory-parse";

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

// parseFrontmatter moved to ./memory-parse (shared with the derived index).

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
  invalidateMemoryIndex(vaultRoot);

  return entry;
}

/**
 * Lists all memory entries in the canonical Obsidian AI/Memory/ directory.
 * Reads through the derived index with freshness detection: only files whose
 * mtime/size changed since the previous pass are re-parsed, so edits to
 * canonical notes are picked up without any second store.
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
  const { entries: indexed } = await getIndexedMemoryFiles(vaultRoot, memDir);

  const entries: ObsidianMemoryEntry[] = [];

  for (const { fileName, frontmatter, body } of indexed) {
    const id = (frontmatter.id as string) || path.basename(fileName, ".md");
    const title = (frontmatter.title as string) || path.basename(fileName, ".md");
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
      id: id || `file-${entries.length}`,
      title: title || "Untitled",
      category,
      tags,
      content: body,
      relativePath: `${MEMORY_DIR}/${fileName}`,
      createdAt,
      updatedAt,
    });
  }

  entries.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  if (options?.limit && options.limit > 0) {
    return entries.slice(0, options.limit);
  }

  return entries;
}

/**
 * Searches memories inside Obsidian AI/Memory/ based on query terms matching
 * title, tags, category, and body. Keyword-first scoring; delegates to the
 * traced retrieval path so every search returns the same ranking.
 */
export async function searchObsidianMemory(
  query: string,
  options?: SearchObsidianMemoryOptions,
  vaultRootOverride?: string
): Promise<ObsidianMemoryEntry[]> {
  const { matches } = await searchObsidianMemoryWithTrace(query, options, vaultRootOverride);
  return matches.map((m) => m.entry);
}

/**
 * A scored retrieval match: which note influenced the answer and why.
 * Exact phrase matches rank above single-word hits; freshness boosts recent
 * notes slightly without ever changing the canonical store.
 */
export interface MemoryMatchTrace {
  entry: ObsidianMemoryEntry;
  score: number;
  matchedTerms: string[];
  /** How the note matched (trace metadata for diagnostics). */
  signals: Array<"exact_title" | "exact_content" | "title_word" | "tag_word" | "category_word" | "content_word">;
}

/**
 * Keyword-first scored retrieval with an explicit trace. This is the same
 * ranking used by searchObsidianMemory, but returns the score, matched terms,
 * and signals so retrieval traces can show which notes influenced the answer.
 */
export async function searchObsidianMemoryWithTrace(
  query: string,
  options?: SearchObsidianMemoryOptions,
  vaultRootOverride?: string
): Promise<{ matches: MemoryMatchTrace[]; totalIndexed: number }> {
  const allEntries = await listObsidianMemory({ category: options?.category }, vaultRootOverride);

  if (!query || !query.trim()) {
    const limit = options?.limit ?? 10;
    return {
      matches: allEntries
        .slice(0, limit)
        .map((entry) => ({ entry, score: 1, matchedTerms: [], signals: [] })),
      totalIndexed: allEntries.length,
    };
  }

  const queryTrimmed = query.trim().toLowerCase();
  const words = queryTrimmed.split(/[^a-z0-9]+/).filter((w) => w.length > 1);

  if (words.length === 0) {
    const limit = options?.limit ?? 10;
    return {
      matches: allEntries
        .slice(0, limit)
        .map((entry) => ({ entry, score: 1, matchedTerms: [], signals: [] })),
      totalIndexed: allEntries.length,
    };
  }

  const traced: MemoryMatchTrace[] = [];
  for (const entry of allEntries) {
    let score = 0;
    const signals: MemoryMatchTrace["signals"] = [];
    const matchedTerms = new Set<string>();
    const titleLower = entry.title.toLowerCase();
    const contentLower = entry.content.toLowerCase();
    const tagsLower = entry.tags.map((t) => t.toLowerCase());
    const categoryLower = entry.category.toLowerCase();

    if (titleLower.includes(queryTrimmed)) {
      score += 10;
      signals.push("exact_title");
      matchedTerms.add(queryTrimmed);
    }
    if (contentLower.includes(queryTrimmed)) {
      score += 8;
      signals.push("exact_content");
      matchedTerms.add(queryTrimmed);
    }

    for (const w of words) {
      let hit = false;
      if (titleLower.includes(w)) { score += 5; signals.push("title_word"); hit = true; }
      if (tagsLower.some((t) => t.includes(w))) { score += 4; signals.push("tag_word"); hit = true; }
      if (categoryLower.includes(w)) { score += 3; signals.push("category_word"); hit = true; }
      if (contentLower.includes(w)) { score += 1; signals.push("content_word"); hit = true; }
      if (hit) matchedTerms.add(w);
    }

    if (score > 0) {
      // Freshness: recently updated notes get a small deterministic boost.
      const ageDays = Math.max(0, (Date.now() - new Date(entry.updatedAt).getTime()) / 86_400_000);
      const freshness = ageDays < 7 ? 1 : ageDays < 30 ? 0.5 : 0;
      score += freshness;
      traced.push({ entry, score, matchedTerms: Array.from(matchedTerms), signals });
    }
  }

  traced.sort((a, b) => b.score - a.score);
  const limit = options?.limit ?? 10;
  return { matches: traced.slice(0, limit), totalIndexed: allEntries.length };
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
    invalidateMemoryIndex(vaultRoot);
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
    // Source/path metadata makes retrieval traces show which notes influenced
    // the answer, and keeps external content clearly attributed.
    const item = `- [${m.category}] ${m.title} (${m.relativePath}): ${m.content}`;
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
