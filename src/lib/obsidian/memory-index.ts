import fs from "node:fs/promises";
import path from "node:path";
import { parseFrontmatter, type ParsedMemoryFile } from "./memory-parse";

/**
 * Phase 11 — Advanced Obsidian Memory Retrieval.
 *
 * Derived retrieval index over the canonical Obsidian `AI/Memory/` directory.
 * The index is a pure cache: canonical Markdown remains the single source of
 * truth. Every read performs freshness detection (mtime + size), so an edited
 * note is re-parsed on the next retrieval and a deleted note disappears —
 * without any second canonical store. The whole index is rebuildable at any
 * time via `invalidateMemoryIndex()`.
 */

export interface IndexedMemoryFile {
  /** File fingerprint used for freshness detection. */
  mtimeMs: number;
  size: number;
  /** Parsed entry derived from the canonical file. */
  parsed: ParsedMemoryFile;
}

interface IndexedVault {
  files: Map<string, IndexedMemoryFile>;
  /** Rejects directories with implausibly large memory stores (bounded work). */
}

/** Maximum number of memory files indexed per vault (bounded retrieval work). */
export const MAX_INDEX_FILES = 500;

const vaultIndexes = new Map<string, IndexedVault>();

function normalizeKey(memDir: string, fullPath: string): string {
  return path.relative(memDir, fullPath).toLowerCase();
}

function getVaultIndex(vaultRoot: string): IndexedVault {
  let idx = vaultIndexes.get(vaultRoot);
  if (!idx) {
    idx = { files: new Map() };
    vaultIndexes.set(vaultRoot, idx);
  }
  return idx;
}

/**
 * Drops all cached parsed entries. The next retrieval rebuilds the index from
 * canonical files. Call after external bulk mutations or for testing.
 */
export function invalidateMemoryIndex(vaultRoot?: string): void {
  if (vaultRoot) {
    vaultIndexes.delete(vaultRoot);
  } else {
    vaultIndexes.clear();
  }
}

export interface IndexedEntry {
  /** File name within AI/Memory/ (used to build the vault-relative path). */
  fileName: string;
  frontmatter: Record<string, string | string[]>;
  body: string;
}

export interface IndexRebuildResult {
  entries: IndexedEntry[];
  /** How many files were re-parsed during this freshness pass. */
  revalidated: number;
  /** How many cached files were reused without re-reading. */
  reused: number;
  /** Total indexed files after the pass. */
  total: number;
  truncated: boolean;
}

/**
 * Freshness-checked index read. Stats every memory file; only files whose
 * mtime or size changed since the last pass are re-read and re-parsed.
 * Removed files are dropped from the index automatically.
 */
export async function getIndexedMemoryFiles(
  vaultRoot: string,
  memDir: string
): Promise<IndexRebuildResult> {
  const index = getVaultIndex(vaultRoot);

  let fileNames: string[] = [];
  try {
    fileNames = await fs.readdir(memDir);
  } catch {
    index.files.clear();
    return { entries: [], revalidated: 0, reused: 0, total: 0, truncated: false };
  }

  const mdFiles = fileNames.filter((f) => f.toLowerCase().endsWith(".md")).sort();
  const truncated = mdFiles.length > MAX_INDEX_FILES;
  const effective = mdFiles.slice(0, MAX_INDEX_FILES);

  const seen = new Set<string>();
  const entries: IndexedEntry[] = [];
  let revalidated = 0;
  let reused = 0;

  for (const file of effective) {
    const fullPath = path.join(memDir, file);
    const key = normalizeKey(memDir, fullPath);
    seen.add(key);

    let stat: { mtimeMs: number; size: number };
    try {
      const s = await fs.stat(fullPath);
      stat = { mtimeMs: s.mtimeMs, size: s.size };
    } catch {
      index.files.delete(key);
      continue;
    }

    const cached = index.files.get(key);
    if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) {
      reused++;
      entries.push({ fileName: file, frontmatter: cached.parsed.frontmatter, body: cached.parsed.body });
      continue;
    }

    try {
      const raw = await fs.readFile(fullPath, "utf-8");
      const parsed = parseFrontmatter(raw);
      index.files.set(key, { mtimeMs: stat.mtimeMs, size: stat.size, parsed });
      revalidated++;
      entries.push({ fileName: file, frontmatter: parsed.frontmatter, body: parsed.body });
    } catch {
      index.files.delete(key);
    }
  }

  // Drop index entries for files deleted from the vault.
  for (const key of Array.from(index.files.keys())) {
    if (!seen.has(key)) index.files.delete(key);
  }

  return {
    entries,
    revalidated,
    reused,
    total: entries.length,
    truncated,
  };
}
