import { z } from "zod";

/**
 * Hermes basic health check response schema (GET /health or GET /v1/health).
 */
export const hermesHealthSchema = z.object({
  status: z.string(),
  platform: z.string().optional(),
  version: z.string().optional(),
});

export type HermesHealthResponse = z.infer<typeof hermesHealthSchema>;

/**
 * Hermes detailed health response schema (GET /health/detailed, requires Bearer auth).
 */
export const hermesDetailedHealthSchema = z
  .object({
    status: z.string(),
    readiness: z.record(z.string(), z.unknown()).optional(),
    platform: z.string().optional(),
    version: z.string().optional(),
    gateway_state: z.string().nullable().optional(),
    active_agents: z.number().optional(),
    gateway_busy: z.boolean().optional(),
    gateway_drainable: z.boolean().optional(),
    exit_reason: z.string().nullable().optional(),
  })
  .passthrough();

export type HermesDetailedHealthResponse = z.infer<typeof hermesDetailedHealthSchema>;

/**
 * Hermes capabilities response schema (GET /v1/capabilities, requires Bearer auth).
 */
export const hermesCapabilitiesSchema = z
  .object({
    object: z.string().optional(),
    platform: z.string().optional(),
    model: z.string().optional(),
    runtime: z.record(z.string(), z.unknown()).optional(),
    auth: z
      .object({
        type: z.string(),
        required: z.boolean(),
      })
      .optional(),
    features: z.record(z.string(), z.unknown()).optional(),
    endpoints: z
      .record(
        z.string(),
        z.union([
          z.object({
            method: z.string(),
            path: z.string(),
          }),
          z.tuple([z.string(), z.string()]),
        ])
      )
      .optional(),
  })
  .passthrough();

export type HermesCapabilitiesResponse = z.infer<typeof hermesCapabilitiesSchema>;

/**
 * Hermes chat message schema.
 */
export const hermesChatMessageSchema = z.object({
  role: z.enum(["system", "user", "assistant", "tool"]),
  content: z.union([z.string(), z.array(z.record(z.string(), z.unknown()))]),
  name: z.string().optional(),
  tool_call_id: z.string().optional(),
});

export type HermesChatMessage = z.infer<typeof hermesChatMessageSchema>;

/**
 * Hermes chat completion request payload schema (POST /v1/chat/completions).
 */
export const hermesChatCompletionRequestSchema = z.object({
  model: z.string().default("hermes-agent"),
  messages: z.array(hermesChatMessageSchema),
  stream: z.boolean().optional().default(false),
  temperature: z.number().optional(),
  max_tokens: z.number().optional(),
});

export type HermesChatCompletionRequest = z.input<typeof hermesChatCompletionRequestSchema>;

/**
 * Hermes chat completion response schema (POST /v1/chat/completions).
 */
export const hermesChatCompletionResponseSchema = z
  .object({
    id: z.string(),
    object: z.string().optional(),
    created: z.number().optional(),
    model: z.string().optional(),
    choices: z
      .array(
        z.object({
          index: z.number(),
          message: z.object({
            role: z.string(),
            content: z.string().nullable().optional(),
            reasoning_content: z.string().nullable().optional(),
            tool_calls: z.array(z.unknown()).optional(),
          }),
          finish_reason: z.string().nullable().optional(),
        })
      )
      .min(1),
    usage: z
      .object({
        prompt_tokens: z.number().optional(),
        completion_tokens: z.number().optional(),
        total_tokens: z.number().optional(),
      })
      .optional(),
  })
  .passthrough();

export type HermesChatCompletionResponse = z.infer<typeof hermesChatCompletionResponseSchema>;

/**
 * Hermes error envelope schema (returned on 4xx/5xx responses).
 */
export const hermesErrorResponseSchema = z.object({
  error: z.object({
    message: z.string(),
    type: z.string().optional(),
    param: z.string().nullable().optional(),
    code: z.union([z.string(), z.number()]).nullable().optional(),
  }),
});

export type HermesErrorResponse = z.infer<typeof hermesErrorResponseSchema>;

/**
 * Hermes individual toolset schema (from GET /v1/toolsets).
 */
export const hermesToolsetSchema = z.object({
  name: z.string(),
  label: z.string().optional(),
  description: z.string().optional(),
  enabled: z.boolean(),
  configured: z.boolean().optional(),
  tools: z.array(z.string()).default([]),
});

