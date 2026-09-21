import { describe, expect, it, vi, afterEach } from "vitest";
import {
  readOllamaConfig,
  validateOllamaBaseUrl,
  checkOllamaStatus,
} from "@/lib/agent/providers/ollama-config";

describe("ollama config & validation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("provides sensible default configuration", () => {
    const config = readOllamaConfig({});
    expect(config.baseUrl).toBe("http://localhost:11434");
    expect(config.model).toBeUndefined();
    expect(config.timeoutMs).toBe(60_000);
  });

  it("normalizes and validates custom base URLs", () => {
    expect(validateOllamaBaseUrl("http://127.0.0.1:11434/")).toBe("http://127.0.0.1:11434");
    expect(validateOllamaBaseUrl("https://local.ai:8080///")).toBe("https://local.ai:8080");
    expect(() => validateOllamaBaseUrl("ftp://localhost:11434")).toThrow();
    expect(() => validateOllamaBaseUrl("not-a-url")).toThrow();
    expect(() => validateOllamaBaseUrl("")).toThrow();
  });

  it("reads explicit environment overrides", () => {
    const config = readOllamaConfig({
      JARVIS_OLLAMA_BASE_URL: "http://192.168.1.10:11434",
      JARVIS_OLLAMA_MODEL: "llama3.2:3b",
      JARVIS_AGENT_TIMEOUT_MS: "30000",
    });
    expect(config.baseUrl).toBe("http://192.168.1.10:11434");
    expect(config.model).toBe("llama3.2:3b");
    expect(config.timeoutMs).toBe(30_000);
  });

  it("reports Available when Ollama responds with models", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              models: [{ name: "llama3.2:latest" }, { name: "qwen2.5:7b" }],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        )
      )
    );

    const status = await checkOllamaStatus(
      { baseUrl: "http://localhost:11434", model: "llama3.2:latest" },
      {}
    );
    expect(status.status).toBe("Available");
    expect(status.configured).toBe(true);
    expect(status.model).toBe("llama3.2:latest");
    expect(status.availableModels).toContain("llama3.2:latest");
  });

  it("reports Model unavailable when configured model is not installed", async () => {
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

    const status = await checkOllamaStatus(
      { baseUrl: "http://localhost:11434", model: "llama3.2" },
      {}
    );
    expect(status.status).toBe("Model unavailable");
    expect(status.configured).toBe(true);
    expect(status.availableModels).toEqual(["mistral:7b"]);
  });

  it("reports Model unavailable when no models are installed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ models: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        )
      )
    );

    const status = await checkOllamaStatus({ baseUrl: "http://localhost:11434" }, {});
    expect(status.status).toBe("Model unavailable");
    expect(status.availableModels).toEqual([]);
  });

  it("reports Unavailable on connection failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("fetch failed: ECONNREFUSED")))
    );

    const status = await checkOllamaStatus({ baseUrl: "http://localhost:11434" }, {});
    expect(status.status).toBe("Unavailable");
    expect(status.configured).toBe(true);
  });

  it("reports Invalid configuration for invalid URLs", async () => {
    const status = await checkOllamaStatus({ baseUrl: "invalid://url" }, {});
    expect(status.status).toBe("Invalid configuration");
    expect(status.configured).toBe(false);
  });
});
