import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  storeObsidianMemory,
  listObsidianMemory,
  searchObsidianMemory,
  deleteObsidianMemory,
  formatObsidianMemoryContext,
} from "@/lib/obsidian/memory";

describe("Obsidian Canonical Memory Store (AI/Memory/)", () => {
  let vaultDir: string;

  beforeEach(async () => {
    vaultDir = await mkdtemp(path.join(tmpdir(), "obsidian-memory-test-"));
  });

  afterEach(async () => {
    await rm(vaultDir, { recursive: true, force: true });
  });

  it("stores and lists memories in AI/Memory/", async () => {
    const entry = await storeObsidianMemory(
      {
        title: "User Preferences",
        content: "User prefers concise answers and TypeScript code.",
        category: "preferences",
        tags: ["coding", "style"],
      },
      vaultDir
    );

    expect(entry.id).toMatch(/^mem-/);
    expect(entry.relativePath).toMatch(/^AI\/Memory\//);
    expect(entry.title).toBe("User Preferences");
    expect(entry.category).toBe("preferences");

    const memories = await listObsidianMemory(undefined, vaultDir);
    expect(memories.length).toBe(1);
    expect(memories[0].id).toBe(entry.id);
    expect(memories[0].content).toContain("concise answers");
    expect(memories[0].tags).toContain("preferences");
  });

  it("rejects storing content containing secrets or sensitive keys", async () => {
    await expect(
      storeObsidianMemory(
        {
          title: "API Keys",
          content: "Here is my secret: ghp_1234567890abcdefghijklmnopqrstuvwxyz",
        },
        vaultDir
      )
    ).rejects.toThrow(/sensitive information/);

    const memories = await listObsidianMemory(undefined, vaultDir);
    expect(memories.length).toBe(0);
  });

  it("searches memories by keywords in title, tags, and content", async () => {
    await storeObsidianMemory(
      {
        title: "Project Alpha",
        content: "Alpha is scheduled for release in Q4 with high performance.",
        category: "projects",
        tags: ["alpha", "roadmap"],
      },
      vaultDir
    );

    await storeObsidianMemory(
      {
        title: "Project Beta",
        content: "Beta focuses on documentation and developer tooling.",
        category: "projects",
        tags: ["beta", "docs"],
      },
      vaultDir
    );

    const alphaMatches = await searchObsidianMemory("alpha performance", undefined, vaultDir);
    expect(alphaMatches.length).toBe(1);
    expect(alphaMatches[0].title).toBe("Project Alpha");

    const betaMatches = await searchObsidianMemory("tooling", undefined, vaultDir);
    expect(betaMatches.length).toBe(1);
    expect(betaMatches[0].title).toBe("Project Beta");
  });

  it("deletes a memory by ID", async () => {
    const entry = await storeObsidianMemory(
      {
        title: "Temporary Note",
        content: "This memory should be deleted soon.",
      },
      vaultDir
    );

    let memories = await listObsidianMemory(undefined, vaultDir);
    expect(memories.length).toBe(1);

    const deleted = await deleteObsidianMemory(entry.id, vaultDir);
    expect(deleted).toBe(true);

    memories = await listObsidianMemory(undefined, vaultDir);
    expect(memories.length).toBe(0);
  });

  it("formats memory entries into bounded context for agent prompts", async () => {
    const entry1 = await storeObsidianMemory(
      {
        title: "Rule 1",
        content: "Always check types before committing.",
        category: "guidelines",
      },
      vaultDir
    );

    const context = formatObsidianMemoryContext([entry1]);
    expect(context).not.toBeNull();
    expect(context).toContain("--- RETRIEVED OBSIDIAN MEMORIES");
    expect(context).toContain("[guidelines] Rule 1: Always check types before committing.");
    expect(context).toContain("--- END MEMORIES ---");

    const emptyContext = formatObsidianMemoryContext([]);
    expect(emptyContext).toBeNull();
  });
});