export type HermesToolset = z.infer<typeof hermesToolsetSchema>;

/**
 * Hermes toolsets response schema (GET /v1/toolsets).
 */
export const hermesToolsetsResponseSchema = z.object({
  object: z.string().optional(),
  platform: z.string().optional(),
  data: z.array(hermesToolsetSchema),
});

export type HermesToolsetsResponse = z.infer<typeof hermesToolsetsResponseSchema>;

/**
 * Hermes Runs API request payload (POST /v1/runs).
 */
export const hermesRunRequestSchema = z.object({
  input: z.union([z.string(), z.array(z.record(z.string(), z.unknown()))]),
  conversation: z.string().optional(),
  session_id: z.string().optional(),
  previous_response_id: z.string().optional(),
  instructions: z.string().optional(),
  model: z.string().optional(),
});

export type HermesRunRequest = z.infer<typeof hermesRunRequestSchema>;

/**
 * Hermes Runs API response schema (POST /v1/runs and GET /v1/runs/{run_id}).
 */
export const hermesRunResponseSchema = z
  .object({
    object: z.string().optional(),
    run_id: z.string(),
    status: z
      .enum([
        "queued",
        "running",
        "waiting_for_approval",
        "completed",
        "failed",
        "cancelled",
        "interrupted",
      ])
      .or(z.string()),
    session_id: z.string().optional(),
    output: z
      .union([z.string(), z.array(z.unknown()), z.record(z.string(), z.unknown())])
      .optional(),
    error: z.string().nullable().optional(),
    usage: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

export type HermesRunResponse = z.infer<typeof hermesRunResponseSchema>;

/**
 * Hermes Responses API request payload (POST /v1/responses).
 */
export const hermesResponseRequestSchema = z.object({
  model: z.string().default("hermes-agent"),
  input: z.union([z.string(), z.array(z.record(z.string(), z.unknown()))]),
  instructions: z.string().optional(),
  conversation: z.string().optional(),
  previous_response_id: z.string().optional(),
  store: z.boolean().optional().default(true),
  stream: z.boolean().optional().default(false),
});

export type HermesResponseRequest = z.input<typeof hermesResponseRequestSchema>;

/**
 * Output item in a Hermes Response.
 */
export const hermesResponseOutputItemSchema = z
  .object({
    type: z.string(),
    status: z.string().optional(),
    name: z.string().optional(),
    call_id: z.string().optional(),
    arguments: z.string().optional(),
    output: z.string().optional(),
    role: z.string().optional(),
    content: z.array(z.record(z.string(), z.unknown())).optional(),
  })
  .passthrough();

export type HermesResponseOutputItem = z.infer<typeof hermesResponseOutputItemSchema>;

/**
 * Hermes Responses API response payload (POST /v1/responses).
 */
export const hermesResponseResponseSchema = z
  .object({
    id: z.string(),
    object: z.string().optional(),
    status: z.string(),
    model: z.string().optional(),
    output: z.array(hermesResponseOutputItemSchema).default([]),
    usage: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

export type HermesResponseResponse = z.infer<typeof hermesResponseResponseSchema>;

/**
 * Hermes Skill item schema (from GET /v1/skills).
 */
export const hermesSkillSchema = z
  .object({
    name: z.string(),
    description: z.string().optional(),
    category: z.string().optional(),
    path: z.string().optional(),
    version: z.string().optional(),
    author: z.string().optional(),
  })
  .passthrough();

export type HermesSkill = z.infer<typeof hermesSkillSchema>;

/**
 * Hermes Skills response schema (GET /v1/skills).
 */
export const hermesSkillsResponseSchema = z.object({
  object: z.string().optional(),
  data: z.array(hermesSkillSchema).default([]),
});

export type HermesSkillsResponse = z.infer<typeof hermesSkillsResponseSchema>;

/**
 * Normalized Hermes run event.
 */
export const hermesRunEventSchema = z
  .object({
    event: z.string(),
    data: z.record(z.string(), z.unknown()).or(z.string()),
    run_id: z.string().optional(),
  })
  .passthrough();

export type HermesRunEvent = z.infer<typeof hermesRunEventSchema>;
