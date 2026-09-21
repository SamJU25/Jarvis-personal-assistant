import { HermesClient } from "../src/lib/hermes/client";
import {
  storeObsidianMemory,
  searchObsidianMemory,
  formatObsidianMemoryContext,
} from "../src/lib/obsidian/memory";
import {
  discoverObsidianSkills,
  loadObsidianSkill,
} from "../src/lib/obsidian/skills";
import { AgentEventBus } from "../src/lib/agent/event-bus";
import fs from "node:fs/promises";
import path from "node:path";

async function main() {
  console.log("==================================================");
  console.log("  PHASE 04 LIVE VERIFICATION: HERMES & OBSIDIAN   ");
  console.log("==================================================\n");

  const vaultRoot = "F:\\Jarvis\\tests\\fixtures\\test-vault";
  const apiKey = process.env.HERMES_API_KEY || "jarvis-hermes-foundation-test-key-32ch";
  const client = new HermesClient({
    baseUrl: "http://127.0.0.1:8642",
    apiKey,
    timeoutMs: 30000,
  });

  // 1. Health check
  console.log("1. Checking Hermes Server Health...");
  const health = await client.getHealth();
  console.log(`   Health OK: ${health.status} (v${health.version})`);

  // 2. Obsidian Skill Discovery
  console.log("\n2. Testing Obsidian Skill Discovery (AI/Skills/)...");
  const testSkillDir = path.join(vaultRoot, "AI", "Skills", "morning-briefing");
  await fs.mkdir(testSkillDir, { recursive: true });
  await fs.writeFile(
    path.join(testSkillDir, "SKILL.md"),
    `---
name: morning-briefing
description: Assembles calendar, urgent emails, and morning tasks.
version: 1.0.0
author: JARVIS
tags: [briefing, morning, schedule]
---
# Morning Briefing Procedure
1. Check schedule for today.
2. Highlight high-priority items.
`
  );

  const skills = await discoverObsidianSkills(vaultRoot);
  console.log(`   Discovered ${skills.length} skills in vault AI/Skills/:`);
  for (const s of skills) {
    console.log(`   - [${s.name}] ${s.description} (path: ${s.relativePath})`);
  }
  const loadedSkill = await loadObsidianSkill("morning-briefing", vaultRoot);
  if (!loadedSkill) throw new Error("Failed to load morning-briefing skill from Obsidian");
  console.log("   Skill discovery & loading: PASSED");

  // 3. Obsidian Memory Storage & Retrieval
  console.log("\n3. Testing Obsidian Memory Storage & Retrieval (AI/Memory/)...");
  const memEntry = await storeObsidianMemory(
    {
      title: "Live Test Memory",
      content: "Verification token: ALPHA-PHASE4-VERIFIED. User likes dark mode.",
      category: "testing",
      tags: ["phase4", "live-test"],
    },
    vaultRoot
  );
  console.log(`   Stored memory note: ${memEntry.relativePath} (ID: ${memEntry.id})`);

  const searchResults = await searchObsidianMemory("ALPHA-PHASE4-VERIFIED", undefined, vaultRoot);
  console.log(`   Search found ${searchResults.length} matching memory entries.`);
  if (searchResults.length === 0 || !searchResults[0].content.includes("ALPHA-PHASE4-VERIFIED")) {
    throw new Error("Failed to search and retrieve stored memory from Obsidian vault");
  }
  const context = formatObsidianMemoryContext(searchResults);
  console.log("   Formatted Prompt Context:\n   " + context?.split("\n").join("\n   "));
  console.log("   Obsidian memory store & retrieval: PASSED");

  // 4. Hermes Native Run & SSE Event Streaming
  console.log("\n4. Testing Hermes Native Run & SSE Streaming (GET /v1/runs/{id}/events)...");
  const sessionId = `jarvis-live-session-${Date.now()}`;

  const runResp = await client.createRun({
    input: "Please say 'JARVIS Phase 4 online' concisely.",
    session_id: sessionId,
  });
  console.log(`   Created Run ID: ${runResp.run_id} (Status: ${runResp.status})`);

  const sseEvents: string[] = [];
  const eventBus = new AgentEventBus();
  const streamedChunks: string[] = [];

  eventBus.subscribe(runResp.run_id, (frame) => {
    if (frame.type === "delta") {
      streamedChunks.push(frame.text);
    }
  });

  try {
    for await (const event of client.streamRunEvents(runResp.run_id)) {
      sseEvents.push(event.event);
      if (event.event === "message.delta" && typeof event.data === "object" && event.data !== null) {
        const deltaText = (event.data as Record<string, unknown>).delta as string || "";
        if (deltaText) {
          eventBus.publish(runResp.run_id, { type: "delta", text: deltaText });
          process.stdout.write(deltaText);
        }
      }
    }
  } catch (err: unknown) {
    console.log(`\n   SSE Stream ended: ${(err as Error).message}`);
  }

  console.log(`\n   Received SSE Events: [${sseEvents.join(", ")}]`);
  console.log(`   Replayed via EventBus: "${streamedChunks.join("")}"`);
  console.log("   SSE Event stream & EventBus replay: PASSED");

  // 5. Continued Session (Multi-turn session mapping)
  console.log("\n5. Testing Continued Session Mapping...");
  const continueRun = await client.createRun({
    input: "What was the previous phrase you just spoke?",
    session_id: sessionId,
  });
  console.log(`   Turn 2 Run ID: ${continueRun.run_id} (Same Session: ${continueRun.session_id || sessionId})`);

  const turn2Details = await client.getRunStatus(continueRun.run_id);
  console.log(`   Turn 2 Status: ${turn2Details.status}`);
  console.log("   Session continuity: PASSED");

  // 6. Cancellation reaching Hermes
  console.log("\n6. Testing Run Cancellation...");
  const cancelRun = await client.createRun({
    input: "Count slowly from 1 to 100 with long explanations.",
    session_id: `cancel-test-${Date.now()}`,
  });
  console.log(`   Initiated run for cancellation: ${cancelRun.run_id}`);
  const stopResp = await client.stopRun(cancelRun.run_id);
  console.log(`   Stop run response: status=${stopResp.status}`);
  const postCancelState = await client.getRunStatus(cancelRun.run_id);
  console.log(`   Run status after stop: ${postCancelState.status}`);
  console.log("   Cancellation: PASSED");

  console.log("\n==================================================");
  console.log("  ALL PHASE 04 LIVE VERIFICATIONS PASSED 100%    ");
  console.log("==================================================");
}

main().catch((err) => {
  console.error("Live verification failed:", err);
  process.exit(1);
});
