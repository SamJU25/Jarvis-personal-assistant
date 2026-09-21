import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { searchVault, readVaultNote, createVaultNote } from "@/lib/obsidian/vault";
import { ObsidianPathError } from "@/lib/obsidian/path";

describe("Obsidian Vault Operations (search, read, create)", () => {
  let vaultDir: string;

  beforeEach(async () => {
    vaultDir = await mkdtemp(path.join(tmpdir(), "vault-ops-test-"));

    // Populate test files
    await mkdir(path.join(vaultDir, "Projects"), { recursive: true });
    await mkdir(path.join(vaultDir, ".obsidian"), { recursive: true });

    // Note 1: DeepSeek architecture
    await writeFile(
      path.join(vaultDir, "Projects", "DeepSeek.md"),
      `---
title: DeepSeek Architecture Research
tags: [ai, deepseek, llm]
---
# DeepSeek Architecture
DeepSeek uses Multi-Head Latent Attention (MLA) and Mixture of Experts (MoE).
It achieves high inference throughput while minimizing KV cache memory footprint.
`
    );

    // Note 2: Agentic harnesses
    await writeFile(
      path.join(vaultDir, "Projects", "Agentic-Harness.md"),
      `# Agentic Coding Harnesses
A study on how to build reliable coding agents.
Tags: #agent #coding #harness
Key finding: Keep execution bounded and strictly verify output before making claims.
`
    );

    // Note in hidden .obsidian folder (must be ignored)
    await writeFile(
      path.join(vaultDir, ".obsidian", "app.json"),
      `{"theme": "dark"}`
    );
  });

  afterEach(async () => {
    await rm(vaultDir, { recursive: true, force: true });
  });

  describe("searchVault", () => {
    it("finds notes by matching content keyword", async () => {
      const res = await searchVault(vaultDir, "Latent Attention");
      expect(res.total).toBe(1);
      expect(res.results[0].title).toBe("DeepSeek Architecture Research");
      expect(res.results[0].path).toBe("Projects/DeepSeek.md");
      expect(res.results[0].excerpt).toContain("Latent Attention");
    });

    it("finds notes by matching filename or tag", async () => {
      const res = await searchVault(vaultDir, "harness");
      expect(res.total).toBe(1);
      expect(res.results[0].title).toBe("Agentic Coding Harnesses");
      expect(res.results[0].path).toBe("Projects/Agentic-Harness.md");
    });

    it("ignores non-markdown or hidden .obsidian files", async () => {
      const res = await searchVault(vaultDir, "dark");
      expect(res.total).toBe(0);
    });

    it("respects result limit parameter", async () => {
      const res = await searchVault(vaultDir, "a", 1);
      expect(res.results.length).toBe(1);
    });

    it("returns empty results for non-matching query", async () => {
      const res = await searchVault(vaultDir, "quantum_flux_nonexistent");
      expect(res.total).toBe(0);
      expect(res.results).toEqual([]);
    });
  });

  describe("readVaultNote", () => {
    it("reads full content and metadata of a valid note", async () => {
      const note = await readVaultNote(vaultDir, "Projects/DeepSeek.md");
      expect(note.title).toBe("DeepSeek Architecture Research");
      expect(note.path).toBe("Projects/DeepSeek.md");
      expect(note.content).toContain("Multi-Head Latent Attention");
      expect(note.tags).toContain("deepseek");
      expect(note.modifiedAt).toBeDefined();
    });

    it("throws when note does not exist", async () => {
      await expect(readVaultNote(vaultDir, "Projects/Missing.md")).rejects.toThrow(
        'Note not found: "Projects/Missing.md"'
      );
    });

    it("rejects non-markdown files", async () => {
      await expect(readVaultNote(vaultDir, "Projects/image.png")).rejects.toThrow(
        "Only Markdown (.md) notes can be read"
      );
    });

    it("rejects path traversal attempts in readVaultNote", async () => {
      await expect(readVaultNote(vaultDir, "../outside.md")).rejects.toThrow(ObsidianPathError);
    });
  });

  describe("createVaultNote", () => {
    it("creates note in default folder Inbox/JARVIS without overwriting", async () => {
      const note = await createVaultNote(vaultDir, "Quick Idea", "Content of the quick idea");
      expect(note.title).toBe("Quick Idea");
      expect(note.path).toBe("Inbox/JARVIS/Quick Idea.md");
      expect(note.createdAt).toBeDefined();

      // Read back
      const readBack = await readVaultNote(vaultDir, note.path);
      expect(readBack.content).toBe("Content of the quick idea");
    });

    it("creates unique filenames on collision to prevent overwriting", async () => {
      const note1 = await createVaultNote(vaultDir, "Collision Note", "First version");
      const note2 = await createVaultNote(vaultDir, "Collision Note", "Second version");

      expect(note1.path).toBe("Inbox/JARVIS/Collision Note.md");
      expect(note2.path).toBe("Inbox/JARVIS/Collision Note_1.md");

      const read1 = await readVaultNote(vaultDir, note1.path);
      const read2 = await readVaultNote(vaultDir, note2.path);

      expect(read1.content).toBe("First version");
      expect(read2.content).toBe("Second version");
    });

    it("rejects folder paths that attempt traversal", async () => {
      await expect(
        createVaultNote(vaultDir, "Escape", "Content", "../../Outside")
      ).rejects.toThrow(ObsidianPathError);
    });
  });
});
