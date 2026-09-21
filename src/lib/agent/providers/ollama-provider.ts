import type { AgentProvider, AgentRequest, AgentRun, AgentDecision } from "@/lib/contracts/provider";
import type { AgentEvent } from "@/lib/contracts/event";
import { AgentRuntimeError } from "@/lib/agent/errors";
import { toolCallRequestSchema } from "@/lib/contracts/tool";
import {
  structuredResultSchema,
  sourceSchema,
  resultCardSchema,
  genericCardSchema,
  type ResultCard,
} from "@/lib/contracts/result";
import { type OllamaConfig, readOllamaConfig } from "@/lib/agent/providers/ollama-config";
import {
  type OllamaTransport,
  FetchOllamaTransport,
  type OllamaChatMessage,
  type OllamaToolDefinition,
} from "@/lib/agent/providers/ollama-transport";

class EventQueue implements AsyncIterable<AgentEvent> {
  private values: AgentEvent[] = [];
  private waiting: ((value: IteratorResult<AgentEvent>) => void)[] = [];
  private done = false;

  push(value: AgentEvent) {
    const resolve = this.waiting.shift();
    if (resolve) resolve({ value, done: false });
    else this.values.push(value);
  }

  close() {
    this.done = true;
    for (const resolve of this.waiting.splice(0)) {
      resolve({ value: undefined, done: true });
    }
  }

  [Symbol.asyncIterator]() {
    return {
      next: (): Promise<IteratorResult<AgentEvent>> => {
        const value = this.values.shift();
        if (value) return Promise.resolve({ value, done: false });
        if (this.done) return Promise.resolve({ value: undefined, done: true });
        return new Promise((resolve) => this.waiting.push(resolve));
      },
    };
  }
}

export class OllamaProvider implements AgentProvider {
  readonly id = "ollama";
  readonly name = "Ollama";

  constructor(
    private readonly transport: OllamaTransport = new FetchOllamaTransport(),
    private readonly getConfig: () => OllamaConfig = () => readOllamaConfig()
  ) {}

  async runAgent(request: AgentRequest): Promise<AgentRun> {
    const config = this.getConfig();

    // Resolve model: explicit config or auto-detect first available model
    let model = config.model;
    if (!model) {
      const models = await this.transport.listModels(request.signal);
      if (models.length === 0) {
        throw new AgentRuntimeError("configuration");
      }
      model = models[0];
    }

    const abortController = new AbortController();
    const abortHandler = () => abortController.abort();
    request.signal.addEventListener("abort", abortHandler, { once: true });

    const events = new EventQueue();
    events.push(event("agent_started", "Reasoning started"));

    const startTime = Date.now();

    const result = (async () => {
      try {
        // Build messages array
        const systemContent = request.requiredOutput
          ? `${request.systemInstructions}\n\nRequired final response JSON shape:\n${request.requiredOutput}`
          : request.systemInstructions;

        const messages: OllamaChatMessage[] = [
          { role: "system", content: systemContent },
          ...request.conversation.map((msg) => ({
            role: msg.role as "user" | "assistant",
            content: msg.content,
          })),
          { role: "user", content: request.request },
        ];

        // Build tool definitions
        let tools: OllamaToolDefinition[] | undefined;
        if (request.availableTools.length > 0) {
          tools = request.availableTools.map((t) => ({
            type: "function",
            function: {
              name: t.id,
              description: t.description,
              parameters: {
                type: "object",
                properties: t.parameters,
              },
            },
          }));
        }

        const response = await this.transport.chat(
          {
            model,
            messages,
            tools,
            stream: false,
            // When no tools are provided (e.g. Turn 2), enforce JSON mode
            format: tools ? undefined : "json",
            keep_alive: config.keepAlive ?? "15m",
            think: config.think ?? false,
            options: { temperature: 0 },
          },
          abortController.signal
        );

        const durationMs =
          typeof response.total_duration === "number"
            ? Math.round(response.total_duration / 1_000_000)
            : Math.max(1, Date.now() - startTime);

        const usage = {
          inputTokens: response.prompt_eval_count ?? 0,
          outputTokens: response.eval_count ?? 0,
        };

        // Decision normalization
        events.push(event("agent_synthesizing", "Validating response"));
        const decision = normalizeOllamaDecision(response);

        if (decision.type === "direct") {
          events.push(event("response_ready", "Response ready"));
          return {
            decision,
            result: decision.result,
            meta: {
              provider: this.name,
              model,
              durationMs,
              usage,
            },
          };
        }

        return {
          decision,
          meta: {
            provider: this.name,
            model,
            durationMs,
            usage,
          },
        };
      } finally {
        request.signal.removeEventListener("abort", abortHandler);
        events.close();
      }
    })();

    return {
      events,
      result,
      cancel: async () => {
        abortController.abort();
      },
    };
  }
}

