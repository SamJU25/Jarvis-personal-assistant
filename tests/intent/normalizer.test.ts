import { describe, it, expect } from "vitest";
import { normalizeInput } from "@/lib/intent/normalizer";

describe("Phase 07: Intent Normalizer", () => {
  it("normalizes case and collapses whitespace", () => {
    const res = normalizeInput("  WHAT   TIME   IS IT?  ");
    expect(res.normalized).toBe("what time is it");
    expect(res.cleanNormalized).toBe("what time is it");
    expect(res.tokens).toEqual(["what", "time", "is", "it"]);
  });

  it("handles contractions cleanly without punctuation", () => {
    const res = normalizeInput("Don't forget this, what's up?");
    expect(res.normalized).toBe("dont forget this whats up");
    expect(res.cleanNormalized).toBe("dont forget this whats up");
    expect(res.tokens).toEqual(["dont", "forget", "this", "whats", "up"]);
  });

  it("strips common polite filler phrases while keeping command", () => {
    const res = normalizeInput("Hey Jarvis, could you please what time is it?");
    expect(res.cleanNormalized).toBe("what time is it");
    expect(res.tokens).toEqual(["what", "time", "is", "it"]);
  });

  it("strips trailing polite words like please and jarvis", () => {
    const res = normalizeInput("Stop execution please");
    expect(res.cleanNormalized).toBe("stop execution");
    expect(res.tokens).toEqual(["stop", "execution"]);
  });

  it("handles empty or whitespace-only input safely", () => {
    const res = normalizeInput("   \t  \n  ");
    expect(res.normalized).toBe("");
    expect(res.cleanNormalized).toBe("");
    expect(res.tokens).toEqual([]);
  });

  it("retains core words if entire message consists of a filler word", () => {
    const res = normalizeInput("please");
    expect(res.cleanNormalized).toBe("please");
    expect(res.tokens).toEqual(["please"]);
  });
});
