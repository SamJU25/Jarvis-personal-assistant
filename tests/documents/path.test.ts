import { describe, expect, it, beforeEach, afterEach } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { resolveAllowedPath, DocumentPathError } from "@/lib/documents/path";
import { setAllowedRootsOverride } from "@/lib/documents/config";

describe("Document Intelligence — Path Containment & Normalization", () => {
  let tempDir: string;
  let rootA: string;
  let rootB: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "jarvis-doc-path-test-"));
    rootA = path.join(tempDir, "docs");
    rootB = path.join(tempDir, "vault");
    await fs.mkdir(rootA, { recursive: true });
    await fs.mkdir(rootB, { recursive: true });

    setAllowedRootsOverride([
      { id: "documents", name: "Documents", path: rootA, readOnly: false },
      { id: "vault", name: "Obsidian Vault", path: rootB, readOnly: false },
    ]);
  });

  afterEach(async () => {
    setAllowedRootsOverride(null);
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("resolves relative paths to the default root", async () => {
    const resolved = await resolveAllowedPath("subfolder/report.md");
    expect(resolved.rootId).toBe("documents");
    expect(resolved.relativePath).toBe("subfolder/report.md");
    expect(resolved.absolutePath).toBe(path.resolve(rootA, "subfolder", "report.md"));
  });

  it("resolves paths prefixed with rootId", async () => {
    const resolved = await resolveAllowedPath("vault/notes/idea.md");
    expect(resolved.rootId).toBe("vault");
    expect(resolved.relativePath).toBe("notes/idea.md");
    expect(resolved.absolutePath).toBe(path.resolve(rootB, "notes", "idea.md"));
  });

  it("resolves preferredRootId when specified", async () => {
    const resolved = await resolveAllowedPath("notes/idea.md", "vault");
    expect(resolved.rootId).toBe("vault");
    expect(resolved.relativePath).toBe("notes/idea.md");
    expect(resolved.absolutePath).toBe(path.resolve(rootB, "notes", "idea.md"));
  });

  it("resolves valid absolute paths inside an allowed root", async () => {
    const absoluteFile = path.join(rootA, "test.txt");
    const resolved = await resolveAllowedPath(absoluteFile);
    expect(resolved.rootId).toBe("documents");
    expect(resolved.relativePath).toBe("test.txt");
    expect(resolved.absolutePath).toBe(path.resolve(absoluteFile));
  });

  it("rejects empty paths", async () => {
    await expect(resolveAllowedPath("")).rejects.toThrow(DocumentPathError);
    await expect(resolveAllowedPath("   ")).rejects.toThrow(DocumentPathError);
  });

  it("rejects null bytes", async () => {
    await expect(resolveAllowedPath("safe/path\0evil")).rejects.toThrow(DocumentPathError);
  });

  it("rejects path traversal ('..')", async () => {
    await expect(resolveAllowedPath("../outside.txt")).rejects.toThrow(DocumentPathError);
    await expect(resolveAllowedPath("folder/../../escape.txt")).rejects.toThrow(DocumentPathError);
  });

  it("rejects absolute paths outside allowed roots", async () => {
    const outside = path.resolve(tempDir, "unauthorized.txt");
    await expect(resolveAllowedPath(outside)).rejects.toThrow(DocumentPathError);
  });

  it("rejects unknown preferredRootId", async () => {
    await expect(resolveAllowedPath("file.txt", "nonexistent_root")).rejects.toThrow(
      DocumentPathError
    );
  });
});
