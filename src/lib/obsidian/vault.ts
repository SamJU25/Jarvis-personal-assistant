import { readdir, readFile, stat, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { resolveVaultPath, toVaultRelativePath, ObsidianPathError } from "@/lib/obsidian/path";

export interface VaultSearchResultItem {
  path: string;
  title: string;
  excerpt: string;
  modifiedAt: string;
  tags: string[];
}

export interface VaultSearchResults {
  query: string;
  total: number;
  results: VaultSearchResultItem[];
}

export interface VaultNote {
  path: string;
  title: string;
  content: string;
  modifiedAt: string;
  tags: string[];
}

export interface CreatedVaultNote {
  path: string;
  title: string;
  createdAt: string;
}

const IGNORED_DIRECTORIES = new Set([".obsidian", ".git", ".trash", "node_modules"]);

/**
 * Searches the Obsidian vault for notes matching the query in filename, headings, or content.
 */
export async function searchVault(
  vaultRoot: string,
  query: string,
  limit = 10
): Promise<VaultSearchResults> {
  const q = query.trim().toLowerCase();
  if (!q) {
    return { query, total: 0, results: [] };
  }

  const results: VaultSearchResultItem[] = [];
  const maxResults = Math.max(1, Math.min(limit, 50));

  async function scanDir(currentDir: string): Promise<void> {
    if (results.length >= maxResults) return;

    let entries;
    try {
      entries = await readdir(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (results.length >= maxResults) break;

      if (entry.isDirectory()) {
        if (!IGNORED_DIRECTORIES.has(entry.name)) {
          await scanDir(path.join(currentDir, entry.name));
        }
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        const fullPath = path.join(currentDir, entry.name);
        try {
          const content = await readFile(fullPath, "utf-8");
          const lowerContent = content.toLowerCase();
          const fileNameWithoutExt = entry.name.slice(0, -3);
          const lowerFileName = fileNameWithoutExt.toLowerCase();

          if (lowerFileName.includes(q) || lowerContent.includes(q)) {
            const stats = await stat(fullPath);
            const title = extractTitle(content, fileNameWithoutExt);
            const tags = extractTags(content);
            const excerpt = extractExcerpt(content, q);
            const relPath = toVaultRelativePath(vaultRoot, fullPath);

            results.push({
              path: relPath,
              title,
              excerpt,
              modifiedAt: stats.mtime.toISOString(),
              tags,
            });
          }
        } catch {
          // Skip unreadable files
        }
      }
    }
  }

  await scanDir(path.resolve(vaultRoot));

  return {
    query,
    total: results.length,
    results,
  };
}

/**
 * Reads a single note from the Obsidian vault by vault-relative path.
 */
export async function readVaultNote(vaultRoot: string, relativePath: string): Promise<VaultNote> {
  let normalizedRelPath = relativePath.trim();
  const ext = path.extname(normalizedRelPath).toLowerCase();
  if (ext && ext !== ".md" && ext !== ".markdown") {
    throw new ObsidianPathError("Only Markdown (.md) notes can be read from the vault.");
  }
  if (!ext) {
    normalizedRelPath += ".md";
  }

  let absolutePath = await resolveVaultPath(vaultRoot, normalizedRelPath);

  let stats;
  try {
    stats = await stat(absolutePath);
  } catch {
    // Fallback: If not found at exact path, check if note exists by basename anywhere in vault
    const baseName = path.basename(normalizedRelPath);
    const searchResult = await searchVault(vaultRoot, baseName.replace(/\.(md|markdown)$/, ""), 5);
    const match = searchResult.results.find(
      (r) => path.basename(r.path).toLowerCase() === baseName.toLowerCase()
    );
    if (match) {
      absolutePath = await resolveVaultPath(vaultRoot, match.path);
      stats = await stat(absolutePath);
    } else {
      throw new ObsidianPathError(`Note not found: "${relativePath}"`);
    }
  }

  if (!stats.isFile()) {
    throw new ObsidianPathError(`Path is not a file: "${relativePath}"`);
  }

  const content = await readFile(absolutePath, "utf-8");
  const fileNameWithoutExt = path.basename(absolutePath).replace(/\.(md|markdown)$/, "");
  const title = extractTitle(content, fileNameWithoutExt);
  const tags = extractTags(content);

  return {
    path: toVaultRelativePath(vaultRoot, absolutePath),
    title,
    content,
    modifiedAt: stats.mtime.toISOString(),
    tags,
  };
}

/**
 * Creates a new note in the specified vault folder without overwriting existing files.
 */
export async function createVaultNote(
  vaultRoot: string,
  title: string,
  content: string,
  folder = "Inbox/JARVIS"
): Promise<CreatedVaultNote> {
  const trimmedTitle = title.trim();
  if (!trimmedTitle) {
    throw new ObsidianPathError("Note title cannot be empty.");
  }

  // Sanitize filename to prevent illegal filesystem characters
  const safeBaseName = trimmedTitle.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").trim() || "Untitled";

  // Resolve target directory inside vault
  const targetFolderAbsolute = await resolveVaultPath(vaultRoot, folder);
  await mkdir(targetFolderAbsolute, { recursive: true });

  // Generate unique filename to avoid overwriting existing files
  let fileName = `${safeBaseName}.md`;
  let targetFileAbsolute = path.join(targetFolderAbsolute, fileName);
  let counter = 1;

  while (await fileExists(targetFileAbsolute)) {
    fileName = `${safeBaseName}_${counter}.md`;
    targetFileAbsolute = path.join(targetFolderAbsolute, fileName);
    counter++;
  }

  // Write content
  await writeFile(targetFileAbsolute, content, { encoding: "utf-8", flag: "wx" });

  return {
    path: toVaultRelativePath(vaultRoot, targetFileAbsolute),
    title: trimmedTitle,
    createdAt: new Date().toISOString(),
  };
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

function extractTitle(content: string, fallback: string): string {
  // Check YAML frontmatter title: "..." or title: ...
  const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (frontmatterMatch) {
    const titleMatch = frontmatterMatch[1].match(/^title:\s*["']?([^"'\r\n]+)["']?/m);
    if (titleMatch && titleMatch[1].trim()) {
      return titleMatch[1].trim();
    }
  }
  // Check first markdown heading # Title
  const headingMatch = content.match(/^#\s+(.+)$/m);
  if (headingMatch && headingMatch[1].trim()) {
    return headingMatch[1].trim();
  }
  return fallback;
}

function extractTags(content: string): string[] {
  const tags = new Set<string>();

  // Frontmatter tags: [tag1, tag2] or multi-line
  const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (frontmatterMatch) {
    const tagsMatch = frontmatterMatch[1].match(/^tags:\s*\[(.*?)\]/m);
    if (tagsMatch) {
      tagsMatch[1].split(",").forEach((t) => {
        const cleaned = t.trim().replace(/^["']|["']$/g, "").replace(/^#/, "");
        if (cleaned) tags.add(cleaned);
      });
    }
  }

  // Inline tags: #tag (excluding markdown headings)
  const inlineMatches = content.matchAll(/(?:^|\s)#([a-zA-Z0-9_\-/]+)/g);
  for (const match of inlineMatches) {
    if (match[1]) tags.add(match[1]);
  }

  return Array.from(tags).slice(0, 10);
}

function extractExcerpt(content: string, query: string): string {
  // Strip frontmatter
  const body = content.replace(/^---\r?\n[\s\S]*?\r?\n---/, "").trim();
  if (!body) return "";

  const lowerBody = body.toLowerCase();
  const matchIndex = lowerBody.indexOf(query.toLowerCase());

  if (matchIndex === -1) {
    // Return beginning of note
    return body.slice(0, 180).replace(/\s+/g, " ") + (body.length > 180 ? "..." : "");
  }

  const start = Math.max(0, matchIndex - 60);
  const end = Math.min(body.length, matchIndex + query.length + 120);
  let excerpt = body.slice(start, end).replace(/\s+/g, " ");

  if (start > 0) excerpt = "..." + excerpt;
  if (end < body.length) excerpt = excerpt + "...";

  return excerpt;
}
