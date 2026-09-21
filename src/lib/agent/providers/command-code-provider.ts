import type { AgentProvider, AgentRequest, AgentRun } from "@/lib/contracts/provider";
import type { AgentEvent } from "@/lib/contracts/event";
import { readAgentConfig, type AgentConfig } from "@/lib/agent/config";
import { AgentRuntimeError } from "@/lib/agent/errors";
import { buildAgentPrompt, parseAgentDecision } from "@/lib/agent/prompt";
import { parseCommandCodeNdjson } from "@/lib/agent/providers/command-code-ndjson";
import { requireSuccessfulExit, SpawnCommandCodeTransport, type CommandCodeTransport } from "@/lib/agent/transport";

class EventQueue implements AsyncIterable<AgentEvent> {
  private values: AgentEvent[] = [];
  private waiting: ((value: IteratorResult<AgentEvent>) => void)[] = [];
  private done = false;
  push(value: AgentEvent) { const resolve = this.waiting.shift(); if (resolve) resolve({ value, done: false }); else this.values.push(value); }
  close() { this.done = true; for (const resolve of this.waiting.splice(0)) resolve({ value: undefined, done: true }); }
  [Symbol.asyncIterator]() { return { next: (): Promise<IteratorResult<AgentEvent>> => { const value = this.values.shift(); if (value) return Promise.resolve({ value, done: false }); if (this.done) return Promise.resolve({ value: undefined, done: true }); return new Promise((resolve) => this.waiting.push(resolve)); } }; }
}

export class CommandCodeProvider implements AgentProvider {
  readonly id = "command-code";
  readonly name = "Command Code";

  constructor(private readonly transport: CommandCodeTransport = new SpawnCommandCodeTransport(), private readonly getConfig: () => AgentConfig = () => readAgentConfig()) {}

  async runAgent(request: AgentRequest): Promise<AgentRun> {
    const config = this.getConfig();
    const process = await this.transport.start({
      prompt: buildAgentPrompt({
        request: request.request,
        conversation: request.conversation,
        availableTools: request.availableTools,
        availableSkills: request.availableSkills,
        systemInstructions: request.systemInstructions,
      }),
      config,
      signal: request.signal,
    });
    const events = new EventQueue();
    events.push(event("agent_started", "Reasoning started"));

    const result = (async () => {
      let finalFrame: { subtype: "success" | "error" | "max_turns"; durationMs: number; finalText: string; usage: { inputTokens: number; outputTokens: number } } | null = null;
      let model = config.model ?? "default";
      try {
        for await (const frame of parseCommandCodeNdjson(process.stdout)) {
          if (frame.kind === "model_started" && frame.model) model = frame.model;
          if (frame.kind === "result") finalFrame = frame;
        }
        const exitCode = await process.exit;
        await requireSuccessfulExit(exitCode);
        if (!finalFrame) throw new AgentRuntimeError("no_response");
        if (finalFrame.subtype === "max_turns") throw new AgentRuntimeError("max_turns");
        if (finalFrame.subtype === "error") throw new AgentRuntimeError("unknown");
        events.push(event("agent_synthesizing", "Validating response"));
        const decision = parseAgentDecision(finalFrame.finalText);
        if (decision.type === "direct") {
          events.push(event("response_ready", "Response ready"));
          return { decision, result: decision.result, meta: { provider: this.name, model, durationMs: finalFrame.durationMs, usage: finalFrame.usage } };
        }
        return { decision, meta: { provider: this.name, model, durationMs: finalFrame.durationMs, usage: finalFrame.usage } };
      } catch (error) {
        await process.cancel();
        await process.exit.catch(() => undefined);
        throw error;
      } finally {
        events.close();
      }
    })();

    return { events, result, cancel: process.cancel };
  }
}

function event(type: AgentEvent["type"], label: string): AgentEvent {
  return { id: crypto.randomUUID(), type, timestamp: new Date().toISOString(), label };
}
