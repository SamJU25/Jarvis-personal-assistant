import { skillVersionSchema, type SkillDiff } from "@/lib/contracts/learning";

/**
 * Phase 12 — deterministic, bounded, dependency-free diff for skill proposals.
 * Produces a human-readable preview; it never executes or renders untrusted
 * markup. Bounds protect the UI and provider context from oversized payloads.
 */

const MAX_RENDERED_LINES = 120;
const MAX_RENDERED_CHARS = 4000;
const MAX_LISTED_LINES = 500;

export interface LineDiffResult {
  added: string[];
  removed: string[];
  truncated: boolean;
}

/**
 * Line-based LCS diff. Additions and removals are reported in document order.
 */
export function diffLines(base: string, next: string): LineDiffResult {
  const a = base.split(/\r?\n/);
  const b = next.split(/\r?\n/);
  const n = a.length;
  const m = b.length;

  // LCS table (bounded: guard against pathological inputs)
  const maxCells = 4_000_000;
  if (n * m > maxCells) {
    return { added: [], removed: [], truncated: true };
  }

  const dp: Uint32Array[] = [];
  for (let i = 0; i <= n; i++) dp.push(new Uint32Array(m + 1));

  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] =
        a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const added: string[] = [];
  const removed: string[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      removed.push(a[i]);
      i++;
    } else {
      added.push(b[j]);
      j++;
    }
  }
  while (i < n) removed.push(a[i++]);
  while (j < m) added.push(b[j++]);

  const truncated = added.length > MAX_LISTED_LINES || removed.length > MAX_LISTED_LINES;
  return {
    added: added.slice(0, MAX_LISTED_LINES),
    removed: removed.slice(0, MAX_LISTED_LINES),
    truncated,
  };
}

/**
 * Builds the human-readable diff preview shown at confirmation time.
 * Rendering is bounded by both line count and character count.
 */
export function buildSkillDiff(base: string, next: string): SkillDiff {
  const { added, removed, truncated: listTruncated } = diffLines(base, next);

  const lines: string[] = [];
  for (const line of removed) lines.push(`- ${line}`);
  for (const line of added) lines.push(`+ ${line}`);

  let truncated = listTruncated;
  let rendered = lines.join("\n");
  if (lines.length > MAX_RENDERED_LINES) {
    truncated = true;
    rendered = lines.slice(0, MAX_RENDERED_LINES).join("\n") + "\n… (diff truncated)";
  }
  if (rendered.length > MAX_RENDERED_CHARS) {
    truncated = true;
    rendered = rendered.slice(0, MAX_RENDERED_CHARS) + "\n… (diff truncated)";
  }

  return {
    added,
    removed,
    rendered: rendered || "(no line changes)",
    addedCount: added.length,
    removedCount: removed.length,
    truncated,
  };
}

/**
 * Computes the next patch version from a semantic version string.
 * Invalid input falls back to 1.0.0 (never throws).
 */
export function bumpVersion(version: string): string {
  const parsed = skillVersionSchema.safeParse(version);
  if (!parsed.success) return "1.0.0";
  const [major, minor, patch] = parsed.data.split(".").map((p) => Number(p));
  return `${major}.${minor}.${patch + 1}`;
}
