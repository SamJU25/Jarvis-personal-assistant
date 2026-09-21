import { describe, expect, it, beforeEach, vi, afterEach } from "vitest";
import {
  getActiveProviderId,
  setActiveProviderId,
  getActiveOllamaModel,
  setActiveOllamaModel,
  getActiveProvider,
  resetActiveProvider,
} from "@/lib/agent/providers/active-provider";
import { GET, POST } from "@/app/api/agent/provider/route";

describe("Provider Selection & Management", () => {
  beforeEach(() => {
    resetActiveProvider();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetActiveProvider();
  });

  it("defaults to hermes provider", () => {
    expect(getActiveProviderId()).toBe("hermes");
    const provider = getActiveProvider();
    expect(provider.id).toBe("hermes");
    expect(provider.name).toBe("Hermes");
  });

  it("switches to ollama provider and back", () => {
    setActiveProviderId("ollama");
    expect(getActiveProviderId()).toBe("ollama");
    const ollamaProvider = getActiveProvider();
    expect(ollamaProvider.id).toBe("ollama");
    expect(ollamaProvider.name).toBe("Ollama");

    setActiveProviderId("command-code");
    expect(getActiveProviderId()).toBe("command-code");
    const ccProvider = getActiveProvider();
    expect(ccProvider.id).toBe("command-code");
  });

  it("rejects invalid provider IDs", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => setActiveProviderId("invalid" as any)).toThrow("Invalid provider ID");
  });

  it("sets active ollama model", () => {
    setActiveOllamaModel("qwen2.5:7b");
    expect(getActiveOllamaModel()).toBe("qwen2.5:7b");
  });

  it("handles GET /api/agent/provider", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.activeProviderId).toBe("hermes");
    expect(data.status).toBeDefined();
  });

  it("handles POST /api/agent/provider switching to ollama with discovered model", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              models: [{ name: "llama3.2:latest" }],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        )
      )
    );

    const req = new Request("http://localhost:3000/api/agent/provider", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "ollama", model: "llama3.2:latest" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.activeProviderId).toBe("ollama");
    expect(data.activeModel).toBe("llama3.2:latest");
  });

  it("rejects non-installed model when Ollama responds with other models", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              models: [{ name: "mistral:7b" }],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        )
      )
    );

    const req = new Request("http://localhost:3000/api/agent/provider", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "ollama", model: "nonexistent-model" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("is not installed locally");
  });
});
