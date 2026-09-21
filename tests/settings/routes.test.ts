import { describe, expect, it, vi, afterEach } from "vitest";
import { GET as getSnapshot } from "@/app/api/settings/snapshot/route";
import { POST as testHermes } from "@/app/api/settings/hermes/test/route";
import { POST as testGateway } from "@/app/api/settings/gateway/test/route";
import { POST as saveKey } from "@/app/api/settings/gateway/key/route";

describe("Settings API Routes", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("GET /api/settings/snapshot returns valid snapshot envelope", async () => {
    const response = await getSnapshot();
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty("hermes");
    expect(data).toHaveProperty("gateway");
    expect(data).toHaveProperty("providers");
    expect(data).toHaveProperty("revision");
  });

  it("POST /api/settings/hermes/test returns probe result", async () => {
    const response = await testHermes();
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty("success");
    expect(data).toHaveProperty("message");
  });

  it("POST /api/settings/gateway/test returns gateway probe result", async () => {
    const response = await testGateway();
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty("success");
    expect(data).toHaveProperty("message");
  });

  it("POST /api/settings/gateway/key saves key without echoing it back", async () => {
    const secret = "gsk_super_secret_test_key";
    const req = new Request("http://localhost/api/settings/gateway/key", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        platform: "groq",
        key: secret,
        label: "test",
      }),
    });

    const response = await saveKey(req);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);

    // CRITICAL SECURITY ASSERTION: Response MUST NOT contain the secret!
    const responseText = JSON.stringify(data);
    expect(responseText).not.toContain(secret);
  });

  it("POST /api/settings/gateway/key rejects invalid request with HTTP 400", async () => {
    const req = new Request("http://localhost/api/settings/gateway/key", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        platform: "",
        key: "",
      }),
    });

    const response = await saveKey(req);
    expect(response.status).toBe(400);
  });
});
