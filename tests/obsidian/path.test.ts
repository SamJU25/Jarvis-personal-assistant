import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { resolveVaultPath, toVaultRelativePath, ObsidianPathError } from "@/lib/obsidian/path";

describe("Obsidian Path Containment & Security", () => {
  let vaultDir: string;

  beforeEach(async () => {
    vaultDir = await mkdtemp(path.join(tmpdir(), "vault-path-test-"));
  });

  afterEach(async () => {
    await rm(vaultDir, { recursive: true, force: true });
  });

  it("resolves valid relative paths inside the vault", async () => {
    const resolved = await resolveVaultPath(vaultDir, "Notes/Ideas.md");
    expect(resolved).toBe(path.resolve(vaultDir, "Notes", "Ideas.md"));
    expect(toVaultRelativePath(vaultDir, resolved)).toBe("Notes/Ideas.md");
  });

  it("resolves nested relative paths with forward or backward slashes", async () => {
    const resolved = await resolveVaultPath(vaultDir, "Work/2026/Meeting.md");
    expect(toVaultRelativePath(vaultDir, resolved)).toBe("Work/2026/Meeting.md");
  });

  it("rejects path traversal attempts with '../'", async () => {
    await expect(resolveVaultPath(vaultDir, "../secret.txt")).rejects.toThrow(ObsidianPathError);
    await expect(resolveVaultPath(vaultDir, "Folder/../../secret.txt")).rejects.toThrow(ObsidianPathError);
    await expect(resolveVaultPath(vaultDir, "..\\secret.txt")).rejects.toThrow(ObsidianPathError);
    await expect(resolveVaultPath(vaultDir, "Folder/..")).rejects.toThrow(ObsidianPathError);
  });

  it("rejects absolute paths across operating systems", async () => {
    // Windows drive root
    await expect(resolveVaultPath(vaultDir, "C:\\Windows\\System32\\cmd.exe")).rejects.toThrow(ObsidianPathError);
    await expect(resolveVaultPath(vaultDir, "D:/secrets.txt")).rejects.toThrow(ObsidianPathError);

    // Unix root
    await expect(resolveVaultPath(vaultDir, "/etc/passwd")).rejects.toThrow(ObsidianPathError);

    // UNC root
    await expect(resolveVaultPath(vaultDir, "\\\\server\\share\\file.txt")).rejects.toThrow(ObsidianPathError);
  });

  it("rejects paths with null bytes", async () => {
    await expect(resolveVaultPath(vaultDir, "note.md\0extra")).rejects.toThrow("illegal characters");
  });

  it("rejects empty or whitespace-only paths", async () => {
    await expect(resolveVaultPath(vaultDir, "")).rejects.toThrow("cannot be empty");
    await expect(resolveVaultPath(vaultDir, "   ")).rejects.toThrow("cannot be empty");
  });

  it("never exposes the absolute vault root in toVaultRelativePath", () => {
    const full = path.join(vaultDir, "Secret", "Note.md");
    const rel = toVaultRelativePath(vaultDir, full);
    expect(rel).toBe("Secret/Note.md");
    expect(rel).not.toContain(vaultDir);
  });
});
