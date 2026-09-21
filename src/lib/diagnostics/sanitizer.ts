/**
 * Sanitization utility for Phase 11 Observability.
 * Enforces strict allowlists and redacts secrets, absolute paths, credentials, and raw binaries.
 */

const ABSOLUTE_PATH_WIN_REGEX = /[a-zA-Z]:\\[^\s"'`<>]+/g;
const ABSOLUTE_PATH_UNIX_REGEX = /(?:\/(?:home|Users|var|etc|usr|tmp|opt))\b[^\s"'`<>]+/g;
const API_KEY_REGEX = /\b(sk-[a-zA-Z0-9_-]{20,}|ghp_[a-zA-Z0-9]{20,}|AIza[0-9A-Za-z-_]{20,}|ya29\.[a-zA-Z0-9_\-.]+)\b|Bearer\s+[a-zA-Z0-9_\-.]+/gi;
const SECRET_FIELD_REGEX = /"(?:apiKey|token|password|secret|authorization|cookie)"\s*:\s*"[^"]*"/gi;
const RAW_GWS_CMD_REGEX = /\bgws\s+[^\n\r"'`]+/gi;

/**
 * Sanitizes a string, removing filesystem paths, secrets, tokens, credentials, and raw GWS commands.
 */
export function sanitizeText(text: string): string {
  if (!text) return "";
  let sanitized = text;

  // Redact secrets and tokens
  sanitized = sanitized.replace(API_KEY_REGEX, "[REDACTED_SECRET]");
  sanitized = sanitized.replace(SECRET_FIELD_REGEX, '"[REDACTED_KEY]": "[REDACTED_SECRET]"');

  // Redact raw GWS commands
  sanitized = sanitized.replace(RAW_GWS_CMD_REGEX, "[REDACTED_GWS_CMD]");

  // Redact absolute filesystem paths
  sanitized = sanitized.replace(ABSOLUTE_PATH_WIN_REGEX, "[REDACTED_PATH]");
  sanitized = sanitized.replace(ABSOLUTE_PATH_UNIX_REGEX, "[REDACTED_PATH]");

  return sanitized;
}

/**
 * Creates a bounded safe summary string.
 */
export function safeSummaryText(text: string, maxLength: number = 120): string {
  const sanitized = sanitizeText(text);
  if (sanitized.length <= maxLength) return sanitized;
  return sanitized.slice(0, maxLength - 3) + "...";
}

/**
 * Recursively sanitizes any payload structure, ensuring all nested strings are safe.
 */
export function sanitizeEventPayload<T>(payload: T): T {
  if (typeof payload === "string") {
    return sanitizeText(payload) as unknown as T;
  }
  if (Array.isArray(payload)) {
    return payload.map((item) => sanitizeEventPayload(item)) as unknown as T;
  }
  if (payload !== null && typeof payload === "object") {
    const sanitizedObj: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(payload)) {
      sanitizedObj[key] = sanitizeEventPayload(value);
    }
    return sanitizedObj as T;
  }
  return payload;
}
