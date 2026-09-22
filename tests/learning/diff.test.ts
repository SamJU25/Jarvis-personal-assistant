import { describe, expect, it } from "vitest";
import { buildSkillDiff, bumpVersion, diffLines } from "@/lib/learning/diff";

describe("Phase 12: skill diff engine", () => {
  it("reports added and removed lines in document order", () => {
    const base = "line1\nline2\nline3";
    const next = "line1\nline3\nline4";
    const { added, removed } = diffLines(base, next);
    expect(removed).toEqual(["line2"]);
    expect(added).toEqual(["line4"]);
  });

  it("renders a human-readable diff with +/- markers", () => {
    const diff = buildSkillDiff("a\nb", "a\nc");
    expect(diff.rendered).toContain("- b");
    expect(diff.rendered).toContain("+ c");
    expect(diff.removedCount).toBe(1);
    expect(diff.addedCount).toBe(1);
    expect(diff.truncated).toBe(false);
  });

  it("reports no changes for identical content", () => {
    const diff = buildSkillDiff("same\ncontent", "same\ncontent");
    expect(diff.addedCount).toBe(0);
    expect(diff.removedCount).toBe(0);
    expect(diff.rendered).toBe("(no line changes)");
  });

  it("bounds a rendered diff that would otherwise be huge", () => {
    const base = Array.from({ length: 400 }, (_, i) => `old line ${i}`).join("\n");
    const next = Array.from({ length: 400 }, (_, i) => `new line ${i}`).join("\n");
    const diff = buildSkillDiff(base, next);
    expect(diff.rendered.length).toBeLessThanOrEqual(4100);
    expect(diff.truncated).toBe(true);
  });

  it("handles CRLF input", () => {
    const { removed, added } = diffLines("a\r\nb\r\nc", "a\r\nc");
    expect(removed).toEqual(["b"]);
    expect(added).toEqual([]);
  });

  it("bumps patch versions and falls back safely on invalid input", () => {
    expect(bumpVersion("1.0.0")).toBe("1.0.1");
    expect(bumpVersion("2.7.9")).toBe("2.7.10");
    expect(bumpVersion("not-a-version")).toBe("1.0.0");
  });
});
