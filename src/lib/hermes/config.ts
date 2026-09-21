/**
 * Server-only Hermes configuration reader.
 * Never import or execute this module in client/browser components.
 */

export interface HermesConfig {
  baseUrl: string;
  apiKey?: string;
  timeoutMs: number;
}

const DEFAULT_HERMES_BASE_URL = "http://127.0.0.1:8642";
const DEFAULT_HERMES_TIMEOUT_MS = 60000;

export function getHermesConfig(): HermesConfig {
  const rawUrl = process.env.HERMES_API_URL?.trim();
  const baseUrl = (rawUrl || DEFAULT_HERMES_BASE_URL).replace(/\/+$/, "");

  const apiKey = process.env.HERMES_API_KEY?.trim() || undefined;

  let timeoutMs = DEFAULT_HERMES_TIMEOUT_MS;
  const rawTimeout = process.env.HERMES_TIMEOUT_MS?.trim();
  if (rawTimeout) {
    const parsed = Number(rawTimeout);
    if (!Number.isNaN(parsed) && parsed > 0) {
      timeoutMs = parsed;
    }
  }

  return {
    baseUrl,
    apiKey,
    timeoutMs,
  };
}
