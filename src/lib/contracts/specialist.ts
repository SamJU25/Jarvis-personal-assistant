import { z } from "zod";

/**
 * Canonical specialist roles supported in JARVIS.
 */
export const specialistRoleSchema = z.enum([
  "research",
  "coding",
  "productivity",
  "memory",
  "communications",
]);

export type SpecialistRole = z.infer<typeof specialistRoleSchema>;

/**
 * Supported inference routing profiles.
 */
export const routingProfileSchema = z.enum(["fast", "reasoning", "coding"]);

export type RoutingProfile = z.infer<typeof routingProfileSchema>;

/**
 * Declarative specialist definition contract.
 */
export const specialistDefinitionSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
  role: z.string().min(1),
  preferredRoutingProfile: routingProfileSchema.default("fast"),
  allowedSkills: z.array(z.string()).default([]),
  allowedCapabilities: z.array(z.string()).default([]),
  maxExecutionTimeMs: z.number().positive().default(30000),
  concurrencyLimit: z.number().positive().default(2),
  userVisible: z.boolean().default(true),
  isTemporary: z.boolean().optional().default(false),
  createdAt: z.string().optional(),
});

export type SpecialistDefinition = z.infer<typeof specialistDefinitionSchema>;

/**
 * Specialist execution lifecycle states.
 */
export const specialistRunStateSchema = z.enum([
  "spawned",
  "running",
  "completed",
  "failed",
  "cancelled",
]);

export type SpecialistRunState = z.infer<typeof specialistRunStateSchema>;

/**
 * Active or completed specialist run record correlated to parent run.
 */
export const specialistRunSchema = z.object({
  subagentId: z.string().min(1),
  specialistId: z.string().min(1),
  displayName: z.string().min(1),
  parentRunId: z.string().min(1),
  hermesParentRunId: z.string().optional(),
  sessionId: z.string().min(1),
  goal: z.string().min(1),
  status: specialistRunStateSchema.default("spawned"),
  startedAt: z.string(),
  completedAt: z.string().optional(),
  durationMs: z.number().nonnegative().optional(),
  summary: z.string().optional(),
  error: z.string().optional(),
  toolCount: z.number().nonnegative().default(0),
  tokens: z
    .object({
      inputTokens: z.number().optional(),
      outputTokens: z.number().optional(),
      reasoningTokens: z.number().optional(),
    })
    .optional(),
});

export type SpecialistRun = z.infer<typeof specialistRunSchema>;

/**
 * Subtask specification for child specialist delegation.
 */
export const specialistTaskSpecSchema = z.object({
  specialistId: z.string(),
  goal: z.string().min(1),
  context: z.string().optional(),
  outputSchema: z.record(z.string(), z.unknown()).optional(),
});

export type SpecialistTaskSpec = z.infer<typeof specialistTaskSpecSchema>;

/**
 * Delegation decision and planned specialist subtasks.
 */
export const delegationPlanSchema = z.object({
  shouldDelegate: z.boolean(),
  reason: z.string(),
  targetSpecialists: z.array(z.string()).default([]),
  tasks: z.array(specialistTaskSpecSchema).default([]),
});

export type DelegationPlan = z.infer<typeof delegationPlanSchema>;
