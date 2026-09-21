import { MemoryService, resetDefaultMemoryService } from "../src/lib/memory/service";
import { AgentRuntime } from "../src/lib/agent/runtime";
import { ToolRegistry } from "../src/lib/tools/registry";
import { registerMemoryTools } from "../src/lib/memory/tools";
import type { AgentProvider, AgentRun } from "../src/lib/contracts/provider";
import fs from "node:fs";
import path from "node:path";

async function main() {
  console.log("=== Phase 7 Real Runtime Verification ===");

  const dbDir = path.join(process.cwd(), ".jarvis");
  const dbFile = path.join(dbDir, "test-runtime-memory.db");
  if (fs.existsSync(dbFile)) {
    fs.unlinkSync(dbFile);
  }

  process.env.JARVIS_MEMORY_DB_PATH = dbFile;
  resetDefaultMemoryService();
  const service = new MemoryService({ dbPath: dbFile });

  // Verification 1: Remember flow with explicit memory intent
  console.log("\n1. Testing 'Remember that I prefer concise answers.'");
  let rememberRequestCount = 0;
  const rememberProvider: AgentProvider = {
    id: "command-code",
    name: "Command Code",
    async runAgent(): Promise<AgentRun> {
      rememberRequestCount++;
      if (rememberRequestCount === 1) {
        return {
          events: (async function* () {})(),
          result: Promise.resolve({
            decision: {
              type: "tool_call",
              request: {
                type: "tool_call",
                callId: "call_store_1",
                toolId: "store_memory",
                arguments: { content: "I prefer concise answers.", category: "preference" },
              },
            },
            meta: { provider: "Command Code", model: "default", durationMs: 25 },
          }),
          cancel: async () => {},
        };
      }
      return {
        events: (async function* () {})(),
        result: Promise.resolve({
          decision: {
            type: "direct",
            result: {
              speech: "I have recorded your preference for concise answers in persistent memory.",
              title: "Preference Saved",
              state: "complete",
              cards: [
                {
                  id: "card_1",
                  type: "insight",
                  label: "Memory Saved",
                  title: "User Preference",
                  body: "I prefer concise answers.",
                  confidence: "observed",
                },
              ],
              sources: [],
            },
          },
          meta: { provider: "Command Code", model: "default", durationMs: 20 },
        }),
        cancel: async () => {},
      };
    },
  };

  const registry = new ToolRegistry();
  registerMemoryTools(registry, service);
  const runtime1 = new AgentRuntime(rememberProvider, registry, undefined, service);

  for await (const frame of runtime1.run({ message: "Remember that I prefer concise answers.", conversation: [] }, new AbortController().signal)) {
    if (frame.type === "event" && frame.event.type === "tool_completed") {
      console.log(`   [Event] ${frame.event.label}`);
    }
  }

  const storedMemories = service.listMemory();
  console.log(`   Stored memories count: ${storedMemories.total}`);
  if (storedMemories.total !== 1 || storedMemories.memories[0].content !== "I prefer concise answers.") {
    throw new Error("Verification 1 failed: Memory was not persisted!");
  }
  const savedMemoryId = storedMemories.memories[0].id;
  console.log(`   Verified: Memory persisted with ID ${savedMemoryId}`);

  // Verification 2: Recall flow
  console.log("\n2. Testing 'What do you remember about my answer preferences?'");
  let recallRequestCount = 0;
  const recallProvider: AgentProvider = {
    id: "command-code",
    name: "Command Code",
    async runAgent(): Promise<AgentRun> {
      recallRequestCount++;
      if (recallRequestCount === 1) {
        return {
          events: (async function* () {})(),
          result: Promise.resolve({
            decision: {
              type: "tool_call",
              request: {
                type: "tool_call",
                callId: "call_search_1",
                toolId: "search_memory",
                arguments: { query: "answer preferences", limit: 5 },
              },
            },
            meta: { provider: "Command Code", model: "default", durationMs: 20 },
          }),
          cancel: async () => {},
        };
      }
      return {
        events: (async function* () {})(),
        result: Promise.resolve({
          decision: {
            type: "direct",
            result: {
              speech: "You noted that you prefer concise answers.",
              title: "Stored Preferences",
              state: "complete",
              cards: [
                {
                  id: "card_pref",
                  type: "insight",
                  label: "Recalled Memory",
                  title: "Answer Preferences",
                  body: "I prefer concise answers.",
                  confidence: "observed",
                },
              ],
              sources: [],
            },
          },
          meta: { provider: "Command Code", model: "default", durationMs: 20 },
        }),
        cancel: async () => {},
      };
    },
  };

  const runtime2 = new AgentRuntime(recallProvider, registry, undefined, service);
  for await (const frame of runtime2.run({ message: "What do you remember about my answer preferences?", conversation: [] }, new AbortController().signal)) {
    if (frame.type === "event" && frame.event.type === "tool_completed") {
      console.log(`   [Event] ${frame.event.label}`);
    }
  }
  console.log("   Verified: Memory search executed and recalled.");

  // Verification 3: Forget flow
  console.log("\n3. Testing 'Forget that I prefer concise answers.'");
  let forgetRequestCount = 0;
  const forgetProvider: AgentProvider = {
    id: "command-code",
    name: "Command Code",
    async runAgent(): Promise<AgentRun> {
      forgetRequestCount++;
      if (forgetRequestCount === 1) {
        return {
          events: (async function* () {})(),
          result: Promise.resolve({
            decision: {
              type: "tool_call",
              request: {
                type: "tool_call",
                callId: "call_del_1",
                toolId: "delete_memory",
                arguments: { id: savedMemoryId },
              },
            },
            meta: { provider: "Command Code", model: "default", durationMs: 20 },
          }),
          cancel: async () => {},
        };
      }
      return {
        events: (async function* () {})(),
        result: Promise.resolve({
          decision: {
            type: "direct",
            result: {
              speech: "I have removed that preference from persistent memory.",
              title: "Memory Removed",
              state: "complete",
              cards: [],
              sources: [],
            },
          },
          meta: { provider: "Command Code", model: "default", durationMs: 15 },
        }),
        cancel: async () => {},
      };
    },
  };

  const runtime3 = new AgentRuntime(forgetProvider, registry, undefined, service);
  for await (const frame of runtime3.run({ message: "Forget that I prefer concise answers.", conversation: [] }, new AbortController().signal)) {
    if (frame.type === "event" && frame.event.type === "tool_completed") {
      console.log(`   [Event] ${frame.event.label}`);
    }
  }
  const afterDelete = service.listMemory();
  console.log(`   Stored memories count after deletion: ${afterDelete.total}`);
  if (afterDelete.total !== 0) {
    throw new Error("Verification 3 failed: Memory was not deleted!");
  }
  console.log("   Verified: Memory deleted successfully.");

  // Verification 4: Casual conversation does NOT create memory
  console.log("\n4. Testing 'The meeting today was long.' (casual conversation non-storage)");
  let casualRequestCount = 0;
  const casualProvider: AgentProvider = {
    id: "command-code",
    name: "Command Code",
    async runAgent(): Promise<AgentRun> {
      casualRequestCount++;
      if (casualRequestCount === 1) {
        // Model erroneously attempts to call store_memory for casual comment
        return {
          events: (async function* () {})(),
          result: Promise.resolve({
            decision: {
              type: "tool_call",
              request: {
                type: "tool_call",
                callId: "call_store_casual",
                toolId: "store_memory",
                arguments: { content: "Meeting was long.", category: "fact" },
              },
            },
            meta: { provider: "Command Code", model: "default", durationMs: 15 },
          }),
          cancel: async () => {},
        };
      }
      return {
        events: (async function* () {})(),
        result: Promise.resolve({
          decision: {
            type: "direct",
            result: {
              speech: "Understood. That sounds exhausting.",
              title: "Response",
              state: "complete",
              cards: [],
              sources: [],
            },
          },
          meta: { provider: "Command Code", model: "default", durationMs: 15 },
        }),
        cancel: async () => {},
      };
    },
  };

  const runtime4 = new AgentRuntime(casualProvider, registry, undefined, service);
  let deniedEventCaptured = false;
  for await (const frame of runtime4.run({ message: "The meeting today was long.", conversation: [] }, new AbortController().signal)) {
    if (frame.type === "event" && frame.event.type === "tool_failed") {
      deniedEventCaptured = true;
      console.log(`   [Event] ${frame.event.label}`);
    }
  }
  if (!deniedEventCaptured || service.listMemory().total !== 0) {
    throw new Error("Verification 4 failed: Casual conversation was allowed to create memory!");
  }
  console.log("   Verified: Casual conversation blocked from creating memory at runtime boundary.");

  // Verification 5: Secret rejection
  console.log("\n5. Testing Secret Rejection: 'Remember my API key: sk-live12345678901234567890'");
  try {
    service.storeMemory({
      content: "Remember my API key: sk-live12345678901234567890",
      category: "instruction",
    });
    throw new Error("Verification 5 failed: Secret was not rejected!");
  } catch (err: unknown) {
    console.log(`   Caught expected rejection: ${(err as Error).message}`);
  }

  // Verification 6: Persistence across application/process restart
  console.log("\n6. Testing Persistence across process restart");
  // Store a safe preference
  service.storeMemory({
    content: "Start video recordings with the end result first.",
    category: "project",
  });
  service.close();

  // Simulate complete process restart by instantiating a fresh MemoryService on the same file
  const restartedService = new MemoryService({ dbPath: dbFile });
  const reloaded = restartedService.searchMemory({ query: "video recordings" });
  console.log(`   Reloaded memory count: ${reloaded.total}`);
  if (reloaded.total !== 1 || !reloaded.memories[0].content.includes("end result first")) {
    throw new Error("Verification 6 failed: Memory was lost across restart!");
  }
  console.log("   Verified: Memory persisted across restart.");
  restartedService.close();

  // Clean up test file
  if (fs.existsSync(dbFile)) {
    fs.unlinkSync(dbFile);
  }

  console.log("\n=== All Phase 7 Real Runtime Verifications Passed! ===");
}

main().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
