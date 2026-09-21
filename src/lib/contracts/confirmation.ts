import { z } from "zod";

export const confirmationStatusSchema = z.enum([
  "pending",
  "confirmed",
  "cancelled",
  "expired",
  "consumed",
  "failed",
]);

export type ConfirmationStatus = z.infer<typeof confirmationStatusSchema>;

export const confirmationActionCategorySchema = z.enum([
  "note",
  "document",
  "email",
  "calendar",
  "other",
]);

export type ConfirmationActionCategory = z.infer<typeof confirmationActionCategorySchema>;

export const pendingConfirmationSchema = z.object({
  id: z.string().min(1),
  originatingRunId: z.string().min(1),
  toolId: z.string().min(1),
  actionCategory: confirmationActionCategorySchema,
  title: z.string().min(1),
  target: z.string().min(1),
  summary: z.string().min(1),
  preview: z.string().max(4000),
  parameters: z.record(z.string(), z.unknown()),
  status: confirmationStatusSchema,
  createdAt: z.string(),
  expiresAt: z.string(),
});

export type PendingConfirmation = z.infer<typeof pendingConfirmationSchema>;

export const confirmationRequestSchema = z.object({
  confirmationId: z.string().min(1),
  action: z.enum(["confirm", "cancel"]),
});

export type ConfirmationRequest = z.infer<typeof confirmationRequestSchema>;

export const confirmationResponseSchema = z.object({
  status: z.enum(["success", "cancelled", "expired", "failed"]),
  confirmationId: z.string(),
  message: z.string(),
  result: z.unknown().optional(),
});

export type ConfirmationResponse = z.infer<typeof confirmationResponseSchema>;
