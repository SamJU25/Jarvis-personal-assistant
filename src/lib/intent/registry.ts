import type {
  IntentDefinition,
  IntentMatchContext,
  IntentMatchResult,
} from "@/lib/contracts/intent";
import { normalizeInput } from "@/lib/intent/normalizer";
import { DEFAULT_INTENTS } from "@/lib/intent/default-intents";

export class IntentRegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IntentRegistryError";
  }
}

export class IntentRegistry {
  private readonly intents = new Map<string, IntentDefinition>();

  constructor(initialIntents?: readonly IntentDefinition[]) {
    const list = initialIntents ?? DEFAULT_INTENTS;
    for (const intent of list) {
      this.register(intent);
    }
  }

  register(intent: IntentDefinition): void {
    if (!intent || typeof intent !== "object") {
      throw new IntentRegistryError("Invalid intent: must be an object.");
    }
    if (!intent.id || typeof intent.id !== "string" || !intent.id.trim()) {
      throw new IntentRegistryError("Intent id must be a non-empty string.");
    }
    if (this.intents.has(intent.id)) {
      throw new IntentRegistryError(`Intent with ID "${intent.id}" is already registered.`);
    }
    if (!intent.description || typeof intent.description !== "string") {
      throw new IntentRegistryError(`Intent "${intent.id}" must have a description.`);
    }
    if (!Array.isArray(intent.aliases) || intent.aliases.length === 0) {
      throw new IntentRegistryError(`Intent "${intent.id}" must define at least one alias.`);
    }

    this.intents.set(intent.id, intent);
  }

  get(id: string): IntentDefinition | undefined {
    return this.intents.get(id);
  }

  getAll(): readonly IntentDefinition[] {
    return Array.from(this.intents.values());
  }

