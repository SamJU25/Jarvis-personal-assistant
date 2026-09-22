import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

// Load .env.local (server-side only)
if (fs.existsSync(".env.local")) {
  const content = fs.readFileSync(".env.local", "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const idx = trimmed.indexOf("=");
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

import { getObsidianVaultPath } from "../src/lib/obsidian/config";
import { storeObsidianMemory, listObsidianMemory, invalidateMemoryIndex } from "../src/lib/obsidian/memory";
import { discoverObsidianSkills } from "../src/lib/obsidian/skills";
import { parseFrontmatter } from "../src/lib/obsidian/memory-parse";

/**
 * Migrates JARVIS packaged defaults into the canonical Obsidian vault:
 *  - skills/<id>/SKILL.md        → <vault>/AI/Skills/<id>/SKILL.md (Hermes format)
 *  - .jarvis/memory.db records   → <vault>/AI/Memory/*.md (canonical Markdown)
 * Packaged repo skills remain as application defaults; the vault is canonical.
 */
async function main() {
  const vault = getObsidianVaultPath();
  if (!vault) throw new Error("OBSIDIAN_VAULT_PATH not configured");
  console.log("Vault:", vault);

  // ── 1. Skills migration ──────────────────────────────────────────────
  const repoSkillsDir = path.resolve(process.cwd(), "skills");
  const vaultSkillsDir = path.join(vault, "AI", "Skills");
  await fsp.mkdir(vaultSkillsDir, { recursive: true });

  const skillDirs = (await fsp.readdir(repoSkillsDir)).filter((d) =>
    fs.existsSync(path.join(repoSkillsDir, d, "SKILL.md"))
  );
  console.log(`\nFound ${skillDirs.length} packaged skills: ${skillDirs.join(", ")}`);

  for (const skillId of skillDirs) {
    const raw = await fsp.readFile(path.join(repoSkillsDir, skillId, "SKILL.md"), "utf-8");
    const { frontmatter, body } = parseFrontmatter(raw);

    const name = (frontmatter.id as string) || skillId;
    const description = (frontmatter.description as string) || "";
    // Block-style YAML lists ("whenToUse:\n  - ...") — parseFrontmatter only
    // handles inline arrays, so extract block items from the raw frontmatter.
    const whenToUse: string[] = [];
    const blockMatch = raw.match(/whenToUse:\s*\r?\n((?:[ \t]+-[^\n]*\r?\n?)+)/);
    if (blockMatch) {
      for (const line of blockMatch[1].split(/\r?\n/)) {
        const m = line.match(/^\s+-\s*["']?(.+?)["']?\s*$/);
        if (m && m[1].trim()) whenToUse.push(m[1].trim());
      }
    }

    // Hermes-compatible frontmatter; whenToUse phrases become tags.
    const tags = whenToUse
      .map((t) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""))
      .slice(0, 6);
    const escapedDesc = description.replace(/"/g, '\\"');
    const canonical = `---
name: "${name}"
description: "${escapedDesc}"
version: "1.0.0"
author: "JARVIS"
category: "productivity"
tags: [${tags.map((t) => `"${t}"`).join(", ")}]
---

${body}
`;

    const targetDir = path.join(vaultSkillsDir, name);
    await fsp.mkdir(targetDir, { recursive: true });
    await fsp.writeFile(path.join(targetDir, "SKILL.md"), canonical, "utf-8");
    console.log(`  ✓ ${name}`);
  }

  // ── 2. Memory migration (SQLite → canonical Markdown) ────────────────
  console.log("\nMigrating SQLite memory records...");
  const { DatabaseSync } = await import("node:sqlite");
  const dbPath = path.resolve(process.cwd(), ".jarvis", "memory.db");
  let migrated = 0;

  if (fs.existsSync(dbPath)) {
    const db = new DatabaseSync(dbPath);
    try {
      const rows = db.prepare("SELECT id, content, category, source, created_at FROM memories").all() as Array<{
        id: string; content: string; category: string; source: string; created_at: string;
      }>;
      const existing = await listObsidianMemory(undefined, vault);
      for (const row of rows) {
        // Idempotent: skip if an equivalent canonical note already exists.
        if (existing.some((m) => m.content.trim() === row.content.trim())) {
          console.log(`  skip (already canonical): ${row.content.slice(0, 50)}`);
          continue;
        }
        const entry = await storeObsidianMemory(
          {
            title: `Preference (${row.category})`,
            content: row.content,
            category: row.category,
            tags: ["migrated", row.category],
          },
          vault
        );
        console.log(`  ✓ migrated → ${entry.relativePath}`);
        migrated++;
      }
    } finally {
      db.close();
    }
  } else {
    console.log("  no SQLite DB found — nothing to migrate");
  }
  console.log(`Migrated ${migrated} memory record(s)`);

  // ── 3. Clean up empty stray dirs at vault root ───────────────────────
  for (const stray of ["memory", "skills"]) {
    const strayPath = path.join(vault, stray);
    try {
      const files = await fsp.readdir(strayPath);
      if (files.length === 0) {
        await fsp.rmdir(strayPath);
        console.log(`  ✓ removed empty stray dir: ${stray}/`);
      }
    } catch { /* absent or non-empty */ }
  }

  // ── 4. Verification ──────────────────────────────────────────────────
  console.log("\n── Verification ──");
  invalidateMemoryIndex(vault);

  const skills = await discoverObsidianSkills(vault);
  const skillNames = skills.map((s) => s.name).sort();
  console.log(`Vault skills discovered: ${skillNames.length} — ${skillNames.join(", ")}`);
  for (const expected of skillDirs) {
    if (!skillNames.includes(expected)) throw new Error(`Missing vault skill: ${expected}`);
  }

  const memories = await listObsidianMemory(undefined, vault);
  console.log(`Canonical memories: ${memories.length}`);
  for (const m of memories) {
    console.log(`  - [${m.category}] ${m.title} (${m.relativePath})`);
  }

  console.log("\n=== MIGRATION COMPLETE ===");
}

main().catch((err) => {
  console.error("Migration FAILED:", err);
  process.exit(1);
});
