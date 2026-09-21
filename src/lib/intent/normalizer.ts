export interface NormalizedInput {
  readonly raw: string;
  readonly normalized: string;
  readonly cleanNormalized: string;
  readonly tokens: readonly string[];
}

const COMMON_FILLERS = [
  "hey jarvis",
  "ok jarvis",
  "okay jarvis",
  "jarvis",
  "hey antigravity",
  "antigravity",
  "could you please",
  "can you please",
  "would you please",
  "please",
  "can you",
  "could you",
  "would you",
  "kindly",
  "do me a favor and",
  "will you",
];

/**
 * Normalizes input text for intent and alias matching.
 * - Converts to lower case
 * - Normalizes contractions (don't -> dont, what's -> whats)
 * - Strips punctuation
 * - Collapses whitespace
 * - Provides cleanNormalized with polite fillers removed
 */
export function normalizeInput(text: string): NormalizedInput {
  const raw = text || "";
  if (!raw.trim()) {
    return {
      raw,
      normalized: "",
      cleanNormalized: "",
      tokens: [],
    };
  }

  // 1. Lowercase
  let str = raw.toLowerCase().trim();

  // 2. Normalize smart quotes and apostrophes
  str = str.replace(/[’‘]/g, "'").replace(/[“”]/g, '"');

  // 3. Normalize common contractions to unpunctuated form
  str = str
    .replace(/\bwhat's\b/g, "whats")
    .replace(/\bdon't\b/g, "dont")
    .replace(/\bit's\b/g, "its")
    .replace(/\bi'm\b/g, "im")
    .replace(/\blet's\b/g, "lets")
    .replace(/\bwon't\b/g, "wont")
    .replace(/\bcan't\b/g, "cant");

  // 4. Strip punctuation, replacing with spaces
  str = str.replace(/[^a-z0-9\s]/g, " ");

  // 5. Collapse multiple spaces
  const normalized = str.replace(/\s+/g, " ").trim();

  // 6. Generate cleanNormalized by stripping leading/trailing fillers
  let clean = normalized;
  for (const filler of COMMON_FILLERS) {
    const fillerPattern = new RegExp(`^${filler}\\s+`, "i");
    if (fillerPattern.test(clean)) {
      clean = clean.replace(fillerPattern, "").trim();
    }
  }

  // Also strip trailing please or jarvis
  clean = clean.replace(/\s+(?:please|jarvis)$/i, "").trim();

  // Fallback to normalized if stripping left it empty
  if (!clean) {
    clean = normalized;
  }

  const tokens = clean ? clean.split(" ") : [];

  return {
    raw,
    normalized,
    cleanNormalized: clean,
    tokens,
  };
}