export function normalizeOllamaDecision(response: {
  message: {
    content?: string;
    tool_calls?: Array<{
      id?: string;
      function: {
        name: string;
        arguments: Record<string, unknown> | string;
      };
    }>;
  };
}): AgentDecision {
  // 1. Native tool calling path
  if (response.message.tool_calls && response.message.tool_calls.length > 0) {
    const call = response.message.tool_calls[0];
    let args: Record<string, unknown> = {};
    if (typeof call.function.arguments === "string") {
      try {
        args = JSON.parse(call.function.arguments);
      } catch {
        throw new AgentRuntimeError("malformed_output", "Failed to parse native tool call arguments as JSON");
      }
    } else if (typeof call.function.arguments === "object" && call.function.arguments !== null) {
      args = call.function.arguments;
    }

    const validated = toolCallRequestSchema.safeParse({
      type: "tool_call",
      callId: call.id || `call_ollama_${Date.now()}`,
      toolId: call.function.name,
      arguments: args,
    });

    if (!validated.success) {
      const issue = validated.error.issues[0];
      throw new AgentRuntimeError("malformed_output", `Invalid native tool call schema: ${issue?.message ?? "schema mismatch"}`);
    }

    return {
      type: "tool_call",
      request: validated.data,
    };
  }

  // 2. Content extraction & length check
  const rawContent = response.message.content?.trim();
  if (!rawContent) {
    throw new AgentRuntimeError("no_response");
  }

  if (rawContent.length > 64_000) {
    throw new AgentRuntimeError("malformed_output", "Response exceeded maximum length limit of 64,000 characters");
  }

  // 3. Sanitization
  // Strip <think>...</think> reasoning blocks if present
  let cleaned = rawContent.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

  // Strip Markdown code block fences if present
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }

  // Strip Ollama / Qwen special tokens (e.g. <tool_call|>, <tool_call>, </tool_call>, <|im_end|>, etc.)
  cleaned = cleaned.replace(/<tool_call\|?>|<\/tool_call>|<\|im_end\|>|<\|endoftext\|>|<\|thought\|>/gi, "").trim();

  // 4. JSON extraction attempt
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // If direct parse failed, attempt to extract outermost balanced JSON object { ... }
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      const candidate = cleaned.slice(firstBrace, lastBrace + 1);
      try {
        parsed = JSON.parse(candidate);
      } catch {
        // Not a valid JSON candidate
      }
    }
  }

  // 5. If a JSON object was parsed
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    // Check if content JSON is a tool_call
    if ((parsed as { type?: string }).type === "tool_call") {
      const toolCallParsed = toolCallRequestSchema.safeParse(parsed);
      if (toolCallParsed.success) {
        return { type: "tool_call", request: toolCallParsed.data };
      }
      const issue = toolCallParsed.error.issues[0];
      throw new AgentRuntimeError("malformed_output", `Invalid text tool_call: ${issue?.message ?? "schema mismatch"}`);
    }

    // Check if content JSON is a StructuredResult
    const rawObj = parsed as Record<string, unknown>;

    if (!Array.isArray(rawObj.sources)) {
      rawObj.sources = [];
    } else {
      rawObj.sources = rawObj.sources.filter((s) => sourceSchema.safeParse(s).success);
    }

    if (!Array.isArray(rawObj.cards)) {
      rawObj.cards = [];
    } else {
      rawObj.cards = rawObj.cards
        .map((c, idx) => {
          if (!c || typeof c !== "object") return null;
          const parsedCard = resultCardSchema.safeParse(c);
          if (parsedCard.success) return parsedCard.data;

          // Attempt fallback to generic card
          const cardObj = c as Record<string, unknown>;
          const title =
            typeof cardObj.title === "string" && cardObj.title.trim()
              ? cardObj.title.trim()
              : "Details";
          const label =
            typeof cardObj.label === "string" && cardObj.label.trim()
              ? cardObj.label.trim()
              : title;
          const id =
            typeof cardObj.id === "string" && cardObj.id.trim()
              ? cardObj.id.trim()
              : `card_${Date.now()}_${idx}`;
          const body =
            typeof cardObj.body === "string"
              ? cardObj.body
              : typeof cardObj.summary === "string"
              ? cardObj.summary
              : typeof cardObj.detail === "string"
              ? cardObj.detail
              : JSON.stringify(c);

          const fallback = {
            id,
            label,
            type: "generic" as const,
            title,
            body,
          };
          const fallbackParsed = genericCardSchema.safeParse(fallback);
          return fallbackParsed.success ? fallbackParsed.data : null;
        })
        .filter((c): c is ResultCard => c !== null);
    }

    // Title and speech defaults
    if (typeof rawObj.title !== "string" || !rawObj.title.trim()) {
      rawObj.title = "Assistant Response";
    }
    if (typeof rawObj.speech !== "string" || !rawObj.speech.trim()) {
      rawObj.speech = rawObj.title;
    }

    // State normalization: safe aliases mapped; invalid values left intact for Zod rejection
    if (typeof rawObj.state === "string") {
      const s = rawObj.state.toLowerCase().trim();
      if (
        s === "done" ||
        s === "success" ||
        s === "completed" ||
        s === "ready" ||
        s === "finished" ||
        s === "complete"
      ) {
        rawObj.state = "complete";
      } else if (
        s === "pending" ||
        s === "waiting" ||
        s === "waiting_for_approval" ||
        s === "pending_confirmation" ||
        s === "approval"
      ) {
        rawObj.state = "waiting_for_approval";
      } else if (s === "partial" || s === "incomplete") {
        rawObj.state = rawObj.confirmation ? "waiting_for_approval" : "complete";
      } else if (s === "error" || s === "failure" || s === "failed") {
        rawObj.state = "failed";
      }
      // Note: Unknown state strings (e.g. "banana" or "invalid_state") remain untouched so Zod rejects truthfully.
    } else if (rawObj.state === undefined || rawObj.state === null) {
      rawObj.state = rawObj.confirmation ? "waiting_for_approval" : "complete";
    }

    const structuredParsed = structuredResultSchema.safeParse(parsed);
    if (structuredParsed.success) {
      return { type: "direct", result: structuredParsed.data };
    }

    const issue = structuredParsed.error.issues[0];
    const pathStr = issue?.path.join(".") || "root";
    throw new AgentRuntimeError(
      "malformed_output",
      `Schema validation failed at '${pathStr}': ${issue?.message ?? "invalid structured result"}`
    );
  }

  // 6. If JSON was attempted (e.g. code-fenced or starting with '{' or '[') but failed syntax parsing:
  if (cleaned.startsWith("{") || cleaned.startsWith("[") || fenceMatch) {
    throw new AgentRuntimeError("malformed_output", "JSON syntax error in model response");
  }

  // 7. Safe Direct-Answer Fallback for Harmless Conversational Plain-Text (Section 8)
  if (/<(?:script|iframe|object|embed|form|style)\b/i.test(cleaned)) {
    throw new AgentRuntimeError("malformed_output", "Unsafe HTML detected in plain text response");
  }

  if (/(?:tool_call|call_id|function_call)\s*[:=]/i.test(cleaned)) {
    throw new AgentRuntimeError("malformed_output", "Unsafe tool instruction in plain text response");
  }

  const lower = cleaned.toLowerCase();
  if (
    lower.includes("unable to answer in json") ||
    lower.includes("cannot answer in json") ||
    lower.startsWith("error:")
  ) {
    throw new AgentRuntimeError("malformed_output", "Provider refused to produce structured response");
  }

  const directCandidate = {
    speech: cleaned,
    title: "Assistant Response",
    state: "complete" as const,
    cards: [],
    sources: [],
  };

  const directParsed = structuredResultSchema.safeParse(directCandidate);
  if (directParsed.success) {
    return { type: "direct", result: directParsed.data };
  }

  throw new AgentRuntimeError("malformed_output", "Direct conversational text failed StructuredResult validation");
}

function event(type: AgentEvent["type"], label: string): AgentEvent {
  return { id: crypto.randomUUID(), type, timestamp: new Date().toISOString(), label };
}
