import type { AgentProvider, AgentRequest, AgentRun, AgentDecision } from "@/lib/contracts/provider";
import type { AgentEvent } from "@/lib/contracts/event";
import type { AgentApiFrame } from "@/lib/contracts/agent-api";
import { AgentRuntimeError } from "@/lib/agent/errors";
import { toolCallRequestSchema } from "@/lib/contracts/tool";
import {
  structuredResultSchema,
  sourceSchema,
  resultCardSchema,
  genericCardSchema,
  type ResultCard,
} from "@/lib/contracts/result";
import { HermesClient } from "@/lib/hermes/client";
import { HermesConnectionError, HermesTimeoutError, HermesAuthError } from "@/lib/hermes/errors";
import type { HermesChatMessage } from "@/lib/contracts/hermes";
import { specialistRegistry } from "@/lib/specialist/registry";
import type { SpecialistRun } from "@/lib/contracts/specialist";
import {
  WEB_TOOL_PATTERN,
  extractProvenanceFromToolData,
  mergeWebSources,
} from "@/lib/research/provenance";
import type { Source } from "@/lib/contracts/result";

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

export interface HermesProviderOptions {
  client?: HermesClient;
  fallbackProvider?: AgentProvider;
  conversationPrefix?: string;
}

export class HermesProvider implements AgentProvider {
  readonly id = "hermes";
  readonly name = "Hermes";

  private readonly client: HermesClient;
  private readonly fallbackProvider?: AgentProvider;
  private readonly conversationPrefix: string;

  constructor(options?: HermesProviderOptions) {
    this.client = options?.client ?? new HermesClient();
    this.fallbackProvider = options?.fallbackProvider;
    this.conversationPrefix = options?.conversationPrefix ?? "jarvis";
  }

