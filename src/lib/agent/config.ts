import path from "node:path";
import { z } from "zod";
import { AgentRuntimeError } from "@/lib/agent/errors";

const configSchema = z.object({
  entry: z.string().trim().min(1),
  model: z.string().trim().min(1).optional(),
  timeoutMs: z.coerce.number().int().min(1_000).max(300_000).default(60_000),
  maxTurns: z.coerce.number().int().min(1).max(10).default(2),
});

export interface AgentConfig {
  nodeExecutable: string;
  commandCodeEntry: string;
  model?: string;
  timeoutMs: number;
  maxTurns: number;
}

export function readAgentConfig(environment: Record<string, string | undefined> = process.env): AgentConfig {
  const result = configSchema.safeParse({ entry: environment.JARVIS_COMMAND_CODE_ENTRY, model: environment.JARVIS_COMMAND_CODE_MODEL || undefined, timeoutMs: environment.JARVIS_AGENT_TIMEOUT_MS, maxTurns: environment.JARVIS_AGENT_MAX_TURNS });
  if (!result.success) throw new AgentRuntimeError("configuration");
  const entry = path.resolve(result.data.entry);
  if (path.basename(entry).toLowerCase() === "cmd.exe" || !entry.toLowerCase().endsWith("index.mjs")) throw new AgentRuntimeError("configuration");
  return { nodeExecutable: process.execPath, commandCodeEntry: entry, model: result.data.model, timeoutMs: result.data.timeoutMs, maxTurns: result.data.maxTurns };
}
