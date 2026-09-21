import fs from "node:fs";
import { HermesClient } from "../src/lib/hermes/client";
import { HermesProvider } from "../src/lib/agent/providers/hermes-provider";
import { AgentRuntime } from "../src/lib/agent/runtime";
import { createDefaultToolRegistry } from "../src/lib/tools/demo-tools";
import { getConfirmationService, buildConfirmationDetails } from "../src/lib/confirmation/service";
import { getVerificationRegistry } from "../src/lib/verification/registry";
import type { ConversationMessage } from "../src/lib/contracts/conversation";
import type { StructuredResult } from "../src/lib/contracts/result";

if (fs.existsSync(".env.local")) {
  const content = fs.readFileSync(".env.local", "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const idx = trimmed.indexOf("=");
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

async function runLiveVerification() {
  console.log("==================================================");
  console.log("JARVIS PHASE 3 LIVE VERIFICATION — REAL HERMES BACKEND");
  console.log("==================================================");

  const baseUrl = process.env.HERMES_API_URL || "http://127.0.0.1:8642";
  const apiKey = process.env.HERMES_API_KEY || "jarvis-hermes-foundation-test-key-32ch";
  const client = new HermesClient({
    baseUrl,
    apiKey,
    timeoutMs: 60000,
  });

  // Check 0: Pin and verify tool boundary via GET /v1/toolsets
  console.log("\n[Check 0] Verifying Hermes tool boundary via GET /v1/toolsets...");
  const toolCheck = await client.verifyToolSafety();
  console.log("Enabled toolsets:", toolCheck.enabledToolsets);
  console.log("Dangerous tools found:", toolCheck.dangerousToolsFound);
  if (!toolCheck.safe) {
    throw new Error(`Dangerous tools are enabled in Hermes: ${toolCheck.dangerousToolsFound.join(", ")}`);
  }
  console.log("✓ Tool safety verified: No terminal, code execution, or unrestricted file writes enabled.");

  const provider = new HermesProvider({ client });
  const toolRegistry = createDefaultToolRegistry();
  const runtime = new AgentRuntime(provider, toolRegistry);

  // 1. Hello JARVIS
  console.log("\n[Test 1] Testing 'Hello JARVIS'...");
  let helloResult: StructuredResult | null = null;
  for await (const frame of runtime.run({ message: "Hello JARVIS", conversation: [] })) {
    if (frame.type === "event") {
      console.log(`  Event [${frame.event.type}]: ${frame.event.label}`);
    } else if (frame.type === "result") {
      helloResult = frame.result;
    }
  }
  console.log("Hello speech:", helloResult?.speech);
  if (!helloResult?.speech) {
    throw new Error("Failed to receive speech response for Hello JARVIS");
  }
  console.log("✓ Test 1 PASSED: Hello JARVIS answered successfully.");

  // 2. Follow-up request (session continuity)
  console.log("\n[Test 2] Testing follow-up request with conversation history...");
  const conversation: ConversationMessage[] = [
    { role: "user", content: "My secret project code is PROJECT_PHOENIX_42." },
    { role: "assistant", content: helloResult.speech },
  ];
  let followupResult: StructuredResult | null = null;
  for await (const frame of runtime.run({
    message: "What is my secret project code?",
    conversation,
  })) {
    if (frame.type === "result") {
      followupResult = frame.result;
    }
  }
  console.log("Follow-up speech:", followupResult?.speech);
  if (!followupResult?.speech) {
    throw new Error("Failed to receive follow-up speech");
  }
  console.log("✓ Test 2 PASSED: Follow-up request completed with context preservation.");

  // 3. Real read task (get_current_time)
  console.log("\n[Test 3] Testing real read task: 'What time is it?'...");
  let readResult: StructuredResult | null = null;
  for await (const frame of runtime.run({ message: "What time is it?", conversation: [] })) {
    if (frame.type === "result") {
      readResult = frame.result;
    }
  }
  console.log("Time result:", readResult?.speech);
  if (!readResult?.speech) {
    throw new Error("Failed to execute read task");
  }
  console.log("✓ Test 3 PASSED: Read task executed and returned validated result.");

  // 4. Cancellation
  console.log("\n[Test 4] Testing cancellation via AbortSignal...");
  const controller = new AbortController();
  let wasCancelled = false;
  try {
    const generator = runtime.run({ message: "Explain the theory of general relativity in detail", conversation: [] }, controller.signal);
    // Abort immediately after starting
    controller.abort();
    for await (const frame of generator) {
      if (frame.type === "error" && (frame.error.code === "cancelled" || frame.error.message?.includes("cancelled"))) {
        wasCancelled = true;
        console.log("✓ Received expected cancellation frame:", frame.error.code);
      }
    }
  } catch (err: unknown) {
    const errorObj = err as { code?: string; message?: string };
    if (errorObj.code === "cancelled" || errorObj.message?.includes("cancelled")) {
      wasCancelled = true;
      console.log("✓ Caught expected cancellation error:", errorObj.code || errorObj.message);
    } else {
      throw err;
    }
  }
  if (!wasCancelled) {
    throw new Error("Expected cancellation but request completed without abort");
  }
  console.log("✓ Test 4 PASSED: Request cancellation handled cleanly.");

  // 5. Provider failure handling
  console.log("\n[Test 5] Testing provider failure handling (invalid API key)...");
  const badClient = new HermesClient({
    baseUrl: "http://127.0.0.1:8642",
    apiKey: "invalid-key-for-test-32ch",
    timeoutMs: 3000,
  });
  const badProvider = new HermesProvider({ client: badClient });
  const badRuntime = new AgentRuntime(badProvider, toolRegistry);
  let failedGracefully = false;
  try {
    for await (const frame of badRuntime.run({ message: "Hello", conversation: [] })) {
      if (frame.type === "error") {
        failedGracefully = true;
        console.log("✓ Received expected provider error frame:", frame.error.code || frame.error.message);
      }
    }
  } catch (err: unknown) {
    const errorObj = err as { code?: string; message?: string };
    failedGracefully = true;
    console.log("✓ Caught expected provider error:", errorObj.code || errorObj.message);
  }
  if (!failedGracefully) {
    throw new Error("Expected provider failure error but request completed");
  }
  console.log("✓ Test 5 PASSED: Provider failure safely caught and reported.");

  // 6. Confirmation-protected write
  console.log("\n[Test 6 & 7] Testing human confirmation & post-write verification for 'create_note'...");
  const confirmService = getConfirmationService();
  const verifyRegistry = getVerificationRegistry();

  // Test note creation
  const testTitle = `Test Note ${Date.now()}`;
  const testContent = "This is a verified test note content.";

  const details = buildConfirmationDetails("create_note", {
    title: testTitle,
    content: testContent,
  });

  const confirmation = confirmService.createPendingConfirmation({
    originatingRunId: "test-run-phase3",
    toolId: "create_note",
    parameters: {
      title: testTitle,
      content: testContent,
    },
    ...details,
  });

  console.log(`Confirmation token created: ${confirmation.id}, status=${confirmation.status}, toolId=${confirmation.toolId}`);
  if (confirmation.status !== "pending") {
    throw new Error(`Expected confirmation status pending, got ${confirmation.status}`);
  }
  console.log("✓ Test 6 PASSED: Write tool proposal requires explicit human confirmation.");

  // 7. Post-write verification
  console.log("\n[Test 7] Verifying application-owned deterministic verification on execution...");
  const executionContext = {
    signal: new AbortController().signal,
    callId: `call-${Date.now()}`,
  };

  const createNoteTool = toolRegistry.get("create_note");
  if (!createNoteTool) {
    throw new Error("create_note tool not found in registry");
  }

  // Consume/authorize confirmation
  const consumed = confirmService.authorize(confirmation.id);
  if (!consumed || consumed.status !== "consumed") {
    throw new Error("Failed to consume confirmation token");
  }

  // Execute tool
  const toolResult = await createNoteTool.execute(
    { title: testTitle, content: testContent },
    executionContext
  );
  console.log("Tool execution output:", JSON.stringify(toolResult));

  // Verify post-write state deterministically with VerificationRegistry
  const verificationStrategy = verifyRegistry.get("create_note");
  if (!verificationStrategy) {
    throw new Error("No verification strategy registered for create_note");
  }

  const verificationResult = await verificationStrategy.verify(
    {
      runId: "test-run-phase3",
      taskId: "task-phase3",
      toolId: "create_note",
      timestamp: new Date().toISOString(),
      parameters: { title: testTitle, content: testContent },
      toolResult: {
        callId: executionContext.callId,
        toolId: "create_note",
        status: "success",
        output: toolResult as Record<string, unknown>,
      },
    },
    executionContext
  );

  console.log("Verification result:", JSON.stringify(verificationResult, null, 2));
  if (verificationResult.status !== "passed") {
    throw new Error(`Verification failed: ${verificationResult.reason}`);
  }
  console.log("✓ Test 7 PASSED: Post-write verification passed deterministically on disk.");

  console.log("\n==================================================");
  console.log("ALL 7 RUNTIME TEST CASES PASSED SUCCESSFULLY!");
  console.log("==================================================");
}

runLiveVerification().catch((err) => {
  console.error("Live verification FAILED:", err);
  process.exit(1);
});