  /**
   * Matches an input message against registered intents with safety-aware layered matching.
   */
  match(message: string, context?: IntentMatchContext): IntentMatchResult {
    const norm = normalizeInput(message);
    if (!norm.cleanNormalized) {
      return {
        matched: false,
        confidence: 0,
        route: "fallback",
        isDeterministic: false,
        contextValid: false,
        activeCapability: true,
        reason: "Empty input message",
      };
    }

    // Layer 1: Negative Heuristic & False Positive Guard
    if (isNegativeOrConversational(norm.cleanNormalized)) {
      return {
        matched: false,
        confidence: 0,
        route: "fallback",
        isDeterministic: false,
        contextValid: false,
        activeCapability: true,
        reason: "Conversational negation or meta-discussion detected; falling through to Hermes",
      };
    }

    // Layer 2: Intent evaluation sorted by priority descending
    const channel = context?.channel || "all";
    const sortedIntents = Array.from(this.intents.values()).sort(
      (a, b) => b.priority - a.priority
    );

    let bestMatch: {
      intent: IntentDefinition;
      alias: string;
      confidence: number;
    } | null = null;

    for (const intent of sortedIntents) {
      // Check channel applicability
      if (
        !intent.channels.includes("all") &&
        !intent.channels.includes(channel)
      ) {
        continue;
      }

      for (const alias of intent.aliases) {
        const aliasNorm = normalizeInput(alias).cleanNormalized;
        if (!aliasNorm) continue;

        // Exact match on clean normalized
        if (norm.cleanNormalized === aliasNorm || norm.normalized === aliasNorm) {
          bestMatch = { intent, alias, confidence: 1.0 };
          break;
        }

        // Prefix match with argument/payload boundary
        if (norm.cleanNormalized.startsWith(aliasNorm + " ")) {
          const confidence = 0.92;
          if (!bestMatch || confidence > bestMatch.confidence) {
            bestMatch = { intent, alias, confidence };
          }
          break;
        }

        // Token sequence containment for phrase
        if (
          norm.cleanNormalized.includes(` ${aliasNorm} `) ||
          norm.cleanNormalized.endsWith(` ${aliasNorm}`)
        ) {
          const confidence = 0.85;
          if (!bestMatch || confidence > bestMatch.confidence) {
            bestMatch = { intent, alias, confidence };
          }
        }
      }

      if (bestMatch && bestMatch.confidence === 1.0) {
        break; // Found highest-confidence exact match
      }
    }

    if (!bestMatch || bestMatch.confidence < 0.7) {
      return {
        matched: false,
        confidence: bestMatch ? bestMatch.confidence : 0,
        route: "fallback",
        isDeterministic: false,
        contextValid: false,
        activeCapability: true,
        reason: "No confident deterministic alias matched; routing to Hermes",
      };
    }

    const { intent, alias, confidence } = bestMatch;

    // Layer 3: Context requirements check
    let contextValid = true;
    let contextReason: string | undefined;

    if (intent.requiresContext === "active_run") {
      if (!context?.hasActiveRun) {
        contextValid = false;
        contextReason = "Active run context required to cancel";
      }
    } else if (intent.requiresContext === "active_confirmation") {
      if (!context?.hasActiveConfirmation) {
        contextValid = false;
        contextReason = "Active confirmation context required to authorize";
      }
    } else if (intent.requiresContext === "reversible_action") {
      if (!context?.hasReversibleAction) {
        contextValid = false;
        contextReason = "Reversible action required to undo";
      }
    }

    // Layer 4: Capability activity check
    const activeCapability = intent.active !== false;

    // Layer 5: Route determination
    let route: "deterministic" | "semantic_hint" | "fallback" = "fallback";
    let isDeterministic = false;

    if (!activeCapability || !contextValid) {
      // Inactive / deferred capability or failed context constraints
      route = "fallback";
      isDeterministic = false;
    } else if (intent.allowDeterministic && confidence >= 0.85) {
      route = "deterministic";
      isDeterministic = true;
    } else if (confidence >= 0.70) {
      route = "semantic_hint";
      isDeterministic = false;
    }

    const candidateSummary = `[Intent: ${intent.id}] (${alias}) confidence: ${(confidence * 100).toFixed(0)}% -> ${intent.handlerTarget}`;

    return {
      matched: true,
      intentId: intent.id,
      aliasMatched: alias,
      confidence,
      route,
      handlerTarget: intent.handlerTarget,
      isDeterministic,
      contextValid,
      activeCapability,
      reason: contextReason,
      candidateSummary,
    };
  }
}

/**
 * Checks for conversational negation, meta-discussion of words, or casual past-tense reflections.
 */
function isNegativeOrConversational(cleanNorm: string): boolean {
  // 1. Meta discussion about words
  if (
    /(?:talking|asking|discussing|meaning|word)\s+(?:about|of)?\s*(?:the\s+word\s+)?(?:remember|stop|cancel|undo|remind)/i.test(
      cleanNorm
    ) ||
    /not asking you to (?:save|remember|stop|cancel|delete)/i.test(cleanNorm) ||
    /didnt say to (?:save|remember|stop|cancel|delete)/i.test(cleanNorm)
  ) {
    return true;
  }

  // 2. Conversational negation
  if (
    /i (?:dont|do not) want you to (?:do|stop|cancel|undo)/i.test(cleanNorm) ||
    /dont (?:stop|cancel|undo) (?:believing|the music)/i.test(cleanNorm)
  ) {
    return true;
  }

  // 3. Casual conversation / past-tense reminiscing
  if (
    /^(?:i|we)\s+remember\s+(?:that|when|the|a)\b/i.test(cleanNorm) ||
    /^that\s+reminds\s+me\b/i.test(cleanNorm) ||
    /^i\s+recall\s+(?:that|seeing|when)\b/i.test(cleanNorm)
  ) {
    return true;
  }

  return false;
}

let defaultIntentRegistryInstance: IntentRegistry | null = null;

export function getDefaultIntentRegistry(): IntentRegistry {
  if (!defaultIntentRegistryInstance) {
    defaultIntentRegistryInstance = new IntentRegistry();
  }
  return defaultIntentRegistryInstance;
}
