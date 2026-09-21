/**
 * Enforces narrow, explicit user authorization policies for persistent memory operations.
 *
 * Ordinary conversation (e.g. "The weather is nice today", "The meeting was long")
 * and external content (emails, documents, notes) must NEVER silently trigger
 * persistent memory storage or deletion.
 */

export interface MemoryAuthorizationResult {
  authorized: boolean;
  reason?: string;
}

// Patterns that indicate explicit intent to store/remember
const EXPLICIT_REMEMBER_PATTERNS: RegExp[] = [
  /^\s*(?:please\s+)?remember\s+(?:that|this|my|me)\b/i,
  /\bremember\s+that\s+/i,
  /\bremember\s+my\s+(?:preference|rule|style|setting|habit|schedule)\b/i,
  /\bremember\s+this\s*[:—\-]/i,
  /\bsave\s+(?:this\s+)?(?:as\s+)?(?:a\s+)?(?:memory|something to remember|preference)\b/i,
  /\bstore\s+(?:this\s+)?(?:in\s+)?memory\b/i,
  /\bkeep\s+in\s+mind\s+that\b/i,
  /\bmake\s+a\s+mental\s+note\s+that\b/i,
  /\bnote\s+that\s+i\s+(?:prefer|like|dislike|want|need)\b/i,
];

// Inquiries about memory should not authorize storing new memory
const MEMORY_QUERY_PATTERNS: RegExp[] = [
  /^(?:what|do|did|can|could|will)\s+(?:do\s+you|you)?\s*remember\b/i,
  /^(?:what|do)\s+i\s+have\s+saved\b/i,
  /^what\s+are\s+my\s+preferences\b/i,
];

// Patterns that indicate explicit intent to delete/forget
const EXPLICIT_FORGET_PATTERNS: RegExp[] = [
  /^\s*(?:please\s+)?forget\s+(?:that|about|my|this)\b/i,
  /\bforget\s+that\s+/i,
  /\bdelete\s+(?:the\s+|this\s+)?(?:memory|preference)\b/i,
  /\bremove\s+(?:the\s+|this\s+)?(?:from\s+)?(?:memory|preferences)\b/i,
  /\berase\s+(?:the\s+|this\s+)?(?:memory|preference)\b/i,
];

export function isMemoryOperationAuthorized(
  userMessage: string,
  toolId: string
): MemoryAuthorizationResult {
  const trimmed = userMessage.trim();

  if (toolId === "store_memory") {
    // Queries like "What do you remember about X?" do not authorize storing memory
    if (MEMORY_QUERY_PATTERNS.some((p) => p.test(trimmed))) {
      return {
        authorized: false,
        reason: "User is querying memory, not requesting new memory storage.",
      };
    }

    const hasExplicitIntent = EXPLICIT_REMEMBER_PATTERNS.some((p) => p.test(trimmed));
    if (hasExplicitIntent) {
      return { authorized: true };
    }

    return {
      authorized: false,
      reason:
        "Memory persistence denied: user did not explicitly request storing or remembering this information.",
    };
  }

  if (toolId === "delete_memory") {
    const hasExplicitIntent = EXPLICIT_FORGET_PATTERNS.some((p) => p.test(trimmed));
    if (hasExplicitIntent) {
      return { authorized: true };
    }

    return {
      authorized: false,
      reason:
        "Memory deletion denied: user did not explicitly request forgetting or removing this memory.",
    };
  }

  // Read tools (search_memory, list_memory) are read-only and governed by read permissions
  return { authorized: true };
}
