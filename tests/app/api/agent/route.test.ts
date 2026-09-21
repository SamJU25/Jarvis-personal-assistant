import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/agent/route";

function request(body: unknown) { return new Request("http://localhost/api/agent", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body), headers: { "Content-Type": "application/json" } }); }

describe("agent route", () => {
  it("rejects invalid JSON", async () => {
    expect((await POST(request("{"))).status).toBe(400);
  });

  it("rejects client provider controls", async () => {
    expect((await POST(request({ message: "Hi", conversation: [], model: "forged" }))).status).toBe(400);
  });

  it("returns an NDJSON stream for a valid request", async () => {
    const response = await POST(request({ message: "Hi", conversation: [] }));
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("application/x-ndjson");
    await response.body?.cancel();
  });
});
