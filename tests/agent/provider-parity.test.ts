import { describe, expect, it, vi } from "vitest";
import { CommandCodeProvider } from "@/lib/agent/providers/command-code-provider";
import { OllamaProvider } from "@/lib/agent/providers/ollama-provider";
import type { CommandCodeTransport } from "@/lib/agent/transport";
import type { OllamaTransport } from "@/lib/agent/providers/ollama-transport";
import type { AgentRequest } from "@/lib/contracts/provider";

const deterministicStructured = {
  speech: "Hello, I am JARVIS.",
  title: "Greeting",
  state: "complete" as const,
  cards: [
    {
      id: "response",
      type: "generic" as const,
      label: "Response",
      title: "Hello",
      body: "Ready to assist.",
    },
  ],
  sources: [],
};

const sharedRequest: AgentRequest = {
  requestId: "parity-req-1",
  request: "Hello Jarvis.",
  conversation: [],
  systemInstructions: "You are the JARVIS reasoning provider.",
  availableTools: [
    {
      id: "get_current_time",
      name: "Get Current Time",
      description: "Returns local ISO timestamp",
      permission: "read",
      parameters: {},
    },
  ],
  availableSkills: [],
  requiredOutput: "json",
  signal: new AbortController().signal,
};

describe("Provider Parity (CommandCode vs Ollama)", () => {
  it("both providers produce equivalent normalized direct response contracts", async () => {
    // CommandCode fixture
    const commandCodeTransport: CommandCodeTransport = {
      start: vi.fn(async () => ({
        stdout: (async function* () {
          yield new TextEncoder().encode(
            JSON.stringify({
              type: "result",
              subtype: "success",
              sessionId: "private-session",
              usage: { inputTokens: 50, outputTokens: 30 },
              durationMs: 40,
              finalText: JSON.stringify(deterministicStructured),
            })
          );
        })(),
        exit: Promise.resolve(0),
        cancel: vi.fn(async () => {}),
      })),
    };

    // Ollama fixture
    const ollamaTransport: OllamaTransport = {
      listModels: vi.fn(async () => ["llama3.2:latest"]),
      chat: vi.fn(async () => ({
        model: "llama3.2:latest",
        message: {
          role: "assistant" as const,
          content: JSON.stringify(deterministicStructured),
        },
        done: true,
        total_duration: 40_000_000,
        prompt_eval_count: 50,
        eval_count: 30,
      })),
    };

    const ccProvider = new CommandCodeProvider(commandCodeTransport, () => ({
      nodeExecutable: "node",
      commandCodeEntry: "C:\\command-code\\dist\\index.mjs",
      timeoutMs: 5000,
      maxTurns: 2,
    }));

    const ollamaProvider = new OllamaProvider(ollamaTransport, () => ({
      baseUrl: "http://localhost:11434",
      model: "llama3.2:latest",
      timeoutMs: 5000,
    }));

    const ccRun = await ccProvider.runAgent(sharedRequest);
    const ollamaRun = await ollamaProvider.runAgent(sharedRequest);

    const ccEvents = [];
    for await (const ev of ccRun.events) ccEvents.push(ev.type);

    const ollamaEvents = [];
    for await (const ev of ollamaRun.events) ollamaEvents.push(ev.type);

    const ccOutput = await ccRun.result;
    const ollamaOutput = await ollamaRun.result;

    // Both generate identical public event sequences
    expect(ccEvents).toEqual(ollamaEvents);
    expect(ccEvents).toEqual(["agent_started", "agent_synthesizing", "response_ready"]);

    // Both produce type: "direct" decision with identical StructuredResult payload
    expect(ccOutput.decision.type).toBe("direct");
    expect(ollamaOutput.decision.type).toBe("direct");
    expect(ccOutput.result).toEqual(ollamaOutput.result);
    expect(ccOutput.result?.speech).toBe("Hello, I am JARVIS.");

    // Both normalize metadata cleanly
    expect(ccOutput.meta.durationMs).toBe(40);
    expect(ollamaOutput.meta.durationMs).toBe(40);
    expect(ccOutput.meta.usage).toEqual({ inputTokens: 50, outputTokens: 30 });
    expect(ollamaOutput.meta.usage).toEqual({ inputTokens: 50, outputTokens: 30 });
  });

  it("both providers produce equivalent normalized tool call contracts", async () => {
    const toolCallPayload = {
      type: "tool_call",
      callId: "call_time_1",
      toolId: "get_current_time",
      arguments: {},
    };

    // CommandCode fixture
    const commandCodeTransport: CommandCodeTransport = {
      start: vi.fn(async () => ({
        stdout: (async function* () {
          yield new TextEncoder().encode(
            JSON.stringify({
              type: "result",
              subtype: "success",
              sessionId: "private-session",
              usage: { inputTokens: 20, outputTokens: 10 },
              durationMs: 15,
              finalText: JSON.stringify(toolCallPayload),
            })
          );
        })(),
        exit: Promise.resolve(0),
        cancel: vi.fn(async () => {}),
      })),
    };

    // Ollama fixture (native tool_calls)
    const ollamaTransport: OllamaTransport = {
      listModels: vi.fn(async () => ["llama3.2:latest"]),
      chat: vi.fn(async () => ({
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
        total_duration: 15_000_000,
        prompt_eval_count: 20,
        eval_count: 10,
      })),
    };

    const ccProvider = new CommandCodeProvider(commandCodeTransport, () => ({
      nodeExecutable: "node",
      commandCodeEntry: "C:\\command-code\\dist\\index.mjs",
      timeoutMs: 5000,
      maxTurns: 2,
    }));

    const ollamaProvider = new OllamaProvider(ollamaTransport, () => ({
      baseUrl: "http://localhost:11434",
      model: "llama3.2:latest",
      timeoutMs: 5000,
    }));

    const ccRun = await ccProvider.runAgent(sharedRequest);
    const ollamaRun = await ollamaProvider.runAgent(sharedRequest);

    const ccOutput = await ccRun.result;
    const ollamaOutput = await ollamaRun.result;

    expect(ccOutput.decision.type).toBe("tool_call");
    expect(ollamaOutput.decision.type).toBe("tool_call");

    if (ccOutput.decision.type === "tool_call" && ollamaOutput.decision.type === "tool_call") {
      expect(ccOutput.decision.request.toolId).toBe(ollamaOutput.decision.request.toolId);
      expect(ccOutput.decision.request.callId).toBe(ollamaOutput.decision.request.callId);
      expect(ccOutput.decision.request.arguments).toEqual(ollamaOutput.decision.request.arguments);
    }
  });
});
