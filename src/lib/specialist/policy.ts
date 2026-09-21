import type { DelegationPlan, SpecialistDefinition } from "@/lib/contracts/specialist";
import { specialistRegistry, SpecialistRegistry } from "./registry";

export interface DelegationEvaluationContext {
  availableCapabilities?: string[];
  isMultiTurn?: boolean;
  activeSkill?: string;
}

/**
 * Policy evaluator determining whether work should execute directly in Hermes
 * or delegate to one or more specialist child agents.
 */
export class DelegationPolicy {
  constructor(private readonly registry: SpecialistRegistry = specialistRegistry) {}

  /**
   * Evaluate a user request against delegation criteria.
   */
  evaluateDelegation(
    request: string,
    context?: DelegationEvaluationContext
  ): DelegationPlan {
    const trimmed = request.trim().toLowerCase();

    // 1. Direct execution fast-path: Simple questions & greetings
    if (this.isSimpleQuestion(trimmed)) {
      return {
        shouldDelegate: false,
        reason: "Simple conversational query or factual question handled directly by Hermes core",
        targetSpecialists: [],
        tasks: [],
      };
    }

    // 2. Direct execution: Simple deterministic command or single tool request
    if (this.isSingleToolRequest(trimmed)) {
      return {
        shouldDelegate: false,
        reason: "Small single tool call executed directly without child agent overhead",
        targetSpecialists: [],
        tasks: [],
      };
    }

    // 3. Multi-faceted queries combining distinct specialist domains
    // Example: "Check my calendar for tomorrow and research notes on Project Apollo in my vault"
    const isMultiDomain =
      (trimmed.includes("calendar") || trimmed.includes("meeting") || trimmed.includes("briefing")) &&
      (trimmed.includes("notes") || trimmed.includes("vault") || trimmed.includes("research") || trimmed.includes("drive"));

    if (isMultiDomain) {
      return {
        shouldDelegate: true,
        reason: "Multi-domain task naturally separates into productivity and research subtasks",
        targetSpecialists: ["productivity", "research"],
        tasks: [
          {
            specialistId: "productivity",
            goal: "Inspect calendar events and agenda for upcoming meetings related to the request",
          },
          {
            specialistId: "research",
            goal: "Search Obsidian vault and documentation for background context and notes",
          },
        ],
      };
    }

    // 4. Parallel research or deep investigation queries
    if (
      trimmed.includes("parallel research") ||
      trimmed.includes("cross-reference notes and emails") ||
      trimmed.includes("compare vault and drive")
    ) {
      return {
        shouldDelegate: true,
        reason: "Parallel information retrieval benefits from separated specialist boundaries",
        targetSpecialists: ["research", "communications"],
        tasks: [
          {
            specialistId: "research",
            goal: "Search vault and documents for relevant references",
          },
          {
            specialistId: "communications",
            goal: "Search email correspondence for relevant mentions",
          },
        ],
      };
    }

    // 5. Codebase inspection & architecture reviews
    if (
      trimmed.startsWith("inspect repository") ||
      trimmed.startsWith("analyze architecture") ||
      trimmed.includes("inspect this repository's architecture")
    ) {
      return {
        shouldDelegate: true,
        reason: "Specialist boundary provides focused code inspection without polluting parent context",
        targetSpecialists: ["coding"],
        tasks: [
          {
            specialistId: "coding",
            goal: request,
          },
        ],
      };
    }

    // 6. Explicit delegation request
    // Example: "Create a specialist to inspect..."
    const explicitMatch = trimmed.match(
      /(?:create|spawn|delegate\s+to)\s+(?:a\s+)?specialist\s+(?:to\s+)?(.+)/i
    );
    if (explicitMatch) {
      const subtaskGoal = explicitMatch[1].trim();
      const matchedSpec = this.registry.findBestSpecialist(subtaskGoal);
      const specId = matchedSpec ? matchedSpec.id : "research";

      return {
        shouldDelegate: true,
        reason: "Explicit user request to delegate work to a specialist",
        targetSpecialists: [specId],
        tasks: [
          {
            specialistId: specId,
            goal: subtaskGoal,
          },
        ],
      };
    }

    // Default: Direct execution by Hermes core (avoid unnecessary delegation)
    return {
      shouldDelegate: false,
      reason: "Direct Hermes core execution preferred for general single-stream task",
      targetSpecialists: [],
      tasks: [],
    };
  }

  /**
   * Validates that child specialist tool permissions do NOT exceed parent permissions.
   */
  validateChildPermissions(
    specialist: SpecialistDefinition,
    parentCapabilities: readonly string[]
  ): { valid: boolean; disallowedTools: string[] } {
    const parentSet = new Set(parentCapabilities);
    const disallowedTools = specialist.allowedCapabilities.filter((tool) => !parentSet.has(tool));

    return {
      valid: disallowedTools.length === 0,
      disallowedTools,
    };
  }

  private isSimpleQuestion(text: string): boolean {
    const simpleGreetings = ["hi", "hello", "hey", "who are you", "what can you do", "help"];
    if (simpleGreetings.includes(text)) return true;

    if (
      text.startsWith("what is") ||
      text.startsWith("who is") ||
      text.startsWith("why is") ||
      text.startsWith("how do i") ||
      text.includes("capital of")
    ) {
      // If it doesn't mention multiple complex operations, it's a simple question
      return !text.includes(" and ") && !text.includes("also");
    }

    return false;
  }

  private isSingleToolRequest(text: string): boolean {
    if (text === "what time is it" || text === "current time") return true;
    if (text.startsWith("read note ") && !text.includes(" and ")) return true;
    if (text.startsWith("search vault for ") && !text.includes(" and ")) return true;
    if (text.startsWith("list memories") || text.startsWith("show memory")) return true;
    return false;
  }
}

export const delegationPolicy = new DelegationPolicy();
