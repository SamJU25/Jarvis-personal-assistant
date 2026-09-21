import { HermesClient, HermesAuthError } from "../src/lib/hermes";

async function main() {
  console.log("=== JARVIS HermesClient Live Verification ===");

  const testKey = "jarvis-hermes-foundation-test-key-32ch";
  const client = new HermesClient({
    baseUrl: "http://127.0.0.1:8642",
    apiKey: testKey,
    timeoutMs: 5000,
  });

  // 1. Unauthenticated Health Check
  console.log("\n1. Testing GET /health (unauthenticated)...");
  const health = await client.getHealth();
  console.log("Health Response:", JSON.stringify(health, null, 2));
  if (health.status !== "ok" || health.platform !== "hermes-agent") {
    throw new Error(`Unexpected health status: ${JSON.stringify(health)}`);
  }
  console.log("✓ GET /health PASSED");

  // 2. Authenticated Detailed Health
  console.log("\n2. Testing GET /health/detailed (Bearer auth)...");
  const detailed = await client.getDetailedHealth();
  console.log("Detailed Health Response:", JSON.stringify(detailed, null, 2));
  if (!detailed.platform || detailed.platform !== "hermes-agent") {
    throw new Error(`Unexpected detailed health: ${JSON.stringify(detailed)}`);
  }
  console.log("✓ GET /health/detailed PASSED");

  // 3. Authenticated Capabilities
  console.log("\n3. Testing GET /v1/capabilities...");
  const capabilities = await client.getCapabilities();
  console.log("Capabilities Response:", JSON.stringify(capabilities, null, 2));
  if (capabilities.object !== "hermes.api_server.capabilities") {
    throw new Error(`Unexpected capabilities: ${JSON.stringify(capabilities)}`);
  }
  console.log("✓ GET /v1/capabilities PASSED");

  // 4. Negative Test: Wrong API key must return 401
  console.log("\n4. Testing GET /health/detailed with wrong API key...");
  const badClient = new HermesClient({
    baseUrl: "http://127.0.0.1:8642",
    apiKey: "wrong-invalid-key-32ch",
    timeoutMs: 5000,
  });

  try {
    await badClient.getDetailedHealth();
    throw new Error("Expected HermesAuthError but request succeeded!");
  } catch (err) {
    if (err instanceof HermesAuthError) {
      console.log(`✓ Caught expected HermesAuthError: status=${err.status}, message="${err.message}"`);
    } else {
      throw err;
    }
  }

  console.log("\n=== ALL REAL HERMES LIVE CHECKS PASSED SUCCESSFULLY ===");
}

main().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
