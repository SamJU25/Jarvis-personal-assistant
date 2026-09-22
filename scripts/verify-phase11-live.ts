import fs from "node:fs";
import path from "node:path";
import {
  storeObsidianMemory,
  searchObsidianMemoryWithTrace,
  searchObsidianMemory,
  deleteObsidianMemory,
  formatObsidianMemoryContext,
} from "../src/lib/obsidian/memory";
import { getObsidianVaultPath } from "../src/lib/obsidian/config";

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

async function main() {
  console.log("=== Phase 11 Live Verification (configured Obsidian vault) ===\n");

  const vault = getObsidianVaultPath();
  console.log("1. Configured vault:", vault);
  if (!vault) throw new Error("OBSIDIAN_VAULT_PATH not configured");

  // 2. Store a memory into the canonical vault memory folder
  const entry = await storeObsidianMemory({
    title: "Phase 11 Verification Note",
    content: "JARVIS Phase 11 retrieval index verification placeholder.",
    category: "verification",
    tags: ["phase11", "verification"],
  });
  console.log("2. Stored memory:", entry.relativePath);

  // 3. Traced retrieval through the configured vault
  const { matches, totalIndexed } = await searchObsidianMemoryWithTrace("phase 11 verification");
  console.log(`3. Trace: ${matches.length} match(es) of ${totalIndexed} indexed note(s)`);
  const top = matches[0];
  if (!top || top.entry.id !== entry.id) throw new Error("Stored note not found by traced search");
  console.log(`   score=${top.score} terms=[${top.matchedTerms.join(", ")}] signals=[${top.signals.join(", ")}]`);

  // 4. Context injection carries source/path metadata
  const context = formatObsidianMemoryContext([top.entry]);
  if (!context || !context.includes(entry.relativePath)) throw new Error("Context missing path metadata");
  console.log("4. Context line includes vault-relative path:", entry.relativePath);

  // 5. Freshness: edit the canonical note, verify retrieval changes
  const fullPath = path.join(vault, entry.relativePath);
  const raw = fs.readFileSync(fullPath, "utf-8");
  await new Promise((r) => setTimeout(r, 1100)); // ensure mtime advances (NTFS granularity)
  fs.writeFileSync(fullPath, raw.replace("verification placeholder", "EDITED verification result"), "utf-8");
  const afterEdit = await searchObsidianMemory("phase 11 verification");
  if (!afterEdit[0].content.includes("EDITED")) throw new Error("Freshness detection failed: edit not picked up");
  console.log("5. Freshness: edited canonical note reflected in retrieval:", afterEdit[0].content);

  // 6. Deletion drops the note from retrieval
  const deleted = await deleteObsidianMemory(entry.id);
  if (!deleted) throw new Error("Delete returned false");
  const afterDelete = await searchObsidianMemory("phase 11 verification");
  if (afterDelete.length !== 0) throw new Error("Deleted note still appears in retrieval");
  console.log("6. Deletion: note removed from retrieval results");

  console.log("\n=== PHASE 11 LIVE VERIFICATION PASSED ===");
}

main().catch((err) => {
  console.error("Live verification FAILED:", err);
  process.exit(1);
});
