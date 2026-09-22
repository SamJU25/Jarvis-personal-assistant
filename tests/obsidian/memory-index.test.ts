import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  storeObsidianMemory,
  searchObsidianMemory,
  invalidateMemoryIndex,
} from "@/lib/obsidian/memory";
import { getIndexedMemoryFiles, MAX_INDEX_FILES } from "@/lib/obsidian/memory-index";

describe("Phase 11: Derived memory retrieval index", () => {
  let vaultDir: string;

  beforeEach(async () => {
    vaultDir = await mkdtemp(path.join(tmpdir(), "obsidian-index-test-"));
  });

  afterEach(async () => {
    invalidateMemoryIndex(vaultDir);
    await rm(vaultDir, { recursive: true, force: true });
  });

  it("caches parsed files and reuses them when nothing changed", async () => {
    await storeObsidianMemory({ title: "Alpha", content: "alpha content about performance", category: "project" }, vaultDir);

    const memDir = path.join(vaultDir, "AI", "Memory");
    const first = await getIndexedMemoryFiles(vaultDir, memDir);
    expect(first.total).toBe(1);
    expect(first.revalidated).toBe(1);

    const second = await getIndexedMemoryFiles(vaultDir, memDir);
    expect(second.total).toBe(1);
    expect(second.revalidated).toBe(0);
    expect(second.reused).toBe(1);
  });

  it("picks up an edited note on the next retrieval (freshness detection)", async () => {
    await storeObsidianMemory({ title: "Project Alpha", content: "original alpha summary", category: "project" }, vaultDir);

    const before = await searchObsidianMemory("alpha", undefined, vaultDir);
    expect(before[0].content).toContain("original");

    // Edit the canonical note directly (simulating an Obsidian edit)
    const memDir = path.join(vaultDir, "AI", "Memory");
    const files = (await import("node:fs/promises")).readdir;
    const name = (await files(memDir))[0];
    await new Promise((r) => setTimeout(r, 25)); // ensure mtime advances
    const raw = await (await import("node:fs/promises")).readFile(path.join(memDir, name), "utf-8");
    await writeFile(path.join(memDir, name), raw.replace("original alpha summary", "revised alpha conclusions"), "utf-8");

    const after = await searchObsidianMemory("alpha", undefined, vaultDir);
    expect(after[0].content).toContain("revised");
  });

  it("drops deleted notes from retrieval results", async () => {
    await storeObsidianMemory({ title: "Temp", content: "temporary note about tooling", category: "tmp" }, vaultDir);
    let results = await searchObsidianMemory("tooling", undefined, vaultDir);
    expect(results).toHaveLength(1);

    const memDir = path.join(vaultDir, "AI", "Memory");
    const name = (await import("node:fs/promises")).readdir;
    const files = await name(memDir);
    await rm(path.join(memDir, files[0]));

    results = await searchObsidianMemory("tooling", undefined, vaultDir);
    expect(results).toHaveLength(0);
  });

  it("explicit invalidation forces a full rebuild", async () => {
    await storeObsidianMemory({ title: "Alpha", content: "content", category: "x" }, vaultDir);
    const memDir = path.join(vaultDir, "AI", "Memory");
    await getIndexedMemoryFiles(vaultDir, memDir);

    invalidateMemoryIndex(vaultDir);
    const rebuilt = await getIndexedMemoryFiles(vaultDir, memDir);
    expect(rebuilt.revalidated).toBe(1);
    expect(rebuilt.reused).toBe(0);
  });

  it("bounds the index scan to MAX_INDEX_FILES", async () => {
    expect(MAX_INDEX_FILES).toBe(500);
    // Write a handful of files directly; the cap guard is the assertion target.
    const memDir = path.join(vaultDir, "AI", "Memory");
    await mkdir(memDir, { recursive: true });
    for (let i = 0; i < 5; i++) {
      await writeFile(path.join(memDir, `m${i}.md`), `---\ntitle: "M${i}"\ncategory: "bulk"\n---\n\nbody ${i}\n`, "utf-8");
    }
    const result = await getIndexedMemoryFiles(vaultDir, memDir);
    expect(result.total).toBe(5);
    expect(result.truncated).toBe(false);
  });

  it("ignores non-markdown files", async () => {
    const memDir = path.join(vaultDir, "AI", "Memory");
    await mkdir(memDir, { recursive: true });
    await writeFile(path.join(memDir, "note.txt"), "not markdown", "utf-8");
    await writeFile(path.join(memDir, "note.md"), `---\ntitle: "N"\n---\n\nbody\n`, "utf-8");

    const result = await getIndexedMemoryFiles(vaultDir, memDir);
    expect(result.total).toBe(1);
  });
});
