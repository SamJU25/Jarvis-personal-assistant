import { z, type ZodType } from "zod";
import type { ResultCard } from "@/lib/contracts/result";

export type ToolPermission = "read" | "write" | "dangerous" | "memory";

export type CapabilityRiskLevel = "low" | "medium" | "high" | "critical";
export type CapabilityClass = "read" | "write" | "idempotent_write" | "admin";
export type ConfirmationPolicy = "none" | "explicit" | "always";

export interface CapabilityAuditPolicy {
  logParameters?: boolean;
  redactFields?: string[];
  retentionDays?: number;
}

export interface ToolContext {
  signal: AbortSignal;
  callId: string;
}

export interface JarvisTool<TInput = unknown, TOutput = unknown> {
  id: string;
  name: string;
  description: string;
  inputSchema: ZodType<TInput>;
  outputSchema: ZodType<TOutput>;
  permission: ToolPermission;
  renderer: ResultCard["type"];
  source: string;
  execute: (input: TInput, context: ToolContext) => Promise<TOutput>;

  // Phase 06: Declarative Capability Metadata
  riskLevel?: CapabilityRiskLevel;
  capabilityClass?: CapabilityClass;
  confirmationPolicy?: ConfirmationPolicy;
  verificationStrategy?: string;
  reversible?: boolean;
  timeoutMs?: number;
  idempotent?: boolean;
  auditPolicy?: CapabilityAuditPolicy;
}

export type Tool<TInput = unknown, TOutput = unknown> = JarvisTool<TInput, TOutput>;

export interface ToolMetadata {
  id: string;
  name: string;
  description: string;
  permission: ToolPermission;
  parameters: Record<string, unknown>;

  // Phase 06: Optional resolved capability metadata
  riskLevel?: CapabilityRiskLevel;
  capabilityClass?: CapabilityClass;
  confirmationPolicy?: ConfirmationPolicy;
  verificationStrategy?: string;
  reversible?: boolean;
  timeoutMs?: number;
  idempotent?: boolean;
  auditPolicy?: CapabilityAuditPolicy;
}

export const toolCallRequestSchema = z.object({
  type: z.literal("tool_call"),
  callId: z.string().min(1),
  toolId: z.string().min(1),
  arguments: z.record(z.string(), z.unknown()).default({}),
});

export type ToolCallRequest = z.infer<typeof toolCallRequestSchema>;

export const toolResultSchema = z.object({
  callId: z.string().min(1),
  toolId: z.string().min(1),
  status: z.enum(["success", "failure"]),
  output: z.unknown().optional(),
  error: z.string().optional(),
});

export type ToolResult = z.infer<typeof toolResultSchema>;

