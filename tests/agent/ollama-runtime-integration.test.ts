import { describe, expect, it, vi, beforeEach } from "vitest";
import { AgentRuntime } from "@/lib/agent/runtime";
import { OllamaProvider } from "@/lib/agent/providers/ollama-provider";
import type { OllamaTransport } from "@/lib/agent/providers/ollama-transport";
import { MemoryService } from "@/lib/memory/service";

const validDirectResult = JSON.stringify({
  speech: "Your request is complete.",
  title: "Operation Complete",
  state: "complete",
  cards: [
    {
      id: "resp_1",
      type: "generic",
      label: "Result",
      title: "Success",
      body: "Completed cleanly.",
    },
  ],
  sources: [],
});

describe("OllamaProvider within AgentRuntime", () => {
  let memoryService: MemoryService;

  beforeEach(() => {
    memoryService = new MemoryService({ dbPath: ":memory:" });
  });

  it("completes a direct conversation turn via OllamaProvider", async () => {
    const mockTransport: OllamaTransport = {
      listModels: vi.fn(async () => ["llama3.2:latest"]),
      chat: vi.fn(async () => ({
        model: "llama3.2:latest",
        message: { role: "assistant" as const, content: validDirectResult },
        done: true,
      })),
    };

    const provider = new OllamaProvider(mockTransport, () => ({
      baseUrl: "http://localhost:11434",
      model: "llama3.2:latest",
      timeoutMs: 5000,
    }));

    const runtime = new AgentRuntime(provider, undefined, undefined, memoryService);
    const frames = [];
    for await (const frame of runtime.run(
      { message: "Hello Jarvis.", conversation: [] },
      new AbortController().signal
    )) {
      frames.push(frame);
    }

    const resultFrame = frames.find((f) => f.type === "result");
    expect(resultFrame).toBeDefined();
    if (resultFrame?.type === "result") {
      expect(resultFrame.result.speech).toBe("Your request is complete.");
      expect(resultFrame.meta.provider).toBe("Ollama");
    }
  });

  it("executes multi-turn tool call loop (Turn 1 tool call -> execution -> Turn 2 synthesis)", async () => {
    let callCount = 0;
    const mockTransport: OllamaTransport = {
      listModels: vi.fn(async () => ["llama3.2:latest"]),
      chat: vi.fn(async () => {
        callCount++;
        if (callCount === 1) {
          return {
            model: "llama3.2:latest",
            message: {
              role: "assistant" as const,
              content: "",
              tool_calls: [
                {
                  id: "call_time_1",
                  function: {
                    name: "get_current_time",
                    arguments: {},
                  },
                },
              ],
            },
            done: true,
          };
        }
        return {
          model: "llama3.2:latest",
          message: { role: "assistant" as const, content: validDirectResult },
          done: true,
        };
      }),
    };

    const provider = new OllamaProvider(mockTransport, () => ({
      baseUrl: "http://localhost:11434",
      model: "llama3.2:latest",
      timeoutMs: 5000,
    }));

    const runtime = new AgentRuntime(provider, undefined, undefined, memoryService);
    const frames = [];
    for await (const frame of runtime.run(
      { message: "What time is it?", conversation: [] },
      new AbortController().signal
    )) {
      frames.push(frame);
    }

    expect(callCount).toBe(2);
    const toolEvent = frames.find(
      (f) => f.type === "event" && f.event.type === "tool_completed"
    );
    expect(toolEvent).toBeDefined();

    const resultFrame = frames.find((f) => f.type === "result");
    expect(resultFrame).toBeDefined();
  });

  it("blocks create_note under write barrier when called via OllamaProvider", async () => {
    const mockTransport: OllamaTransport = {
      listModels: vi.fn(async () => ["llama3.2:latest"]),
      chat: vi.fn(async () => ({
        model: "llama3.2:latest",
        message: {
          role: "assistant" as const,
          content: "",
          tool_calls: [
            {
              id: "call_note_1",
              function: {
                name: "create_note",
                arguments: { title: "Test", content: "Hello" },
              },
            },
          ],
        },
        done: true,
      })),
    };

    const provider = new OllamaProvider(mockTransport, () => ({
      baseUrl: "http://localhost:11434",
      model: "llama3.2:latest",
      timeoutMs: 5000,
    }));

    const runtime = new AgentRuntime(provider, undefined, undefined, memoryService);
    const frames = [];
    for await (const frame of runtime.run(
      { message: "Create a note for me.", conversation: [] },
      new AbortController().signal
    )) {
      frames.push(frame);
    }

    const failedEvent = frames.find(
      (f) =>
        f.type === "event" &&
        f.event.type === "tool_failed" &&
        f.event.label.includes('Permission "write" denied')
    );
    expect(failedEvent).toBeDefined();
  });

  it("enforces memory authorization policy when Ollama attempts store_memory on casual chat", async () => {
    const mockTransport: OllamaTransport = {
      listModels: vi.fn(async () => ["llama3.2:latest"]),
      chat: vi.fn(async () => ({
        model: "llama3.2:latest",
        message: {
          role: "assistant" as const,
          content: "",
          tool_calls: [
            {
              id: "call_store_1",
              function: {
                name: "store_memory",
                arguments: { content: "The meeting was long" },
              },
            },
          ],
        },
        done: true,
      })),
    };

    const provider = new OllamaProvider(mockTransport, () => ({
      baseUrl: "http://localhost:11434",
      model: "llama3.2:latest",
      timeoutMs: 5000,
    }));

    const runtime = new AgentRuntime(provider, undefined, undefined, memoryService);
    const frames = [];
    for await (const frame of runtime.run(
      { message: "The meeting was long today.", conversation: [] },
      new AbortController().signal
    )) {
      frames.push(frame);
    }

    const failedEvent = frames.find(
      (f) =>
        f.type === "event" &&
        f.event.type === "tool_failed" &&
        f.event.label.includes("Memory persistence denied")
    );
    expect(failedEvent).toBeDefined();
  });
});