  async runAgent(request: AgentRequest): Promise<AgentRun> {
    const abortController = new AbortController();
    const abortHandler = () => abortController.abort();
    request.signal.addEventListener("abort", abortHandler, { once: true });

    const events = new EventQueue();
    events.push(event("agent_started", "Hermes reasoning started"));

    const startTime = Date.now();

    const result = (async () => {
      try {
        // Build conversation messages for Hermes
        const systemContent = request.requiredOutput
          ? `${request.systemInstructions}\n\nRequired final response JSON shape:\n${request.requiredOutput}`
          : request.systemInstructions;

        const messages: HermesChatMessage[] = [
          { role: "system", content: systemContent },
          ...request.conversation.map((msg) => ({
            role: msg.role as "user" | "assistant",
            content: msg.content,
          })),
          { role: "user", content: request.request },
        ];

        // Unique conversation/session identifier for continuity
        const conversationId = `${this.conversationPrefix}-${request.requestId}`;

        events.push(event("agent_started", "Planning response"));

        const response = await this.client.chatCompletion(
          {
            model: "hermes-agent",
            messages,
            stream: false,
          },
          {
            signal: abortController.signal,
            headers: {
              "X-Hermes-Session-Id": conversationId,
            },
          }
        );

        if (request.signal.aborted) {
          throw new AgentRuntimeError("cancelled");
        }

        const choice = response.choices?.[0];
        if (!choice) {
          throw new AgentRuntimeError("malformed_output", "Hermes returned empty choices");
        }

        const message = choice.message;
        const durationMs = Date.now() - startTime;

        // Check for model tool calls
        if (message.tool_calls && message.tool_calls.length > 0) {
          const firstCall = message.tool_calls[0] as {
            id?: string;
            function?: { name?: string; arguments?: string };
          };
          const toolName = firstCall?.function?.name || "";
          let toolArgs: Record<string, unknown> = {};

          try {
            toolArgs = firstCall?.function?.arguments
              ? JSON.parse(firstCall.function.arguments)
              : {};
          } catch {
            toolArgs = {};
          }

          const callRequest = toolCallRequestSchema.parse({
            type: "tool_call",
            callId: firstCall?.id || `call-${crypto.randomUUID()}`,
            toolId: toolName,
            arguments: toolArgs,
          });

          events.push(event("tool_started", `Proposed tool: ${toolName}`));

          return {
            decision: { type: "tool_call" as const, request: callRequest },
            meta: {
              provider: this.name,
              model: response.model || "hermes-agent",
              durationMs,
              usage: response.usage
                ? {
                    inputTokens: response.usage.prompt_tokens ?? 0,
                    outputTokens: response.usage.completion_tokens ?? 0,
                  }
                : undefined,
            },
          };
        }

        // Direct structured response normalization
        const rawContent = message.content ?? "";
        const decision = normalizeHermesDecision(rawContent);

        return {
          decision,
          result: decision.type === "direct" ? decision.result : undefined,
          meta: {
            provider: this.name,
            model: response.model || "hermes-agent",
            durationMs,
            usage: response.usage
              ? {
                  inputTokens: response.usage.prompt_tokens ?? 0,
                  outputTokens: response.usage.completion_tokens ?? 0,
                }
              : undefined,
          },
        };
      } catch (err: unknown) {
        if (
          request.signal.aborted ||
          (err instanceof Error && err.name === "AbortError") ||
          (err instanceof HermesTimeoutError && request.signal.aborted)
        ) {
          return {
            decision: {
              type: "direct" as const,
              result: {
                speech: "Request was cancelled.",
                title: "Cancelled",
                state: "complete" as const,
                cards: [],
                sources: [],
              },
            },
            meta: {
              provider: this.name,
              model: "hermes-agent",
              durationMs: Date.now() - startTime,
            },
          };
        }

        if (err instanceof HermesTimeoutError) {
          throw new AgentRuntimeError("timeout", `Hermes request timed out: ${err.message}`);
        }

        if (err instanceof HermesAuthError) {
          throw new AgentRuntimeError("configuration", `Hermes auth failed: ${err.message}`);
        }

        // If Hermes connection fails and fallback is available, run fallback
        if (err instanceof HermesConnectionError && this.fallbackProvider) {
          events.push(
            event(
              "agent_started",
              `Hermes unreachable (${err.message}). Falling back to ${this.fallbackProvider.name}.`
            )
          );
          const fallbackRun = await this.fallbackProvider.runAgent(request);

          // Pipe fallback events into our stream
          (async () => {
            try {
              for await (const ev of fallbackRun.events) {
                events.push(ev);
              }
            } catch {
              // ignore stream errors on fallback
            }
          })();

          return fallbackRun.result;
        }

        if (err instanceof HermesConnectionError) {
          throw new AgentRuntimeError("network", `Hermes connection error: ${err.message}`);
        }

        if (err instanceof AgentRuntimeError) {
          throw err;
        }

        throw new AgentRuntimeError(
          "malformed_output",
          err instanceof Error ? err.message : String(err)
        );
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

  /**
   * Executes a full Hermes Run (POST /v1/runs) with real-time SSE event streaming
   * (GET /v1/runs/{id}/events), yielding normalized AgentApiFrames.
   * Hermes natively owns the multi-step execution loop.
   */
  async *executeRun(options: {
    input: string;
    conversation: Array<{ role: string; content: string }>;
    sessionId: string;
    instructions: string;
    signal?: AbortSignal;
  }): AsyncGenerator<AgentApiFrame> {
    const startTime = Date.now();
    let runId: string | undefined;

    const onAbort = () => {
      if (runId) {
        this.client.stopRun(runId).catch(() => {});
      }
    };

    if (options.signal) {
      options.signal.addEventListener("abort", onAbort, { once: true });
    }

    try {
      if (options.signal?.aborted) {
        throw new AgentRuntimeError("cancelled");
      }

      yield {
        type: "event",
        event: {
          id: crypto.randomUUID(),
          type: "agent_started",
          timestamp: new Date().toISOString(),
          label: "Hermes run started",
        },
      };

      const runResponse = await this.client.createRun(
        {
          input: options.input,
          session_id: options.sessionId,
          instructions: options.instructions,
        },
        { signal: options.signal }
      );

      runId = runResponse.run_id;

      // Stream events from /v1/runs/{run_id}/events
      let finalResultFrame: AgentApiFrame | undefined;
      const specialistRuns = new Map<string, SpecialistRun>();
      // Phase 10: web research provenance captured from Hermes tool events.
      const webEvidence: Source[] = [];

      for await (const sseEvent of this.client.streamRunEvents(runId, options.signal)) {
        if (options.signal?.aborted) {
          throw new AgentRuntimeError("cancelled");
        }

        const evName = sseEvent.event;
        const data = typeof sseEvent.data === "object" && sseEvent.data !== null ? sseEvent.data : {};

        if (evName === "tool.started") {
          const toolName = (data.tool as string) || "tool";
          yield {
            type: "event",
            event: {
              id: crypto.randomUUID(),
              type: "tool_started",
              timestamp: new Date().toISOString(),
              label: `Executing tool: ${toolName}`,
            },
          };
        } else if (evName === "tool.completed") {
          const toolName = (data.tool as string) || "tool";
          const hasError = Boolean(data.error);
          yield {
            type: "event",
            event: {
              id: crypto.randomUUID(),
              type: hasError ? "tool_failed" : "tool_completed",
              timestamp: new Date().toISOString(),
              label: `Tool ${toolName} ${hasError ? "failed" : "completed"}`,
            },
          };

          // Phase 10: capture provenance from web research tools. The data
          // payload is untrusted; extraction sanitizes and bounds everything.
          if (!hasError && WEB_TOOL_PATTERN.test(toolName)) {
            const captured = extractProvenanceFromToolData(data);
            if (captured.length > 0) {
              webEvidence.push(...captured);
              yield {
                type: "event",
                event: {
                  id: crypto.randomUUID(),
                  type: "tool_completed",
                  timestamp: new Date().toISOString(),
                  label: `Evidence captured: ${captured.length} source${captured.length === 1 ? "" : "s"} from ${toolName}`,
                },
              };
            }
          }
        } else if (evName === "subagent.start" || evName === "subagent.spawn_requested") {
          const subagentId = String(data.subagent_id || `sa-${Date.now()}`);
          const goal = String(data.goal || (data.preview as string) || "Delegated task");
          const matchedSpec = specialistRegistry.findBestSpecialist(goal);
          const displayName = matchedSpec?.displayName || "Specialist";
          const specRun: SpecialistRun = {
            subagentId,
            specialistId: matchedSpec?.id || "research",
            displayName,
            parentRunId: runId,
            hermesParentRunId: runId,
            sessionId: options.sessionId,
            goal,
            status: "running",
            startedAt: new Date().toISOString(),
            toolCount: 0,
          };
          specialistRuns.set(subagentId, specRun);
          yield {
            type: "event",
            event: {
              id: crypto.randomUUID(),
              type: "specialist_started",
              timestamp: new Date().toISOString(),
              label: `Specialist started: ${displayName} ("${goal.slice(0, 50)}")`,
            },
          };
        } else if (evName === "subagent.complete") {
          const subagentId = String(data.subagent_id || "");
          const specRun = specialistRuns.get(subagentId);
          const rawStatus = (data.status as string) || "completed";
          const isFailed = rawStatus === "failed" || rawStatus === "error";
          const isCancelled = rawStatus === "cancelled" || rawStatus === "interrupted";
          if (specRun) {
            specRun.status = isCancelled ? "cancelled" : isFailed ? "failed" : "completed";
            specRun.completedAt = new Date().toISOString();
            specRun.summary = typeof data.summary === "string" ? data.summary : undefined;
            specRun.durationMs = typeof data.duration_seconds === "number" ? Math.round(data.duration_seconds * 1000) : undefined;
            specRun.toolCount = typeof data.tool_count === "number" ? data.tool_count : 0;
          }
          yield {
            type: "event",
            event: {
              id: crypto.randomUUID(),
              type: isFailed ? "specialist_failed" : isCancelled ? "specialist_cancelled" : "specialist_completed",
              timestamp: new Date().toISOString(),
              label: `Specialist ${isFailed ? "failed" : isCancelled ? "cancelled" : "completed"}: ${specRun?.displayName || "Specialist"}`,
            },
          };
        } else if (evName === "message.delta") {
          const deltaText = (data.content as string) || (data.text as string) || (data.delta as string) || "";
          if (deltaText) {
            yield { type: "delta", text: deltaText };
          }
        } else if (evName === "run.completed") {
          const rawOutput = (data.output as string) || "";
          const decision = normalizeHermesDecision(rawOutput);
          const durationMs = Math.max(1, Date.now() - startTime);

          if (decision.type === "direct") {
            // Phase 10: preserve source provenance — model-declared sources
            // win; captured web evidence fills the gaps, deduplicated/bounded.
            if (webEvidence.length > 0) {
              decision.result.sources = mergeWebSources(decision.result.sources, webEvidence);
            }
            if (specialistRuns.size > 0) {
              const lines: string[] = ["HERMES"];
              const list = Array.from(specialistRuns.values());
              list.forEach((s) => {
                const prefix = "├─ ";
                const icon = s.status === "completed" ? "✓" : s.status === "failed" ? "✗" : "●";
                lines.push(`${prefix}${s.displayName.padEnd(24)} ${icon}`);
              });
              lines.push(`└─ Synthesis                 ✓`);

              const specialistCard: ResultCard = {
                id: `specialists-${Date.now()}`,
                type: "generic",
                label: "Orchestration",
                title: "Specialist Team",
                body: lines.join("\n"),
              };
              decision.result.cards = [specialistCard, ...decision.result.cards];
            }

            finalResultFrame = {
              type: "result",
              result: decision.result,
              meta: {
                provider: this.name,
                model: "hermes-agent",
                durationMs,
              },
            };
          } else {
            finalResultFrame = {
              type: "result",
              result: {
                speech: `Executing action: ${decision.request.toolId}.`,
                title: "Action Proposed",
                state: "complete",
                cards: [
                  {
                    id: `action-${Date.now()}`,
                    type: "generic",
                    label: "Action",
                    title: decision.request.toolId,
                    body: JSON.stringify(decision.request.arguments, null, 2),
                  },
                ],
                sources: [],
              },
              meta: {
                provider: this.name,
                model: "hermes-agent",
                durationMs,
              },
            };
          }
        } else if (evName === "run.failed") {
          const errorMsg = (data.error as string) || "Hermes run failed.";
          throw new AgentRuntimeError("server", errorMsg);
        } else if (evName === "run.cancelled" || evName === "run.interrupted") {
          throw new AgentRuntimeError("cancelled");
        }
      }

      if (finalResultFrame) {
        yield finalResultFrame;
      } else {
        const status = await this.client.getRunStatus(runId);
        const durationMs = Math.max(1, Date.now() - startTime);
        if (status.status === "completed" && status.output) {
          const decision = normalizeHermesDecision(typeof status.output === "string" ? status.output : JSON.stringify(status.output));
          yield {
            type: "result",
            result: decision.type === "direct" ? decision.result : {
              speech: "Task completed.",
              title: "Result",
              state: "complete",
              cards: [],
              sources: [],
            },
            meta: {
              provider: this.name,
              model: "hermes-agent",
              durationMs,
            },
          };
        } else if (status.status === "failed") {
          throw new AgentRuntimeError("server", status.error || "Hermes run failed.");
        } else if (status.status === "cancelled") {
          throw new AgentRuntimeError("cancelled");
        } else {
          throw new AgentRuntimeError("timeout", "Hermes run timed out before completion.");
        }
      }
    } catch (err: unknown) {
      if (err instanceof AgentRuntimeError) throw err;
      if (options.signal?.aborted) throw new AgentRuntimeError("cancelled");
      throw new AgentRuntimeError("server", err instanceof Error ? err.message : String(err));
    } finally {
      if (options.signal) {
        options.signal.removeEventListener("abort", onAbort);
      }
    }
  }
}

/**
 * Normalizes Hermes response content into an AgentDecision.
 */
export function normalizeHermesDecision(raw: string): AgentDecision {
  if (typeof raw !== "string" || !raw.trim()) {
    throw new AgentRuntimeError("malformed_output", "Hermes response content was empty");
  }

  // 1. Strip reasoning/thinking tags and special tokens
  const cleaned = raw
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<tool_call\|?>[\s\S]*?<\/tool_call\|?>/gi, "")
    .replace(/<\/?(?:tool_call|im_start|im_end|endoftext|thought)[^>]*>/gi, "")
    .trim();

  if (!cleaned) {
    throw new AgentRuntimeError("malformed_output", "Response contained only reasoning tags");
  }

  // 2. Direct JSON or code fence extraction
  let jsonString: string | null = null;
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch) {
    jsonString = fenceMatch[1].trim();
  } else if (cleaned.startsWith("{") && cleaned.endsWith("}")) {
    jsonString = cleaned;
  } else {
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      jsonString = cleaned.substring(firstBrace, lastBrace + 1);
    }
  }

  if (jsonString) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonString);
    } catch {
      // Ignore JSON parse failure here; will test for conversational text fallback below
      parsed = null;
    }

    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const rawObj = parsed as Record<string, unknown>;

      // Check if it's a tool call object: { tool: "name", arguments: {...} }
      if (rawObj.tool && typeof rawObj.tool === "string") {
        const toolArgs =
          typeof rawObj.arguments === "object" && rawObj.arguments !== null
            ? (rawObj.arguments as Record<string, unknown>)
            : {};
        const callRequest = toolCallRequestSchema.safeParse({
          type: "tool_call",
          callId: `call-${crypto.randomUUID()}`,
          toolId: rawObj.tool,
          arguments: toolArgs,
        });
        if (callRequest.success) {
          return { type: "tool_call", request: callRequest.data };
        }
      }

      // Check if it's an action proposal: { action: "create_note", ... }
      if (rawObj.action && typeof rawObj.action === "string" && !rawObj.speech) {
        const actionArgs =
          typeof rawObj.arguments === "object" && rawObj.arguments !== null
            ? (rawObj.arguments as Record<string, unknown>)
            : (rawObj as Record<string, unknown>);
        const callRequest = toolCallRequestSchema.safeParse({
          type: "tool_call",
          callId: `call-${crypto.randomUUID()}`,
          toolId: rawObj.action,
          arguments: actionArgs,
        });
        if (callRequest.success) {
          return { type: "tool_call", request: callRequest.data };
        }
      }

      // Normalize sources
      if (!Array.isArray(rawObj.sources)) {
        rawObj.sources = [];
      } else {
        rawObj.sources = rawObj.sources
          .map((s) => {
            const parsedSource = sourceSchema.safeParse(s);
            return parsedSource.success ? parsedSource.data : null;
          })
          .filter((s) => s !== null);
      }

      // Normalize cards
      if (!Array.isArray(rawObj.cards)) {
        rawObj.cards = [];
      } else {
        rawObj.cards = rawObj.cards
          .map((card, idx) => {
            const parsedCard = resultCardSchema.safeParse(card);
            if (parsedCard.success) return parsedCard.data;

            if (card && typeof card === "object") {
              const c = card as Record<string, unknown>;
              const id = typeof c.id === "string" ? c.id : `card-${idx + 1}`;
              const label = typeof c.label === "string" ? c.label : "Details";
              const title = typeof c.title === "string" ? c.title : label;
              const body = typeof c.body === "string" ? c.body : JSON.stringify(c);

              const fallback = {
                id,
                label,
                type: "generic" as const,
                title,
                body,
              };
              const fallbackParsed = genericCardSchema.safeParse(fallback);
              return fallbackParsed.success ? fallbackParsed.data : null;
            }
            return null;
          })
          .filter((c): c is ResultCard => c !== null);
      }

      // Title & speech defaults
      if (typeof rawObj.title !== "string" || !rawObj.title.trim()) {
        rawObj.title = "Assistant Response";
      }
      if (typeof rawObj.speech !== "string" || !rawObj.speech.trim()) {
        rawObj.speech = rawObj.title;
      }

      // State normalization
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
      } else if (rawObj.state === undefined || rawObj.state === null) {
        rawObj.state = rawObj.confirmation ? "waiting_for_approval" : "complete";
      }

      const structuredParsed = structuredResultSchema.safeParse(parsed);
      if (structuredParsed.success) {
        return { type: "direct", result: structuredParsed.data };
      }
    }
  }

  // Safe conversational plain-text fallback
  if (/<(?:script|iframe|object|embed|form|style)\b/i.test(cleaned)) {
    throw new AgentRuntimeError("malformed_output", "Unsafe HTML detected in plain text response");
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

  throw new AgentRuntimeError("malformed_output", "Failed to normalize Hermes response");
}

function event(type: AgentEvent["type"], label: string): AgentEvent {
  return { id: crypto.randomUUID(), type, timestamp: new Date().toISOString(), label };
}
