import { beforeEach, describe, expect, it, vi } from "vitest";
import { HermesProvider } from "@/lib/agent/providers/hermes-provider";
import { HermesClient } from "@/lib/hermes/client";
import { HermesConnectionError } from "@/lib/hermes/errors";
import type { AgentRequest, AgentProvider, AgentRun } from "@/lib/contracts/provider";
import type { HermesChatCompletionResponse } from "@/lib/contracts/hermes";

const sampleRequest: AgentRequest = {
  requestId: "run-hermes-test-1",
  request: "Hello JARVIS",
  conversation: [],
  systemInstructions: "You are JARVIS assistant.",
  availableTools: [],
  availableSkills: [],
  requiredOutput: "json",
  signal: new AbortController().signal,
};

describe("HermesProvider", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("normalizes a direct structured JSON response", async () => {
    const mockChatResponse: HermesChatCompletionResponse = {
      id: "chatcmpl-test",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: JSON.stringify({
              speech: "Hello! I am online and ready.",
              title: "Greeting",
              state: "complete",
              cards: [
                {
                  id: "card-1",
                  type: "generic",
                  label: "Status",
                  title: "Ready",
                  body: "Hermes backend active",
                },
              ],
              sources: [],
            }),
          },
        },
      ],
      model: "hermes-agent",
    };

    const mockClient = {
      chatCompletion: vi.fn().mockResolvedValue(mockChatResponse),
    } as unknown as HermesClient;

    const provider = new HermesProvider({ client: mockClient });
    const run = await provider.runAgent(sampleRequest);

    const output = await run.result;
    expect(output.decision.type).toBe("direct");
    if (output.decision.type === "direct") {
      expect(output.decision.result.speech).toBe("Hello! I am online and ready.");
      expect(output.decision.result.title).toBe("Greeting");
      expect(output.decision.result.state).toBe("complete");
      expect(output.decision.result.cards).toHaveLength(1);
    }
  });

  it("normalizes conversational plain-text fallback response", async () => {
    const mockChatResponse: HermesChatCompletionResponse = {
      id: "chatcmpl-plain",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: "The capital of Bangladesh is Dhaka.",
          },
        },
      ],
      model: "hermes-agent",
    };

    const mockClient = {
      chatCompletion: vi.fn().mockResolvedValue(mockChatResponse),
    } as unknown as HermesClient;

    const provider = new HermesProvider({ client: mockClient });
    const run = await provider.runAgent(sampleRequest);

    const output = await run.result;
    expect(output.decision.type).toBe("direct");
    if (output.decision.type === "direct") {
      expect(output.decision.result.speech).toBe("The capital of Bangladesh is Dhaka.");
      expect(output.decision.result.state).toBe("complete");
    }
  });

  it("normalizes a model-proposed tool call", async () => {
    const mockChatResponse: HermesChatCompletionResponse = {
      id: "chatcmpl-tool",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "call-notes-1",
                function: {
                  name: "create_note",
                  arguments: JSON.stringify({
                    title: "Project Plan",
                    content: "Drafting the architecture.",
                  }),
                },
              },
            ],
          },
        },
      ],
      model: "hermes-agent",
    };

    const mockClient = {
      chatCompletion: vi.fn().mockResolvedValue(mockChatResponse),
    } as unknown as HermesClient;

    const provider = new HermesProvider({ client: mockClient });
    const run = await provider.runAgent(sampleRequest);

    const output = await run.result;
    expect(output.decision.type).toBe("tool_call");
    if (output.decision.type === "tool_call") {
      expect(output.decision.request.toolId).toBe("create_note");
      expect(output.decision.request.arguments).toEqual({
        title: "Project Plan",
        content: "Drafting the architecture.",
      });
    }
  });

  it("cancels execution cleanly when AbortSignal aborts", async () => {
    const controller = new AbortController();
    const abortRequest: AgentRequest = {
      ...sampleRequest,
      signal: controller.signal,
    };

    const mockClient = {
      chatCompletion: vi.fn().mockImplementation(
        (_payload, options) =>
          new Promise((_resolve, reject) => {
            options?.signal?.addEventListener("abort", () => {
              reject(new Error("Operation aborted"));
            });
          })
      ),
    } as unknown as HermesClient;

    const provider = new HermesProvider({ client: mockClient });
    const run = await provider.runAgent(abortRequest);

    controller.abort();
    const output = await run.result;
    expect(output.decision.type).toBe("direct");
    if (output.decision.type === "direct") {
      expect(output.decision.result.title).toBe("Cancelled");
    }
  });

  it("delegates to fallback provider if Hermes connection fails", async () => {
    const mockClient = {
      chatCompletion: vi.fn().mockRejectedValue(new HermesConnectionError("ECONNREFUSED")),
    } as unknown as HermesClient;

    const fallbackOutput = {
      decision: {
        type: "direct" as const,
        result: {
          speech: "Fallback response from Ollama",
          title: "Fallback",
          state: "complete" as const,
          cards: [],
          sources: [],
        },
      },
      meta: { provider: "Ollama", model: "qwen3.5:4b", durationMs: 10, requestId: "fallback-req" },
    };

    const mockFallbackRun: AgentRun = {
      events: (async function* () {
        yield {
          id: "ev-fallback",
          type: "agent_started" as const,
          timestamp: new Date().toISOString(),
          label: "Fallback started",
        };
      })(),
      result: Promise.resolve(fallbackOutput),
      cancel: vi.fn().mockResolvedValue(undefined),
    };

    const mockFallbackProvider: AgentProvider = {
      id: "ollama",
      name: "Ollama",
      runAgent: vi.fn().mockResolvedValue(mockFallbackRun),
    };

    const provider = new HermesProvider({
      client: mockClient,
      fallbackProvider: mockFallbackProvider,
    });

    const run = await provider.runAgent(sampleRequest);
    const output = await run.result;

    expect(output.decision.type).toBe("direct");
    if (output.decision.type === "direct") {
      expect(output.decision.result.speech).toBe("Fallback response from Ollama");
    }
    expect(mockFallbackProvider.runAgent).toHaveBeenCalled();
  });

  it("verifies tool safety rejecting forbidden tools", async () => {
    const mockClient = new HermesClient({ baseUrl: "http://127.0.0.1:8642" });
    vi.spyOn(mockClient, "getToolsets").mockResolvedValue({
      object: "list",
      platform: "api_server",
      data: [
        {
          name: "terminal",
          enabled: true,
          tools: ["terminal", "process_manage"],
        },
        {
          name: "web",
          enabled: true,
          tools: ["web_search", "web_extract"],
        },
      ],
    });

    const check = await mockClient.verifyToolSafety();
    expect(check.safe).toBe(false);
    expect(check.dangerousToolsFound).toContain("terminal");
  });

  it("verifies tool safety approving strictly safe tools", async () => {
    const mockClient = new HermesClient({ baseUrl: "http://127.0.0.1:8642" });
    vi.spyOn(mockClient, "getToolsets").mockResolvedValue({
      object: "list",
      platform: "api_server",
      data: [
        {
          name: "web",
          enabled: true,
          tools: ["web_search", "web_extract"],
        },
        {
          name: "clarify",
          enabled: true,
          tools: ["clarify"],
        },
      ],
    });

    const check = await mockClient.verifyToolSafety();
    expect(check.safe).toBe(true);
    expect(check.dangerousToolsFound).toHaveLength(0);
  });
});
