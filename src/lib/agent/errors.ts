import { z } from "zod";

export const agentErrorCodeSchema = z.enum([
  "configuration",
  "unavailable",
  "unauthenticated",
  "permission",
  "rate_limit",
  "network",
  "server",
  "credits",
  "no_response",
  "max_turns",
  "malformed_output",
  "timeout",
  "cancelled",
  "unknown",
]);

export const safeAgentErrorSchema = z.object({
  code: agentErrorCodeSchema,
  message: z.string().min(1).max(240),
});

export type AgentErrorCode = z.infer<typeof agentErrorCodeSchema>;
export type SafeAgentError = z.infer<typeof safeAgentErrorSchema>;

const messages: Record<AgentErrorCode, string> = {
  configuration: "The reasoning provider is not configured.",
  unavailable: "The reasoning provider is unavailable.",
  unauthenticated: "Command Code authentication is required.",
  permission: "The reasoning provider denied this request.",
  rate_limit: "The reasoning provider rate limit was reached.",
  network: "The reasoning provider could not reach the network.",
  server: "The reasoning provider returned a server error.",
  credits: "The Command Code account has insufficient credits.",
  no_response: "The reasoning provider returned no response.",
  max_turns: "The reasoning provider reached its turn limit.",
  malformed_output: "The reasoning response could not be safely validated.",
  timeout: "The reasoning request timed out.",
  cancelled: "The reasoning request was cancelled.",
  unknown: "The reasoning request failed.",
};

export class AgentRuntimeError extends Error {
  constructor(
    public readonly code: AgentErrorCode,
    public readonly diagnosticDetail?: string
  ) {
    super(messages[code]);
    this.name = "AgentRuntimeError";
  }

  toSafeError(): SafeAgentError {
    return { code: this.code, message: this.message };
  }
}

export function mapCommandCodeExitCode(exitCode: number | null): AgentErrorCode {
  const codes: Record<number, AgentErrorCode> = { 3: "unauthenticated", 4: "permission", 5: "rate_limit", 6: "network", 7: "server", 8: "max_turns", 9: "no_response", 10: "credits", 130: "cancelled" };
  return exitCode === null ? "unknown" : (codes[exitCode] ?? "unknown");
}
