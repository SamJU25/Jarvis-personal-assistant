import { describe, expect, it, vi } from "vitest";
import { AgentRuntime } from "@/lib/agent/runtime";
import { OllamaProvider } from "@/lib/agent/providers/ollama-provider";
import type { OllamaTransport, OllamaChatResponse, OllamaChatPayload } from "@/lib/agent/providers/ollama-transport";
import type { StructuredResult } from "@/lib/contracts/result";
import type { AgentApiFrame } from "@/lib/contracts/agent-api";
import { ToolRegistry } from "@/lib/tools/registry";
import { z } from "zod";

function createMockTransport(handler: (req: OllamaChatPayload) => Promise<OllamaChatResponse> | OllamaChatResponse): OllamaTransport {
  return {
    listModels: vi.fn(async () => ["qwen3.5:4b"]),
    chat: vi.fn(async (req) => handler(req)),
  };
}

describe("Natural Language Robustness & General Agent Pipeline", () => {
  it("handles conversational greetings as direct structured answer", async () => {
    const mockResponse: OllamaChatResponse = {
      model: "qwen3.5:4b",
      message: {
        role: "assistant",
        content: JSON.stringify({
          speech: "Hello! How can I help you today?",
          title: "Greeting",
          state: "complete",
          cards: [],
          sources: [],
        }) + "<tool_call|>",
      },
      done: true,
    };

    const provider = new OllamaProvider(createMockTransport(() => mockResponse));
    const runtime = new AgentRuntime(provider);

    const generator = runtime.run(
      { message: "Hey Jarvis, good morning!", conversation: [] },
      new AbortController().signal
    );

    let result: StructuredResult | undefined;
    for await (const frame of generator) {
      if (frame.type === "result") result = frame.result;
    }

    expect(result).toBeDefined();
    expect(result?.speech).toBe("Hello! How can I help you today?");
    expect(result?.state).toBe("complete");
    expect(result?.cards).toEqual([]);
  });

  it("handles factual questions with trailing template artifacts", async () => {
    const mockResponse: OllamaChatResponse = {
      model: "qwen3.5:4b",
      message: {
        role: "assistant",
        content: JSON.stringify({
          speech: "The capital of Bangladesh is Dhaka.",
          title: "Capital City",
          state: "complete",
          cards: [
            {
              id: "ans-1",
              type: "generic",
              label: "Answer",
              title: "Capital of Bangladesh",
              body: "Dhaka is the capital and largest city of Bangladesh.",
            },
          ],
          sources: [],
        }) + "<tool_call|>",
      },
      done: true,
    };

    const provider = new OllamaProvider(createMockTransport(() => mockResponse));
    const runtime = new AgentRuntime(provider);

    const generator = runtime.run(
      { message: "what is the capital of bangladesh?", conversation: [] },
      new AbortController().signal
    );

    let result: StructuredResult | undefined;
    for await (const frame of generator) {
      if (frame.type === "result") result = frame.result;
    }

    expect(result?.state).toBe("complete");
    expect(result?.speech).toBe("The capital of Bangladesh is Dhaka.");
  });

  it("handles technical explanation questions seamlessly", async () => {
    const mockResponse: OllamaChatResponse = {
      model: "qwen3.5:4b",
      message: {
        role: "assistant",
        content: JSON.stringify({
          speech: "A closure in JavaScript is a function bundled together with references to its surrounding lexical environment.",
          title: "JavaScript Closures",
          state: "complete",
          cards: [],
          sources: [],
        }),
      },
      done: true,
    };

    const provider = new OllamaProvider(createMockTransport(() => mockResponse));
    const runtime = new AgentRuntime(provider);

    const generator = runtime.run(
      { message: "explain javascript closures in one sentence", conversation: [] },
      new AbortController().signal
    );

    let result: StructuredResult | undefined;
    for await (const frame of generator) {
      if (frame.type === "result") result = frame.result;
    }

    expect(result?.state).toBe("complete");
    expect(result?.speech).toContain("closure in JavaScript");
  });

  it("answers capability questions dynamically from current active tools without false claims", async () => {
    const mockResponse: OllamaChatResponse = {
      model: "qwen3.5:4b",
      message: {
        role: "assistant",
        content: JSON.stringify({
          speech: "I am JARVIS. I can search and read your Obsidian vault notes, check your Google Workspace calendar and Gmail, and manage local memory.",
          title: "Current Capabilities",
          state: "complete",
          cards: [],
          sources: [],
        }) + "<tool_call|>",
      },
      done: true,
    };

    const provider = new OllamaProvider(createMockTransport(() => mockResponse));
    const runtime = new AgentRuntime(provider);

    const generator = runtime.run(
      { message: "What can you do?", conversation: [] },
      new AbortController().signal
    );

    let result: StructuredResult | undefined;
    for await (const frame of generator) {
      if (frame.type === "result") result = frame.result;
    }

    expect(result?.state).toBe("complete");
    expect(result?.speech).toContain("Obsidian vault");
    expect(result?.speech).not.toContain("browse the live web");
    expect(result?.speech).not.toContain("edit PowerPoint");
  });

  it("supports conversational follow-up questions with context", async () => {
    const mockResponse: OllamaChatResponse = {
      model: "qwen3.5:4b",
      message: {
        role: "assistant",
        content: JSON.stringify({
          speech: "Dhaka is famous for its historic Mughal architecture like Lalbagh Fort and Ahsan Manzil.",
          title: "Dhaka Details",
          state: "complete",
          cards: [],
          sources: [],
        }),
      },
      done: true,
    };

    const transport = createMockTransport(async (req) => {
      // Verify conversation context was forwarded
      expect(req.messages).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ role: "user", content: "what is the capital of bangladesh?" }),
          expect.objectContaining({ role: "assistant", content: "The capital of Bangladesh is Dhaka." }),
        ])
      );
      return mockResponse;
    });

    const provider = new OllamaProvider(transport);
    const runtime = new AgentRuntime(provider);

    const conversation = [
      { role: "user" as const, content: "what is the capital of bangladesh?" },
      { role: "assistant" as const, content: "The capital of Bangladesh is Dhaka." },
    ];

    const generator = runtime.run(
      { message: "Tell me something interesting about it.", conversation },
      new AbortController().signal
    );

    let result: StructuredResult | undefined;
    for await (const frame of generator) {
      if (frame.type === "result") result = frame.result;
    }

    expect(result?.state).toBe("complete");
    expect(result?.speech).toContain("Dhaka is famous");
  });

  it("preserves deterministic fast-path for time queries (<150ms)", async () => {
    const provider = new OllamaProvider(
      createMockTransport(() => {
        throw new Error("Provider should not be invoked on deterministic fast-path");
      })
    );

    const runtime = new AgentRuntime(provider, undefined, undefined, undefined, undefined, undefined, {
      enableFastPath: true,
    });

    const t0 = performance.now();
    const generator = runtime.run(
      { message: "what time is it?", conversation: [] },
      new AbortController().signal
    );

    let result: StructuredResult | undefined;
    for await (const frame of generator) {
      if (frame.type === "result") result = frame.result;
    }
    const duration = performance.now() - t0;

    expect(result?.state).toBe("complete");
    expect(result?.title).toBe("Current Time");
    expect(duration).toBeLessThan(150);
  });

  it("handles tool calling and Turn 2 synthesis accurately", async () => {
    let turn = 1;
    const transport = createMockTransport(async () => {
      if (turn === 1) {
        turn = 2;
        return {
          model: "qwen3.5:4b",
          message: {
            role: "assistant",
            content: "",
            tool_calls: [
              {
                id: "call_mock_time",
                function: {
                  name: "get_current_time",
                  arguments: "{}",
                },
              },
            ],
          },
          done: true,
        };
      }
      return {
        model: "qwen3.5:4b",
        message: {
          role: "assistant",
          content: JSON.stringify({
            speech: "The current time is 2:00 PM.",
            title: "Time Check",
            state: "complete",
            cards: [],
            sources: [],
          }),
        },
        done: true,
      };
    });

    const provider = new OllamaProvider(transport);
    const registry = new ToolRegistry();
    registry.register({
      id: "get_current_time",
      name: "Current Time",
      description: "Get time",
      permission: "read",
      renderer: "generic",
      source: "system",
      inputSchema: z.object({}),
      outputSchema: z.object({ time: z.string() }),
      execute: async () => ({ time: "2:00 PM" }),
    });

    const runtime = new AgentRuntime(provider, registry, undefined, undefined, undefined, undefined, {
      enableFastPath: false,
    });

    const generator = runtime.run(
      { message: "check the time using tools", conversation: [] },
      new AbortController().signal
    );

    let result: StructuredResult | undefined;
    const events: string[] = [];
    for await (const frame of generator) {
      if (frame.type === "event") events.push(frame.event.type);
      if (frame.type === "result") result = frame.result;
    }

    expect(events).toContain("tool_requested");
    expect(events).toContain("tool_completed");
    expect(events).toContain("verification_completed");
    expect(result?.state).toBe("complete");
    expect(result?.speech).toBe("The current time is 2:00 PM.");
  });

  it("strictly rejects malformed output without false completion", async () => {
    const mockResponse: OllamaChatResponse = {
      model: "qwen3.5:4b",
      message: {
        role: "assistant",
        content: JSON.stringify({
          speech: "Invalid state response",
          title: "Bad State",
          state: "corrupted_state_value",
          cards: [],
          sources: [],
        }),
      },
      done: true,
    };

    const provider = new OllamaProvider(createMockTransport(() => mockResponse));
    const runtime = new AgentRuntime(provider);

    const generator = runtime.run(
      { message: "generate corrupted output", conversation: [] },
      new AbortController().signal
    );

    let errorFrame: Extract<AgentApiFrame, { type: "error" }> | undefined;
    for await (const frame of generator) {
      if (frame.type === "error") errorFrame = frame;
    }

    expect(errorFrame).toBeDefined();
    if (errorFrame) {
      expect(errorFrame.error.code).toBe("malformed_output");
      expect(errorFrame.error.message).toBe("The reasoning response could not be safely validated.");
    }
  });
});
