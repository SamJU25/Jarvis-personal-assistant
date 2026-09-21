import { z } from "zod";
import { safeAgentErrorSchema } from "@/lib/agent/errors";
import { conversationSchema } from "@/lib/contracts/conversation";
import { structuredResultSchema } from "@/lib/contracts/result";
import { voiceStatusSchema } from "@/lib/contracts/voice";
import { pendingConfirmationSchema } from "@/lib/contracts/confirmation";

export const agentApiRequestSchema = z.object({
  message: z.string().trim().min(1).max(4_000),
  conversation: conversationSchema.default([]),
  confirmationId: z.string().optional(),
  sessionId: z.string().optional(),
});

export const safeRunMetaSchema = z.object({
  provider: z.string(),
  model: z.string(),
  durationMs: z.number().int().nonnegative(),
  usage: z.object({ inputTokens: z.number().int().nonnegative(), outputTokens: z.number().int().nonnegative() }).optional(),
});

const publicEventSchema = z.object({
  id: z.string(),
  type: z.enum([
    "agent_started",
    "agent_synthesizing",
    "response_ready",
    "skill_selected",
    "skill_started",
    "skill_completed",
    "skill_failed",
    "tool_requested",
    "tool_started",
    "tool_completed",
    "tool_failed",
    "confirmation_required",
    "verification_started",
    "verification_completed",
    "intent_detected",
    "intent_routed",
    "intent_fallback",
    "specialist_spawned",
    "specialist_started",
    "specialist_progress",
    "specialist_completed",
    "specialist_failed",
    "specialist_cancelled",
  ]),
  timestamp: z.string(),
  label: z.string(),
});

export const agentApiFrameSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("event"), event: publicEventSchema.strict() }).strict(),
  z.object({ type: z.literal("delta"), text: z.string() }).strict(),
  z.object({ type: z.literal("confirmation_required"), confirmation: pendingConfirmationSchema }).strict(),
  z.object({ type: z.literal("result"), result: structuredResultSchema, meta: safeRunMetaSchema.strict() }).strict(),
  z.object({ type: z.literal("error"), error: safeAgentErrorSchema.strict() }).strict(),
]);

export const providerStatusSchema = z.object({
  available: z.boolean(),
  authenticated: z.boolean(),
  provider: z.enum(["Command Code", "Ollama"]),
  model: z.string(),
  activeProviderId: z.enum(["command-code", "ollama"]).optional(),
  availableProviders: z.array(z.enum(["command-code", "ollama"])).optional(),
  obsidian: z
    .object({
      status: z.enum(["Available", "Not configured", "Unavailable", "Invalid"]),
      configured: z.boolean(),
    })
    .optional(),
  google: z
    .object({
      status: z.enum([
        "Available",
        "Not configured",
        "Unauthenticated",
        "Unavailable",
        "Invalid configuration",
      ]),
      configured: z.boolean(),
    })
    .optional(),
  memory: z
    .object({
      status: z.enum(["Available", "Not configured", "Unavailable", "Error"]),
      configured: z.boolean(),
      count: z.number().int().nonnegative().optional(),
    })
    .optional(),
  ollama: z
    .object({
      status: z.enum([
        "Available",
        "Not configured",
        "Unavailable",
        "Model unavailable",
        "Invalid configuration",
      ]),
      configured: z.boolean(),
      model: z.string().optional(),
      availableModels: z.array(z.string()).optional(),
    })
    .optional(),
  voice: voiceStatusSchema.optional(),
});

export type AgentApiRequest = z.infer<typeof agentApiRequestSchema>;
export type AgentApiFrame = z.infer<typeof agentApiFrameSchema>;
export type SafeRunMeta = z.infer<typeof safeRunMetaSchema>;
export type ProviderStatus = z.infer<typeof providerStatusSchema>;
