import { describe, it, expect } from "vitest";
import { getDefaultIntentRegistry } from "@/lib/intent/registry";

describe("Phase 07: Intent & Alias Registry Table-Driven Tests", () => {
  const registry = getDefaultIntentRegistry();

  describe("1. Direct & Natural Aliases with Punctuation/Case Normalization", () => {
    const directCases = [
      { input: "stop", expectedIntent: "cancel_run", route: "fallback", reason: "Active run context required" },
      { input: "STOP!", expectedIntent: "cancel_run", route: "fallback" },
      { input: "cancel this", expectedIntent: "cancel_run", route: "fallback" },
      { input: "abort that", expectedIntent: "cancel_run", route: "fallback" },
      { input: "what time is it", expectedIntent: "get_time", route: "deterministic", isDeterministic: true },
      { input: "What's the time?", expectedIntent: "get_time", route: "deterministic", isDeterministic: true },
      { input: "current time", expectedIntent: "get_time", route: "deterministic", isDeterministic: true },
      { input: "tell me the time", expectedIntent: "get_time", route: "deterministic", isDeterministic: true },
      { input: "be quiet", expectedIntent: "stop_response", route: "deterministic", isDeterministic: true },
      { input: "silence!", expectedIntent: "stop_response", route: "deterministic", isDeterministic: true },
    ];

    for (const { input, expectedIntent, route, isDeterministic } of directCases) {
      it(`matches "${input}" -> intent: ${expectedIntent}`, () => {
        const res = registry.match(input);
        expect(res.matched).toBe(true);
        expect(res.intentId).toBe(expectedIntent);
        expect(res.route).toBe(route);
        if (isDeterministic !== undefined) {
          expect(res.isDeterministic).toBe(isDeterministic);
        }
      });
    }
  });

  describe("2. Extra Filler Words & Voice Transcript Input", () => {
    const fillerCases = [
      { input: "hey jarvis please what time is it?", expectedIntent: "get_time", isDeterministic: true },
      { input: "could you please tell me the current time", expectedIntent: "get_time", isDeterministic: true },
      { input: "jarvis silence please", expectedIntent: "stop_response", isDeterministic: true },
      { input: "hey jarvis remember this my code is 42", expectedIntent: "memory_save", route: "semantic_hint" },
    ];

    for (const { input, expectedIntent, isDeterministic, route } of fillerCases) {
      it(`strips fillers for "${input}" -> intent: ${expectedIntent}`, () => {
        const res = registry.match(input);
        expect(res.matched).toBe(true);
        expect(res.intentId).toBe(expectedIntent);
        if (isDeterministic !== undefined) {
          expect(res.isDeterministic).toBe(isDeterministic);
        }
        if (route) {
          expect(res.route).toBe(route);
        }
      });
    }
  });

  describe("3. False Positive & Negative Heuristic Guard Tests (Falls through to Hermes)", () => {
    const negativeCases = [
      "I don't want you to do that",
      "I'm talking about the word remember, not asking you to save anything",
      "I remember that movie",
      "that reminds me of our vacation",
      "don't stop believing",
      "I recall seeing that yesterday",
      "can you tell me the meaning of stop?",
      "didnt say to save this",
    ];

    for (const phrase of negativeCases) {
      it(`does NOT falsely trigger intent for: "${phrase}"`, () => {
        const res = registry.match(phrase);
        expect(res.matched).toBe(false);
        expect(res.route).toBe("fallback");
      });
    }
  });

  describe("4. Context Requirements: Active Run Guard", () => {
    it("rejects deterministic execution of stop when no active run exists", () => {
      const res = registry.match("stop", { hasActiveRun: false });
      expect(res.matched).toBe(true);
      expect(res.intentId).toBe("cancel_run");
      expect(res.contextValid).toBe(false);
      expect(res.isDeterministic).toBe(false);
      expect(res.route).toBe("fallback");
      expect(res.reason).toContain("Active run context required");
    });

    it("allows deterministic execution of stop when active run exists", () => {
      const res = registry.match("stop", { hasActiveRun: true, activeRunId: "run-123" });
      expect(res.matched).toBe(true);
      expect(res.intentId).toBe("cancel_run");
      expect(res.contextValid).toBe(true);
      expect(res.isDeterministic).toBe(true);
      expect(res.route).toBe("deterministic");
    });
  });

  describe("5. Context Requirements: Reversible Action Guard", () => {
    it("rejects deterministic execution of undo that when no reversible action exists", () => {
      const res = registry.match("undo that", { hasReversibleAction: false });
      expect(res.matched).toBe(true);
      expect(res.intentId).toBe("undo_action");
      expect(res.contextValid).toBe(false);
      expect(res.isDeterministic).toBe(false);
      expect(res.route).toBe("fallback");
    });

    it("allows execution of undo that when reversible action exists", () => {
      const res = registry.match("undo that", {
        hasReversibleAction: true,
        lastReversibleAction: { toolId: "create_note", undoAction: "delete_note" },
      });
      expect(res.matched).toBe(true);
      expect(res.intentId).toBe("undo_action");
      expect(res.contextValid).toBe(true);
      expect(res.isDeterministic).toBe(true);
      expect(res.route).toBe("deterministic");
    });
  });

  describe("6. Context Requirements: Active Confirmation Guard (Safety Critical)", () => {
    it("strictly rejects approve / yes without active confirmation context (never authorizes!)", () => {
      const resApprove = registry.match("approve", { hasActiveConfirmation: false });
      expect(resApprove.matched).toBe(true);
      expect(resApprove.intentId).toBe("confirm_action");
      expect(resApprove.contextValid).toBe(false);
      expect(resApprove.isDeterministic).toBe(false);
      expect(resApprove.route).toBe("fallback");

      const resYes = registry.match("yes", { hasActiveConfirmation: false });
      expect(resYes.matched).toBe(true);
      expect(resYes.contextValid).toBe(false);
      expect(resYes.isDeterministic).toBe(false);
      expect(resYes.route).toBe("fallback");
    });

    it("authorizes approve / yes when active confirmation context is present", () => {
      const res = registry.match("approve", {
        hasActiveConfirmation: true,
        activeConfirmationId: "conf-456",
      });
      expect(res.matched).toBe(true);
      expect(res.intentId).toBe("confirm_action");
      expect(res.contextValid).toBe(true);
      expect(res.isDeterministic).toBe(true);
      expect(res.route).toBe("deterministic");
    });
  });

  describe("7. Inactive Capability Routing (reminder_create)", () => {
    it("recognizes reminder_create candidate but flags activeCapability as false", () => {
      const res = registry.match("remind me tomorrow at 8");
      expect(res.matched).toBe(true);
      expect(res.intentId).toBe("reminder_create");
      expect(res.activeCapability).toBe(false);
      expect(res.isDeterministic).toBe(false);
      expect(res.route).toBe("fallback");
    });

    it("recognizes set a reminder candidate gracefully", () => {
      const res = registry.match("set a reminder");
      expect(res.matched).toBe(true);
      expect(res.intentId).toBe("reminder_create");
      expect(res.activeCapability).toBe(false);
    });
  });

  describe("8. Semantic Hints for Skills and Memory", () => {
    it("identifies memory_recall candidate for 'what do you remember about X'", () => {
      const res = registry.match("what do you remember about our launch date");
      expect(res.matched).toBe(true);
      expect(res.intentId).toBe("memory_recall");
      expect(res.route).toBe("semantic_hint");
      expect(res.isDeterministic).toBe(false);
    });

    it("identifies morning_briefing for 'morning briefing'", () => {
      const res = registry.match("morning briefing");
      expect(res.matched).toBe(true);
      expect(res.intentId).toBe("morning_briefing");
      expect(res.isDeterministic).toBe(true);
      expect(res.handlerTarget).toBe("skill:morning-briefing");
    });

    it("identifies meeting_prep for 'meeting prep'", () => {
      const res = registry.match("meeting prep");
      expect(res.matched).toBe(true);
      expect(res.intentId).toBe("meeting_prep");
      expect(res.isDeterministic).toBe(true);
      expect(res.handlerTarget).toBe("skill:meeting-prep");
    });

    it("identifies loose_ends for 'check for loose ends'", () => {
      const res = registry.match("check for loose ends");
      expect(res.matched).toBe(true);
      expect(res.intentId).toBe("loose_ends");
      expect(res.isDeterministic).toBe(true);
      expect(res.handlerTarget).toBe("skill:loose-ends");
    });
  });
});
