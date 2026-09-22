import path from "node:path";
import fs from "node:fs";
import type { AllowedRoot } from "@/lib/contracts/document";
import { getObsidianVaultPath } from "@/lib/obsidian/config";

export const MAX_DOCUMENT_READ_BYTES = 500_000; // 500 KB
export const MAX_DOCUMENT_CONTENT_CHARS = 50_000; // 50,000 characters context bound
export const MAX_DOCUMENT_WRITE_BYTES = 1_000_000; // 1 MB
export const MAX_DOCUMENT_LIST_ENTRIES = 100;

let allowedRootsOverride: AllowedRoot[] | null = null;

/**
 * For testing purposes: set an explicit allowed roots list override.
 */
export function setAllowedRootsOverride(roots: AllowedRoot[] | null): void {
  allowedRootsOverride = roots;
}

/**
 * Returns the default dedicated documents directory (<workspace>/documents).
 */
export function getDefaultDocumentsPath(): string {
  const envPath = process.env.JARVIS_DOCUMENTS_PATH?.trim();
  if (envPath) {
    return path.resolve(envPath);
  }
  return path.resolve(process.cwd(), "documents");
}

/**
 * Returns all configured allowed root directories for governed document access.
 * Re-reads environment variables on each call so runtime changes are reflected.
 */
export function getAllowedRoots(): AllowedRoot[] {
  if (allowedRootsOverride) {
    return allowedRootsOverride;
  }

  const roots: AllowedRoot[] = [];

  // 1. Primary Documents Directory (default or configured via JARVIS_DOCUMENTS_PATH)
  const defaultDocsPath = getDefaultDocumentsPath();
  roots.push({
    id: "documents",
    name: "Documents",
    path: defaultDocsPath,
    readOnly: false,
  });

  // 2. Configured Obsidian Vault (if configured)
  const vaultPath = getObsidianVaultPath();
  if (vaultPath) {
    roots.push({
      id: "vault",
      name: "Obsidian Vault",
      path: path.resolve(vaultPath),
      readOnly: false,
    });
  }

  // 3. Optional additional allowed roots via JARVIS_ALLOWED_FILE_ROOTS (delimited by comma or semicolon)
  const additionalRoots = process.env.JARVIS_ALLOWED_FILE_ROOTS?.trim();
  if (additionalRoots) {
    const paths = additionalRoots
      .split(/[,;]/)
      .map((p) => p.trim())
      .filter(Boolean);

    paths.forEach((rootPath, index) => {
      const resolved = path.resolve(rootPath);
      // Avoid duplicate registrations
      if (!roots.some((r) => r.path.toLowerCase() === resolved.toLowerCase())) {
        roots.push({
          id: `root-${index + 1}`,
          name: path.basename(resolved) || `Root ${index + 1}`,
          path: resolved,
          readOnly: false,
        });
      }
    });
  }

  return roots;
}

/**
 * Ensures the primary documents directory exists on disk.
 */
export async function ensureDefaultDocumentsDir(): Promise<string> {
  const defaultPath = getDefaultDocumentsPath();
  await fs.promises.mkdir(defaultPath, { recursive: true });
  return defaultPath;
}
