import { z } from "zod";
import { toolResultSchema } from "@/lib/contracts/tool";

export const verificationStatusSchema = z.enum(["passed", "failed", "skipped"]);
export type VerificationStatus = z.infer<typeof verificationStatusSchema>;

export const verificationEvidenceTypeSchema = z.enum([
  "file",
  "document",
  "email",
  "schema",
  "memory",
  "other",
]);
export type VerificationEvidenceType = z.infer<typeof verificationEvidenceTypeSchema>;

export const verificationEvidenceSchema = z.object({
  type: verificationEvidenceTypeSchema,
  description: z.string().min(1),
  details: z.record(z.string(), z.unknown()).optional(),
});
export type VerificationEvidence = z.infer<typeof verificationEvidenceSchema>;

export const verificationRequestSchema = z.object({
  runId: z.string().min(1),
  taskId: z.string().optional(),
  toolId: z.string().min(1),
  parameters: z.record(z.string(), z.unknown()).default({}),
  toolResult: toolResultSchema,
  expectedOutcome: z.string().optional(),
  timestamp: z.string(),
});
export type VerificationRequest = z.infer<typeof verificationRequestSchema>;

export const verificationResultSchema = z.object({
  runId: z.string().min(1),
  taskId: z.string().optional(),
  toolId: z.string().min(1),
  status: verificationStatusSchema,
  verifiedAt: z.string(),
  evidence: z.array(verificationEvidenceSchema),
  reason: z.string().optional(),
  error: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type VerificationResult = z.infer<typeof verificationResultSchema>;
