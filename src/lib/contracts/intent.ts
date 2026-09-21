import { z } from "zod";

export const intentSafetyLevelSchema = z.enum([
  "safe",
  "confirmation_required",
  "safety_critical",
]);
export type IntentSafetyLevel = z.infer<typeof intentSafetyLevelSchema>;

export const intentChannelSchema = z.enum(["all", "text", "voice", "webhook"]);
export type IntentChannel = z.infer<typeof intentChannelSchema>;

export const intentRouteTypeSchema = z.enum([
  "deterministic",
  "semantic_hint",
  "fallback",
]);
export type IntentRouteType = z.infer<typeof intentRouteTypeSchema>;

export const intentContextRequirementSchema = z.enum([
  "none",
  "active_run",
  "reversible_action",
  "active_confirmation",
]);
export type IntentContextRequirement = z.infer<
  typeof intentContextRequirementSchema
>;

export interface AliasPattern {
  readonly pattern: string | RegExp;
  readonly exact?: boolean;
  readonly weight?: number;
}

export interface IntentDefinition {
  readonly id: string;
  readonly description: string;
  readonly aliases: readonly string[];
  readonly patterns?: readonly AliasPattern[];
  readonly channels: readonly IntentChannel[];
  readonly priority: number;
  readonly safetyLevel: IntentSafetyLevel;
  readonly confirmationRequired: boolean;
  readonly handlerTarget: string;
  readonly allowDeterministic: boolean;
  readonly requiresContext?: IntentContextRequirement;
  readonly active?: boolean;
  readonly examples: readonly string[];
  readonly nonExamples: readonly string[];
}

export interface IntentMatchContext {
  readonly hasActiveRun?: boolean;
  readonly activeRunId?: string;
  readonly hasReversibleAction?: boolean;
  readonly lastReversibleAction?: {
    readonly toolId: string;
    readonly undoAction?: string;
  };
  readonly hasActiveConfirmation?: boolean;
  readonly activeConfirmationId?: string;
  readonly channel?: IntentChannel;
}

export const intentMatchResultSchema = z.object({
  matched: z.boolean(),
  intentId: z.string().max(100).optional(),
  aliasMatched: z.string().max(150).optional(),
  confidence: z.number().min(0).max(1),
  route: intentRouteTypeSchema,
  handlerTarget: z.string().max(100).optional(),
  isDeterministic: z.boolean(),
  contextValid: z.boolean(),
  activeCapability: z.boolean().default(true),
  reason: z.string().max(300).optional(),
  candidateSummary: z.string().max(300).optional(),
  parameters: z.record(z.string(), z.unknown()).optional(),
});
export type IntentMatchResult = z.infer<typeof intentMatchResultSchema>;
