import { sourceSchema, type Source } from "@/lib/contracts/result";

/**
 * Phase 10 — Web Research + Provenance.
 *
 * JARVIS governs provenance for web research that Hermes performs natively
 * through its `web` toolset. Web content is strictly untrusted data:
 * every URL, title, and snippet is sanitized, bounded, deduplicated, and
 * stamped with a retrieval timestamp before it reaches a StructuredResult.
 * This module never executes or fetches anything — it only normalizes and
 * guards provenance metadata.
 */

/** Maximum number of provenance sources attached to a single result. */
export const MAX_PROVENANCE_SOURCES = 20;
/** Maximum characters retained for a source title. */
export const MAX_SOURCE_TITLE_LENGTH = 200;
/** Maximum characters retained for a source location. */
export const MAX_SOURCE_LOCATION_LENGTH = 500;
/** Maximum characters retained for a URL. */
export const MAX_URL_LENGTH = 2_000;

/** Hermes tool names that perform web search/retrieval. */
export const WEB_TOOL_PATTERN = /^(web_search|web_extract|web_search_news|web_open)$/i;

/**
 * Strips control characters and ANSI escapes, collapses whitespace, and bounds
 * length. Applied to all externally-originated text (titles, snippets) so
 * untrusted web content can never smuggle instructions or binary junk into
 * the UI or provider context.
 */
export function sanitizeExternalText(raw: unknown, maxLength: number): string {
  if (typeof raw !== "string") return "";
  const cleaned = raw
    // Strip ANSI escape sequences before removing control characters, so the
    // ESC byte does not leave orphaned "[31m"-style fragments behind.
    .replace(/\u001b\[[0-9;]*[A-Za-z]/g, "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length > maxLength ? cleaned.slice(0, maxLength) : cleaned;
}

/**
 * Validates and sanitizes an external URL. Only http(s) schemes are accepted;
 * javascript:, data:, file:, and any other scheme is rejected. Returns null
 * for anything unsafe or malformed.
 */
export function sanitizeExternalUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > MAX_URL_LENGTH) return null;
  if (!/^https?:\/\//i.test(trimmed)) return null;
  if (/[\u0000-\u001f\u007f]/.test(trimmed)) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function makeId(index: number, key: string): string {
  const stable = key
    .replace(/[^a-z0-9]+/gi, "-")
    .slice(0, 40)
    .replace(/^-+|-+$/g, "");
  return `web-${stable || index + 1}-${index + 1}`;
}

/**
 * Normalizes a single raw provenance entry into a validated Source.
 * Returns null when the entry carries no usable provenance.
 */
function normalizeEntry(raw: unknown, index: number, retrievedAt: string): Source | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;

  const rawUrl = obj.url ?? obj.link ?? obj.href;
  const url = sanitizeExternalUrl(rawUrl);
  const title = sanitizeExternalText(obj.title ?? obj.name ?? obj.subject, MAX_SOURCE_TITLE_LENGTH);
  let location = sanitizeExternalText(obj.location ?? obj.source ?? obj.path, MAX_SOURCE_LOCATION_LENGTH);

  // A claimed URL that failed sanitization is treated as hostile evidence:
  // drop the entry entirely rather than citing it without its URL.
  if (rawUrl !== undefined && rawUrl !== null && rawUrl !== "" && !url) return null;

  // Web sources without an explicit location fall back to the URL.
  if (!location && url) location = url;
  // Neither a URL nor any textual anchor: nothing to cite.
  if (!url && !location && !title) return null;

  const parsed = sourceSchema.safeParse({
    id: typeof obj.id === "string" && obj.id.trim() ? obj.id : makeId(index, url ?? title ?? String(index)),
    title: title || (url ? new URL(url).hostname : "Web source"),
    kind: "web",
    location: location || "web",
    ...(url ? { url } : {}),
    retrievedAt,
  });
  return parsed.success ? parsed.data : null;
}

/**
 * Normalizes an unbounded array of raw web evidence entries into a
 * deduplicated, bounded list of validated web Sources.
 * Deduplication key: URL when present, otherwise normalized location/title.
 * Never throws — invalid entries are dropped.
 */
export function normalizeWebSources(
  raw: readonly unknown[],
  options?: { retrievedAt?: string }
): Source[] {
  const retrievedAt = options?.retrievedAt ?? new Date().toISOString();
  const seen = new Set<string>();
  const out: Source[] = [];

  for (const entry of raw) {
    if (out.length >= MAX_PROVENANCE_SOURCES) break;
    const normalized = normalizeEntry(entry, out.length, retrievedAt);
    if (!normalized) continue;

    const key = (
      normalized.url ??
      (normalized.location.toLowerCase() || normalized.title.toLowerCase())
    ).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(normalized);
  }
  return out;
}

/**
 * Merges provenance the model declared in its final structured output with
 * evidence JARVIS captured during the run. Model-declared sources win; captured
 * evidence fills only the gaps. Output is deduplicated and bounded.
 */
export function mergeWebSources(
  declared: readonly Source[],
  captured: readonly Source[]
): Source[] {
  const seen = new Set<string>();
  const out: Source[] = [];

  for (const source of declared) {
    if (out.length >= MAX_PROVENANCE_SOURCES) break;
    const key = (source.url ?? (source.location.toLowerCase() || source.title.toLowerCase())).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(source);
  }

  for (const source of captured) {
    if (out.length >= MAX_PROVENANCE_SOURCES) break;
    const key = (source.url ?? (source.location.toLowerCase() || source.title.toLowerCase())).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(source);
  }
  return out;
}

/**
 * Safely extracts web provenance from an untrusted Hermes SSE
 * `tool.completed` data payload. Hermes may attach result metadata on
 * `url`, `results[]`, `sources[]`, or `links[]`; nothing about the shape is
 * trusted. Returns sanitized, deduplicated Sources.
 */
export function extractProvenanceFromToolData(
  data: unknown,
  options?: { retrievedAt?: string }
): Source[] {
  if (!data || typeof data !== "object") return [];
  const obj = data as Record<string, unknown>;
  const rawEntries: unknown[] = [];

  const collect = (value: unknown) => {
    if (Array.isArray(value)) rawEntries.push(...value);
    else if (value && typeof value === "object") rawEntries.push(value);
  };

  if (obj.url || obj.title) collect(obj);
  collect(obj.results);
  collect(obj.sources);
  collect(obj.links);

  return normalizeWebSources(rawEntries, options);
}


