import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { checkObsidianStatus, getObsidianVaultPath } from "@/lib/obsidian/config";

describe("Obsidian Configuration & Health Checks", () => {
  let tempDir: string;
  const originalEnv = process.env.OBSIDIAN_VAULT_PATH;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "obsidian-config-test-"));
  });

  afterEach(async () => {
    process.env.OBSIDIAN_VAULT_PATH = originalEnv;
    await rm(tempDir, { recursive: true, force: true });
  });

  it("returns 'Not configured' when OBSIDIAN_VAULT_PATH is not set or empty", async () => {
    delete process.env.OBSIDIAN_VAULT_PATH;
    const res1 = await checkObsidianStatus();
    expect(res1).toEqual({ status: "Not configured", configured: false });

    process.env.OBSIDIAN_VAULT_PATH = "   ";
    const res2 = await checkObsidianStatus();
    expect(res2).toEqual({ status: "Not configured", configured: false });

    expect(getObsidianVaultPath()).toBeNull();
  });

  it("returns 'Available' for a valid existing directory", async () => {
    process.env.OBSIDIAN_VAULT_PATH = tempDir;
    const res = await checkObsidianStatus();
    expect(res).toEqual({ status: "Available", configured: true });
    expect(getObsidianVaultPath()).toBe(tempDir);
  });

  it("returns 'Unavailable' when the path does not exist", async () => {
    const nonExistent = path.join(tempDir, "does-not-exist-vault");
    process.env.OBSIDIAN_VAULT_PATH = nonExistent;
    const res = await checkObsidianStatus();
    expect(res).toEqual({ status: "Unavailable", configured: true });
  });

  it("returns 'Invalid' when the path points to a file instead of a directory", async () => {
    const filePath = path.join(tempDir, "note.txt");
    await writeFile(filePath, "test");
    process.env.OBSIDIAN_VAULT_PATH = filePath;
    const res = await checkObsidianStatus();
    expect(res).toEqual({ status: "Invalid", configured: true });
  });
});
