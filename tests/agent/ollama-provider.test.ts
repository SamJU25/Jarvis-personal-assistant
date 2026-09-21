import { describe, expect, it, vi } from "vitest";
import { OllamaProvider } from "@/lib/agent/providers/ollama-provider";
import type { OllamaTransport, OllamaChatResponse } from "@/lib/agent/providers/ollama-transport";
import type { AgentRequest } from "@/lib/contracts/provider";

const validStructured = JSON.stringify({
  speech: "Hello from Ollama.",
  title: "Greeting",
  state: "complete",
  cards: [
    {
      id: "response",
      type: "generic",
      label: "Response",
      title: "Hello",
      body: "Ready to assist.",
    },
  ],
  sources: [],
});

const defaultRequest: AgentRequest = {
  requestId: "run-ollama-1",
  request: "Hello Jarvis.",
  conversation: [],
  systemInstructions: "You are JARVIS reasoning provider.",
  availableTools: [],
  availableSkills: [],
  requiredOutput: "json",
  signal: new AbortController().signal,
};

function createMockTransport(
  chatResponse: OllamaChatResponse,
  models: string[] = ["llama3.2:latest"]
): OllamaTransport {
  return {
    listModels: vi.fn(async () => models),
    chat: vi.fn(async () => chatResponse),
  };
}

