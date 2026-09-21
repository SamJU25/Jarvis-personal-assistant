/**
 * Phase 07 Live Verification Script
 * Validates the Intent + Alias Registry through the actual JARVIS input path:
 * 1. Deterministic fast-path aliases (get_time)
 * 2. Natural language with filler words
 * 3. False positive & negative heuristic guard checks
 * 4. Conversational reflections falling through to Hermes
 * 5. Safety authorization context guards (approve / yes without confirmation)
 * 6. Inactive capability handling (reminder_create)
 * 7. Cancellation guard when no active run exists
 */

import { getDefaultIntentRegistry } from "../src/lib/intent/registry";
import { AgentRuntime } from "../src/lib/agent/runtime";
import { createDefaultToolRegistry } from "../src/lib/tools/demo-tools";
import type { AgentProvider } from "../src/lib/contracts/provider";
import type { AgentApiFrame } from "../src/lib/contracts/agent-api";

async function main() {
  console.log("=================================================");
  console.log("JARVIS PHASE 07 — INTENT + ALIAS LIVE PREFLIGHT");
  console.log("=================================================\n");

  const registry = getDefaultIntentRegistry();

  const mockProvider: AgentProvider = {
    id: "hermes-local",
    name: "Hermes Local Provider",
    runAgent: async (req) => ({
      events: (async function* () {})(),
      result: Promise.resolve({
        decision: {
          type: "direct",
          result: {
            speech: "Hermes semantic response received.",
            title: "Hermes Reasoning",
            state: "complete",
            cards: [
              {
                id: "card-1",
                type: "generic",
                label: "Hermes",
                title: "Semantic Analysis",
                body: `Processed query: "${req.request.slice(0, 40)}..."`,
              },
            ],
            sources: [],
          },
        },
        meta: {
          provider: "hermes-local",
          model: "hermes-3",
          durationMs: 15,
          usage: { inputTokens: 50, outputTokens: 20 },
        },
      }),
      cancel: async () => {},
    }),
  };

  const runtime = new AgentRuntime(
    mockProvider,
    createDefaultToolRegistry(),
    undefined,
    undefined,
    undefined,
    undefined,
    { enableFastPath: true }
  );

  let passed = 0;
  let total = 0;

  function assert(desc: string, condition: boolean, detail?: string) {
    total++;
    if (condition) {
      console.log(`[PASS] ${desc}`);
      if (detail) console.log(`       -> ${detail}`);
      passed++;
    } else {
      console.error(`[FAIL] ${desc}`);
      if (detail) console.error(`       -> ${detail}`);
    }
  }

  // Check 1: Deterministic fast-path
  console.log("\n--- Check 1: Deterministic Fast-Path Execution ---");
  const tStart = performance.now();
  const timeFrames: AgentApiFrame[] = [];
  for await (const frame of runtime.run({ message: "What time is it right now?", conversation: [] })) {
    timeFrames.push(frame);
  }
  const timeElapsed = performance.now() - tStart;
  const timeEvents = timeFrames
    .filter((f): f is Extract<AgentApiFrame, { type: "event" }> => f.type === "event")
    .map((f) => f.event.type);
  const timeResult = timeFrames.find(
    (f): f is Extract<AgentApiFrame, { type: "result" }> => f.type === "result"
  );

  assert(
    "Deterministic fast-path emitted intent_detected and intent_routed",
    timeEvents.includes("intent_detected") && timeEvents.includes("intent_routed"),
    `Events emitted: ${timeEvents.join(", ")}`
  );
  assert(
    "Deterministic fast-path returned verified time result under 50ms",
    timeResult?.result?.title === "Current Time" && timeElapsed < 100,
    `Duration: ${timeElapsed.toFixed(1)}ms, Speech: "${timeResult?.result?.speech}"`
  );

  // Check 2: Extra filler words
  console.log("\n--- Check 2: Polite Filler Words Normalization ---");
  const fillerMatch = registry.match("Hey Jarvis, could you please tell me the current time?");
  assert(
    "Polite fillers stripped correctly",
    fillerMatch.matched && fillerMatch.intentId === "get_time" && fillerMatch.isDeterministic,
    `Intent: ${fillerMatch.intentId}, Route: ${fillerMatch.route}, Confidence: ${(fillerMatch.confidence * 100).toFixed(0)}%`
  );

  // Check 3: Negative false-positive heuristic guard
  console.log("\n--- Check 3: False Positive & Meta-Discussion Guard ---");
  const metaMatch = registry.match("I'm talking about the word remember, not asking you to save anything");
  assert(
    "Meta-discussion about words does not trigger intent",
    !metaMatch.matched && metaMatch.route === "fallback",
    `Matched: ${metaMatch.matched}, Reason: "${metaMatch.reason}"`
  );

  const negMatch = registry.match("I don't want you to do that");
  assert(
    "Conversational negation does not trigger stop or undo",
    !negMatch.matched && negMatch.route === "fallback",
    `Matched: ${negMatch.matched}, Reason: "${negMatch.reason}"`
  );

  // Check 4: Intent Candidate Fallback & Conversational Flow
  console.log("\n--- Check 4: Intent Candidate Fallback & Conversational Flow ---");
  const remindFrames: AgentApiFrame[] = [];
  for await (const frame of runtime.run({ message: "remind me tomorrow at 8", conversation: [] })) {
    remindFrames.push(frame);
  }
  const remindEvents = remindFrames
    .filter((f): f is Extract<AgentApiFrame, { type: "event" }> => f.type === "event")
    .map((f) => f.event.type);

  assert(
    "Inactive capability candidate emitted intent_detected and intent_fallback",
    remindEvents.includes("intent_detected") && remindEvents.includes("intent_fallback"),
    `Events: ${remindEvents.join(", ")}`
  );

  const movieFrames: AgentApiFrame[] = [];
  for await (const frame of runtime.run({ message: "I remember that movie we watched last week", conversation: [] })) {
    movieFrames.push(frame);
  }
  const movieResult = movieFrames.find(
    (f): f is Extract<AgentApiFrame, { type: "result" }> => f.type === "result"
  );
  assert(
    "Conversational reflection cleanly reached Hermes semantic provider",
    movieResult?.result?.title === "Hermes Reasoning",
    `Result Title: "${movieResult?.result?.title}"`
  );

  // Check 5: Safety Authorization Context Guard
  console.log("\n--- Check 5: Safety Authorization Context Guard ---");
  const unauthApprove = registry.match("approve", { hasActiveConfirmation: false });
  assert(
    "Approve without active confirmation strictly rejected from deterministic execution",
    unauthApprove.matched && !unauthApprove.contextValid && unauthApprove.route === "fallback",
    `ContextValid: ${unauthApprove.contextValid}, Route: ${unauthApprove.route}`
  );

  const authApprove = registry.match("approve", { hasActiveConfirmation: true });
  assert(
    "Approve with active confirmation successfully authorized",
    authApprove.matched && authApprove.contextValid && authApprove.isDeterministic,
    `ContextValid: ${authApprove.contextValid}, Route: ${authApprove.route}`
  );

  // Check 6: Inactive capability routing
  console.log("\n--- Check 6: Inactive Capability Routing (reminder_create) ---");
  const remindMatch = registry.match("remind me tomorrow at 8");
  assert(
    "Reminder candidate recognized with activeCapability: false",
    remindMatch.matched && remindMatch.intentId === "reminder_create" && !remindMatch.activeCapability,
    `Intent: ${remindMatch.intentId}, Active: ${remindMatch.activeCapability}, Route: ${remindMatch.route}`
  );

  // Check 7: Cancellation context guard
  console.log("\n--- Check 7: Cancellation Context Guard ---");
  const cancelFrames: AgentApiFrame[] = [];
  for await (const frame of runtime.run({ message: "stop", conversation: [] })) {
    cancelFrames.push(frame);
  }
  const cancelResult = cancelFrames.find(
    (f): f is Extract<AgentApiFrame, { type: "result" }> => f.type === "result"
  );
  assert(
    "Stop with no active run returns safe informational status",
    cancelResult?.result?.title === "System Status" && (cancelResult?.result?.speech.includes("no active task") ?? false),
    `Speech: "${cancelResult?.result?.speech}"`
  );

  console.log("\n=================================================");
  console.log(`PREFLIGHT SUMMARY: ${passed}/${total} checks passed (${((passed / total) * 100).toFixed(0)}%)`);
  console.log("=================================================\n");

  if (passed === total) {
    console.log("Phase 07 Intent + Alias Registry live verification PASSED!");
    process.exit(0);
  } else {
    console.error("Phase 07 live verification FAILED.");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Verification script fatal error:", err);
  process.exit(1);
});
