import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  storeObsidianMemory,
  searchObsidianMemoryWithTrace,
  searchObsidianMemory,
  invalidateMemoryIndex,
} from "@/lib/obsidian/memory";

/**
 * Phase 11 acceptance: retrieval traces show which notes influenced the
 * answer, with score, matched terms, and match signals. Keyword/exact
 * retrieval stays first; the canonical store stays Obsidian Markdown.
 */
describe("Phase 11: retrieval trace", () => {
  let vaultDir: string;

  beforeEach(async () => {
    vaultDir = await mkdtemp(path.join(tmpdir(), "obsidian-trace-test-"));
  });

  afterEach(async () => {
    invalidateMemoryIndex(vaultDir);
    await rm(vaultDir, { recursive: true, force: true });
  });

  it("returns scores, matched terms, and signals for each influencing note", async () => {
    await storeObsidianMemory(
      { title: "Alpha performance", content: "Notes on alpha speed", category: "project", tags: ["perf"] },
      vaultDir
    );
    await storeObsidianMemory(
      { title: "Beta tooling", content: "Tooling decisions", category: "project" },
      vaultDir
    );

    const { matches, totalIndexed } = await searchObsidianMemoryWithTrace("alpha performance", undefined, vaultDir);

    expect(totalIndexed).toBe(2);
    expect(matches).toHaveLength(1);
    const top = matches[0];
    expect(top.entry.title).toBe("Alpha performance");
    expect(top.score).toBeGreaterThan(0);
    expect(top.matchedTerms).toContain("alpha");
    expect(top.matchedTerms).toContain("performance");
    expect(top.signals).toContain("exact_title");
    // Trace carries source/path metadata
    expect(top.entry.relativePath).toMatch(/^AI\/Memory\//);
  });

  it("ranks exact phrase matches above loose word matches", async () => {
    await storeObsidianMemory(
      { title: "Exact", content: "The alpha performance plan", category: "a" },
      vaultDir
    );
    await storeObsidianMemory(
      { title: "Loose", content: "alpha and performance mentioned separately here", category: "b" },
      vaultDir
    );

    const { matches } = await searchObsidianMemoryWithTrace("alpha performance", undefined, vaultDir);
    expect(matches.length).toBe(2);
    expect(matches[0].entry.title).toBe("Exact");
    expect(matches[0].score).toBeGreaterThan(matches[1].score);
  });

  it("delegating search returns the same ranking as the traced search", async () => {
    await storeObsidianMemory({ title: "One", content: "shared keyword context", category: "c" }, vaultDir);
    await storeObsidianMemory({ title: "Two", content: "shared keyword", category: "c" }, vaultDir);

    const plain = await searchObsidianMemory("shared keyword", undefined, vaultDir);
    const traced = await searchObsidianMemoryWithTrace("shared keyword", undefined, vaultDir);

    expect(plain.map((e) => e.id)).toEqual(traced.matches.map((m) => m.entry.id));
  });

  it("empty queries return recent notes without fabricated signals", async () => {
    await storeObsidianMemory({ title: "Note", content: "anything", category: "c" }, vaultDir);
    const { matches, totalIndexed } = await searchObsidianMemoryWithTrace("", undefined, vaultDir);
    expect(totalIndexed).toBe(1);
    expect(matches).toHaveLength(1);
    expect(matches[0].signals).toHaveLength(0);
    expect(matches[0].matchedTerms).toHaveLength(0);
  });
});