describe("OllamaProvider", () => {
  it("normalizes events and parses valid direct StructuredResult", async () => {
    const mockTransport = createMockTransport({
      model: "llama3.2:latest",
      message: { role: "assistant", content: validStructured },
      done: true,
      total_duration: 35_000_000,
      prompt_eval_count: 20,
      eval_count: 15,
    });

    const provider = new OllamaProvider(mockTransport, () => ({
      baseUrl: "http://localhost:11434",
      model: "llama3.2:latest",
      timeoutMs: 5000,
    }));

    const run = await provider.runAgent(defaultRequest);
    const events: string[] = [];
    for await (const ev of run.events) {
      events.push(ev.type);
    }
    const output = await run.result;

    expect(events).toEqual(["agent_started", "agent_synthesizing", "response_ready"]);
    expect(output.decision.type).toBe("direct");
    expect(output.result?.speech).toBe("Hello from Ollama.");
    expect(output.meta).toMatchObject({
      provider: "Ollama",
      model: "llama3.2:latest",
      durationMs: 35,
      usage: { inputTokens: 20, outputTokens: 15 },
    });
  });

  it("handles Markdown fences around JSON response", async () => {
    const fencedContent = `\`\`\`json\n${validStructured}\n\`\`\``;
    const mockTransport = createMockTransport({
      model: "llama3.2:latest",
      message: { role: "assistant", content: fencedContent },
      done: true,
      total_duration: 10_000_000,
    });

    const provider = new OllamaProvider(mockTransport, () => ({
      baseUrl: "http://localhost:11434",
      model: "llama3.2:latest",
      timeoutMs: 5000,
    }));

    const run = await provider.runAgent(defaultRequest);
    const output = await run.result;
    expect(output.decision.type).toBe("direct");
    expect(output.result?.title).toBe("Greeting");
  });

  it("normalizes native Ollama tool_calls into AgentDecision", async () => {
    const mockTransport = createMockTransport({
      model: "llama3.2:latest",
      message: {
        role: "assistant",
        content: "",
        tool_calls: [
          {
            id: "call_search_1",
            function: {
              name: "search_vault",
              arguments: { query: "DeepSeek" },
            },
          },
        ],
      },
      done: true,
      total_duration: 25_000_000,
    });

    const provider = new OllamaProvider(mockTransport, () => ({
      baseUrl: "http://localhost:11434",
      model: "llama3.2:latest",
      timeoutMs: 5000,
    }));

    const requestWithTools: AgentRequest = {
      ...defaultRequest,
      availableTools: [
        {
          id: "search_vault",
          name: "Search Vault",
          description: "Search notes",
          permission: "read",
          parameters: { query: { type: "string" } },
        },
      ],
    };

    const run = await provider.runAgent(requestWithTools);
    const events: string[] = [];
    for await (const ev of run.events) {
      events.push(ev.type);
    }
    const output = await run.result;

    expect(events).toEqual(["agent_started", "agent_synthesizing"]);
    expect(output.decision.type).toBe("tool_call");
    if (output.decision.type === "tool_call") {
      expect(output.decision.request.toolId).toBe("search_vault");
      expect(output.decision.request.arguments).toEqual({ query: "DeepSeek" });
    }
  });

  it("normalizes text-based JSON tool_call", async () => {
    const toolCallJson = JSON.stringify({
      type: "tool_call",
      callId: "call_txt_1",
      toolId: "get_current_time",
      arguments: {},
    });

    const mockTransport = createMockTransport({
      model: "llama3.2:latest",
      message: { role: "assistant", content: toolCallJson },
      done: true,
      total_duration: 15_000_000,
    });

    const provider = new OllamaProvider(mockTransport, () => ({
      baseUrl: "http://localhost:11434",
      model: "llama3.2:latest",
      timeoutMs: 5000,
    }));

    const run = await provider.runAgent(defaultRequest);
    const output = await run.result;
    expect(output.decision.type).toBe("tool_call");
    if (output.decision.type === "tool_call") {
      expect(output.decision.request.toolId).toBe("get_current_time");
    }
  });

  it("rejects malformed non-JSON output", async () => {
    const mockTransport = createMockTransport({
      model: "llama3.2:latest",
      message: { role: "assistant", content: "I am unable to answer in JSON." },
      done: true,
    });

    const provider = new OllamaProvider(mockTransport, () => ({
      baseUrl: "http://localhost:11434",
      model: "llama3.2:latest",
      timeoutMs: 5000,
    }));

    const run = await provider.runAgent(defaultRequest);
    await expect(run.result).rejects.toThrow("safely validated");
  });

  it("rejects empty assistant responses", async () => {
    const mockTransport = createMockTransport({
      model: "llama3.2:latest",
      message: { role: "assistant", content: "" },
      done: true,
    });

    const provider = new OllamaProvider(mockTransport, () => ({
      baseUrl: "http://localhost:11434",
      model: "llama3.2:latest",
      timeoutMs: 5000,
    }));

    const run = await provider.runAgent(defaultRequest);
    await expect(run.result).rejects.toThrow("returned no response");
  });

  it("auto-detects first model if none explicitly configured", async () => {
    const mockTransport = createMockTransport(
      {
        model: "qwen2.5:7b",
        message: { role: "assistant", content: validStructured },
        done: true,
      },
      ["qwen2.5:7b", "llama3.2:latest"]
    );

    const provider = new OllamaProvider(mockTransport, () => ({
      baseUrl: "http://localhost:11434",
      timeoutMs: 5000,
    }));

    const run = await provider.runAgent(defaultRequest);
    const output = await run.result;
    expect(output.meta.model).toBe("qwen2.5:7b");
  });

  it("strips trailing <tool_call|> and special tokens from valid JSON response", async () => {
    const withSpecialTokens = `${validStructured}<tool_call|>`;
    const mockTransport = createMockTransport({
      model: "qwen3.5:4b",
      message: { role: "assistant", content: withSpecialTokens },
      done: true,
    });

    const provider = new OllamaProvider(mockTransport, () => ({
      baseUrl: "http://localhost:11434",
      model: "qwen3.5:4b",
      timeoutMs: 5000,
    }));

    const run = await provider.runAgent(defaultRequest);
    const output = await run.result;
    expect(output.decision.type).toBe("direct");
    expect(output.result?.speech).toBe("Hello from Ollama.");
  });

  it("extracts outer JSON object when surrounded by commentary or reasoning", async () => {
    const surrounded = `Here is the response:\n${validStructured}\nHope that helps!`;
    const mockTransport = createMockTransport({
      model: "qwen3.5:4b",
      message: { role: "assistant", content: surrounded },
      done: true,
    });

    const provider = new OllamaProvider(mockTransport, () => ({
      baseUrl: "http://localhost:11434",
      model: "qwen3.5:4b",
      timeoutMs: 5000,
    }));

    const run = await provider.runAgent(defaultRequest);
    const output = await run.result;
    expect(output.decision.type).toBe("direct");
    expect(output.result?.speech).toBe("Hello from Ollama.");
  });

  it("safely falls back harmless conversational plain prose to validated StructuredResult", async () => {
    const plainProse = "The capital of Bangladesh is Dhaka.";
    const mockTransport = createMockTransport({
      model: "qwen3.5:4b",
      message: { role: "assistant", content: plainProse },
      done: true,
    });

    const provider = new OllamaProvider(mockTransport, () => ({
      baseUrl: "http://localhost:11434",
      model: "qwen3.5:4b",
      timeoutMs: 5000,
    }));

    const run = await provider.runAgent(defaultRequest);
    const output = await run.result;
    expect(output.decision.type).toBe("direct");
    expect(output.result).toMatchObject({
      speech: "The capital of Bangladesh is Dhaka.",
      title: "Assistant Response",
      state: "complete",
      cards: [],
      sources: [],
    });
  });

  it("strictly rejects malformed JSON with invalid state", async () => {
    const invalidStateJson = JSON.stringify({
      speech: "Hello.",
      title: "Test",
      state: "banana_invalid_state",
      cards: [],
      sources: [],
    });
    const mockTransport = createMockTransport({
      model: "qwen3.5:4b",
      message: { role: "assistant", content: invalidStateJson },
      done: true,
    });

    const provider = new OllamaProvider(mockTransport, () => ({
      baseUrl: "http://localhost:11434",
      model: "qwen3.5:4b",
      timeoutMs: 5000,
    }));

    const run = await provider.runAgent(defaultRequest);
    await expect(run.result).rejects.toThrow("safely validated");
  });

  it("strictly rejects plain text containing unsafe HTML tags", async () => {
    const unsafeHtml = "Hello <script>alert('xss')</script> world";
    const mockTransport = createMockTransport({
      model: "qwen3.5:4b",
      message: { role: "assistant", content: unsafeHtml },
      done: true,
    });

    const provider = new OllamaProvider(mockTransport, () => ({
      baseUrl: "http://localhost:11434",
      model: "qwen3.5:4b",
      timeoutMs: 5000,
    }));

    const run = await provider.runAgent(defaultRequest);
    await expect(run.result).rejects.toThrow("safely validated");
  });

  it("strictly rejects plain text attempting to execute tool commands", async () => {
    const unsafeCommand = "Please run this: tool_call: search_vault(query='secret')";
    const mockTransport = createMockTransport({
      model: "qwen3.5:4b",
      message: { role: "assistant", content: unsafeCommand },
      done: true,
    });

    const provider = new OllamaProvider(mockTransport, () => ({
      baseUrl: "http://localhost:11434",
      model: "qwen3.5:4b",
      timeoutMs: 5000,
    }));

    const run = await provider.runAgent(defaultRequest);
    await expect(run.result).rejects.toThrow("safely validated");
  });

  it("strictly rejects oversized responses (>64,000 chars)", async () => {
    const oversized = "a".repeat(65_000);
    const mockTransport = createMockTransport({
      model: "qwen3.5:4b",
      message: { role: "assistant", content: oversized },
      done: true,
    });

    const provider = new OllamaProvider(mockTransport, () => ({
      baseUrl: "http://localhost:11434",
      model: "qwen3.5:4b",
      timeoutMs: 5000,
    }));

    const run = await provider.runAgent(defaultRequest);
    await expect(run.result).rejects.toThrow("safely validated");
  });
});
