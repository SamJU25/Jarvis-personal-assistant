import path from "node:path";
import { realpath } from "node:fs/promises";

export class ObsidianPathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ObsidianPathError";
  }
}

/**
 * Resolves and validates that a user/model supplied relative path resides strictly
 * inside the configured Obsidian vault.
 * Fails closed on any traversal, absolute path, null-byte, or symlink escape attempt.
 */
export async function resolveVaultPath(vaultRoot: string, userPath: string): Promise<string> {
  if (!userPath || typeof userPath !== "string" || !userPath.trim()) {
    throw new ObsidianPathError("Vault path cannot be empty.");
  }

  // Reject null bytes
  if (userPath.includes("\0")) {
    throw new ObsidianPathError("Path contains illegal characters.");
  }

  const trimmed = userPath.trim();

  // Reject absolute paths across platforms (Windows drive letters, UNC, Unix roots)
  if (
    path.isAbsolute(trimmed) ||
    /^[a-zA-Z]:[/\\]/.test(trimmed) ||
    trimmed.startsWith("/") ||
    trimmed.startsWith("\\")
  ) {
    throw new ObsidianPathError("Absolute paths are not allowed.");
  }

  // Reject explicit traversal components ('..') before resolution
  const segments = trimmed.split(/[/\\]+/);
  if (segments.some((seg) => seg === "..")) {
    throw new ObsidianPathError("Path traversal ('..') is not allowed.");
  }

  const canonicalVault = path.resolve(vaultRoot);
  const resolvedTarget = path.resolve(canonicalVault, trimmed);

  // Containment check via path.relative
  const rel = path.relative(canonicalVault, resolvedTarget);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new ObsidianPathError("Path escapes the vault directory.");
  }

  // Normalized prefix containment check (case-insensitive on Windows)
  const isWindows = process.platform === "win32";
  const vaultPrefix = canonicalVault.endsWith(path.sep) ? canonicalVault : canonicalVault + path.sep;
  const targetForCheck = resolvedTarget.endsWith(path.sep) ? resolvedTarget : resolvedTarget + path.sep;

  const comparePrefix = isWindows ? vaultPrefix.toLowerCase() : vaultPrefix;
  const compareTarget = isWindows ? targetForCheck.toLowerCase() : targetForCheck;

  if (!compareTarget.startsWith(comparePrefix) && resolvedTarget !== canonicalVault) {
    throw new ObsidianPathError("Path escapes the vault directory.");
  }

  // Symlink escape verification if the target path exists
  try {
    const realTarget = await realpath(resolvedTarget);
    const realVault = await realpath(canonicalVault);
    const realVaultPrefix = realVault.endsWith(path.sep) ? realVault : realVault + path.sep;
    const realCompareVault = isWindows ? realVaultPrefix.toLowerCase() : realVaultPrefix;
    const realCompareTarget = isWindows ? (realTarget + path.sep).toLowerCase() : realTarget + path.sep;

    if (!realCompareTarget.startsWith(realCompareVault) && realTarget !== realVault) {
      throw new ObsidianPathError("Symlink escapes the vault directory.");
    }
  } catch (err: unknown) {
    const code = (err as { code?: string }).code;
    // If the file does not exist yet (e.g. for note creation), that's acceptable,
    // as long as the parent directory (if existing) does not escape via symlink
    if (code !== "ENOENT") {
      throw err;
    }
  }

  return resolvedTarget;
}

/**
 * Converts an absolute filesystem path inside the vault into a safe, normalized,
 * POSIX-style vault-relative path (e.g. "Projects/Ideas.md").
 * Never exposes the absolute vault root.
 */
export function toVaultRelativePath(vaultRoot: string, fullPath: string): string {
  const canonicalVault = path.resolve(vaultRoot);
  const rel = path.relative(canonicalVault, fullPath);
  return rel.split(path.sep).join("/");
}
