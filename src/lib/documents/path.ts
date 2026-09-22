import path from "node:path";
import { realpath } from "node:fs/promises";
import { getAllowedRoots } from "./config";
import type { AllowedRoot } from "@/lib/contracts/document";

export class DocumentPathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DocumentPathError";
  }
}

export interface ResolvedDocumentPath {
  absolutePath: string;
  rootId: string;
  rootPath: string;
  relativePath: string;
  root: AllowedRoot;
}

/**
 * Checks if candidatePath is strictly contained inside rootPath.
 */
function isContained(rootPath: string, candidatePath: string): boolean {
  const canonicalRoot = path.resolve(rootPath);
  const canonicalCandidate = path.resolve(candidatePath);

  const rel = path.relative(canonicalRoot, canonicalCandidate);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    return false;
  }

  // Windows case-insensitive prefix containment
  const isWindows = process.platform === "win32";
  const rootPrefix = canonicalRoot.endsWith(path.sep) ? canonicalRoot : canonicalRoot + path.sep;
  const candForCheck = canonicalCandidate.endsWith(path.sep) ? canonicalCandidate : canonicalCandidate + path.sep;

  const compareRoot = isWindows ? rootPrefix.toLowerCase() : rootPrefix;
  const compareCand = isWindows ? candForCheck.toLowerCase() : candForCheck;

  // Exact match or subpath
  return compareCand.startsWith(compareRoot) || compareCand === compareRoot;
}

/**
 * Resolves and strictly validates that a user/model supplied path resides inside
 * an explicit allowed root directory.
 * Fails closed on any path traversal ('..'), null bytes, or directory escapes.
 */
export async function resolveAllowedPath(
  userPath: string,
  preferredRootId?: string
): Promise<ResolvedDocumentPath> {
  if (!userPath || typeof userPath !== "string" || !userPath.trim()) {
    throw new DocumentPathError("Document path cannot be empty.");
  }

  // Reject null bytes
  if (userPath.includes("\0")) {
    throw new DocumentPathError("Path contains illegal characters.");
  }

  const trimmed = userPath.trim();

  // Reject explicit traversal components ('..')
  const segments = trimmed.split(/[/\\]+/);
  if (segments.some((seg) => seg === "..")) {
    throw new DocumentPathError("Path traversal ('..') is not allowed.");
  }

  const allowedRoots = getAllowedRoots();
  if (allowedRoots.length === 0) {
    throw new DocumentPathError("No allowed document roots are configured.");
  }

  let selectedRoot: AllowedRoot | undefined;
  let subPath = trimmed;

  // Case A: User supplied path starts with root ID prefix, e.g. "vault/report.md" or "documents/test.txt"
  const firstSlashIdx = trimmed.indexOf("/");
  const firstBackslashIdx = trimmed.indexOf("\\");
  let prefixEndIdx = -1;
  if (firstSlashIdx !== -1 && firstBackslashIdx !== -1) {
    prefixEndIdx = Math.min(firstSlashIdx, firstBackslashIdx);
  } else {
    prefixEndIdx = Math.max(firstSlashIdx, firstBackslashIdx);
  }

  if (prefixEndIdx > 0) {
    const candidatePrefix = trimmed.slice(0, prefixEndIdx).toLowerCase();
    const matchingRoot = allowedRoots.find(
      (r) => r.id.toLowerCase() === candidatePrefix || r.name.toLowerCase() === candidatePrefix
    );
    if (matchingRoot) {
      selectedRoot = matchingRoot;
      subPath = trimmed.slice(prefixEndIdx + 1).trim();
    }
  }

  // Case B: User specified preferredRootId
  if (!selectedRoot && preferredRootId) {
    selectedRoot = allowedRoots.find(
      (r) => r.id.toLowerCase() === preferredRootId.toLowerCase()
    );
    if (!selectedRoot) {
      throw new DocumentPathError(`Specified root "${preferredRootId}" is not in the allowed roots list.`);
    }
  }

  // Case C: Absolute path provided (Windows drive or POSIX root)
  const isAbsolute =
    path.isAbsolute(trimmed) ||
    /^[a-zA-Z]:[/\\]/.test(trimmed) ||
    trimmed.startsWith("/") ||
    trimmed.startsWith("\\");

  if (isAbsolute) {
    const resolvedAbsolute = path.resolve(trimmed);
    const matchingRoot = allowedRoots.find((r) => isContained(r.path, resolvedAbsolute));

    if (!matchingRoot) {
      throw new DocumentPathError("Absolute path is outside all allowed document roots.");
    }

    selectedRoot = matchingRoot;
    subPath = path.relative(matchingRoot.path, resolvedAbsolute);
  }

  // Fall back to first allowed root if still not selected
  if (!selectedRoot) {
    selectedRoot = allowedRoots[0];
  }

  // Compute final resolved target
  const canonicalRoot = path.resolve(selectedRoot.path);
  const resolvedTarget = path.resolve(canonicalRoot, subPath);

  // Containment check
  if (!isContained(canonicalRoot, resolvedTarget)) {
    throw new DocumentPathError(`Path escapes allowed root "${selectedRoot.name}".`);
  }

  // Realpath symlink check (if the target or an ancestor exists)
  try {
    let checkPath = resolvedTarget;
    let realPathTarget: string | null = null;
    while (checkPath !== path.dirname(checkPath)) {
      try {
        realPathTarget = await realpath(checkPath);
        break;
      } catch {
        checkPath = path.dirname(checkPath);
      }
    }

    if (realPathTarget && !isContained(canonicalRoot, realPathTarget)) {
      // Check if it's contained in ANY allowed root
      const inAnyRoot = allowedRoots.some((r) => isContained(r.path, realPathTarget!));
      if (!inAnyRoot) {
        throw new DocumentPathError(`Path resolves through symlink outside allowed document roots.`);
      }
    }
  } catch {
    // Non-existent paths proceed to write/stat checks
  }

  const relativeNormalized = path
    .relative(canonicalRoot, resolvedTarget)
    .replace(/\\/g, "/");

  return {
    absolutePath: resolvedTarget,
    rootId: selectedRoot.id,
    rootPath: canonicalRoot,
    relativePath: relativeNormalized || ".",
    root: selectedRoot,
  };
}
