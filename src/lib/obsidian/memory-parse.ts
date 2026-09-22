/**
 * Frontmatter parsing shared by the canonical memory store and the derived
 * retrieval index. Pure function — no filesystem access.
 */

export interface ParsedMemoryFile {
  frontmatter: Record<string, string | string[]>;
  body: string;
}

/**
 * Parses simple YAML-style frontmatter from markdown.
 */
export function parseFrontmatter(raw: string): ParsedMemoryFile {
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
