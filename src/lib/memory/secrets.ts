/**
 * Scans memory content for credential-like secrets, private keys, API tokens,
 * passwords, and sensitive authentication material.
 * Fails safely by rejecting any suspected secret before persistence.
 */

const SECRET_PATTERNS: Array<{ regex: RegExp; reason: string }> = [
  // Private keys
  {
    regex: /-----BEGIN\s+[A-Z\s]*PRIVATE KEY-----/i,
    reason: "Private cryptographic key",
  },
  {
    regex: /-----BEGIN\s+CERTIFICATE-----/i,
    reason: "Cryptographic certificate",
  },
  // API keys and provider tokens
  {
    regex: /\b(sk-[a-zA-Z0-9_\-]{16,})\b/i,
    reason: "OpenAI or service API secret key",
  },
  {
    regex: /\b(gh[pousr]_[a-zA-Z0-9]{20,})\b/i,
    reason: "GitHub personal access token",
  },
  {
    regex: /\b(AIza[0-9A-Za-z\-_]{35})\b/,
    reason: "Google API key",
  },
  {
    regex: /\b(AKIA[0-9A-Z]{16})\b/,
    reason: "AWS access key identifier",
  },
  // JWT / Bearer tokens
  {
    regex: /\beyJ[a-zA-Z0-9_\-]{10,}\.eyJ[a-zA-Z0-9_\-]{10,}\.[a-zA-Z0-9_\-]{10,}\b/,
    reason: "JSON Web Token (JWT)",
  },
  {
    regex: /\bbearer\s+[a-zA-Z0-9_\-\.]{20,}\b/i,
    reason: "Authorization bearer token",
  },
  // Explicit password assignments
  {
    regex: /\b(?:password|passwd|pwd)\s*[:=]\s*[^\s,;]{4,}/i,
    reason: "Plaintext password declaration",
  },
  {
    regex: /\bmy\s+password\s+is\s+[^\s,;]{4,}/i,
    reason: "Plaintext password statement",
  },
  // Generic API / Secret key assignments
  {
    regex: /\b(?:api_key|apikey|secret_key|secretkey|access_token)\s*[:=]\s*['"]?[a-zA-Z0-9_\-]{12,}['"]?/i,
    reason: "API secret or token assignment",
  },
  // Recovery codes and seed phrases
  {
    regex: /\brecovery\s+code\s*[:=]\s*[a-zA-Z0-9\-]{8,}/i,
    reason: "Account recovery code",
  },
];

export interface SecretCheckResult {
  hasSecret: boolean;
  reason?: string;
}

export function containsSecret(text: string): SecretCheckResult {
  if (!text || typeof text !== "string") {
    return { hasSecret: false };
  }

  for (const { regex, reason } of SECRET_PATTERNS) {
    if (regex.test(text)) {
      return {
        hasSecret: true,
        reason,
      };
    }
  }

  return { hasSecret: false };
}
