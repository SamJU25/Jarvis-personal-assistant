import { describe, expect, it, vi, afterEach } from "vitest";
import { FetchOllamaTransport } from "@/lib/agent/providers/ollama-transport";

describe("FetchOllamaTransport", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("lists models from /api/tags correctly", async () => {
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

    const transport = new FetchOllamaTransport(() => ({
      baseUrl: "http://localhost:11434",
      timeoutMs: 5000,
    }));

    const models = await transport.listModels();
    expect(models).toEqual(["llama3.2:latest", "qwen2.5:7b"]);
  });

  it("sends chat request and parses response", async () => {
    let capturedUrl = "";
    let capturedBody = "";

    vi.stubGlobal(
      "fetch",
      vi.fn((url, init) => {
        capturedUrl = String(url);
        capturedBody = String(init?.body);
        return Promise.resolve(
          new Response(
            JSON.stringify({
              model: "llama3.2:latest",
              message: { role: "assistant", content: "Hello from Ollama." },
              done: true,
              total_duration: 50_000_000,
              prompt_eval_count: 12,
              eval_count: 8,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        );
      })
    );

    const transport = new FetchOllamaTransport(() => ({
      baseUrl: "http://localhost:11434",
      timeoutMs: 5000,
    }));

    const response = await transport.chat({
      model: "llama3.2:latest",
      messages: [{ role: "user", content: "Hello" }],
      stream: false,
    });

    expect(capturedUrl).toBe("http://localhost:11434/api/chat");
    expect(JSON.parse(capturedBody)).toMatchObject({
      model: "llama3.2:latest",
      stream: false,
      messages: [{ role: "user", content: "Hello" }],
    });
    expect(response.message.content).toBe("Hello from Ollama.");
    expect(response.total_duration).toBe(50_000_000);
  });

  it("maps connection failure to unavailable error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("fetch failed: ECONNREFUSED")))
    );

    const transport = new FetchOllamaTransport(() => ({
      baseUrl: "http://localhost:11434",
      timeoutMs: 5000,
    }));

    await expect(
      transport.chat({
        model: "llama3.2:latest",
        messages: [{ role: "user", content: "Hello" }],
      })
    ).rejects.toThrow("reasoning provider is unavailable");
  });

  it("handles abort cancellation", async () => {
    const controller = new AbortController();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url, init) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => {
              reject(new DOMException("Aborted", "AbortError"));
            });
          })
      )
    );

    const transport = new FetchOllamaTransport(() => ({
      baseUrl: "http://localhost:11434",
      timeoutMs: 5000,
    }));

    const promise = transport.chat(
      {
        model: "llama3.2:latest",
        messages: [{ role: "user", content: "Hello" }],
      },
      controller.signal
    );

    controller.abort();
    await expect(promise).rejects.toThrow("cancelled");
  });
});
