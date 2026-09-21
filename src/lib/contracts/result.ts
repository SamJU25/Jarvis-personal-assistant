import { z } from "zod";
import { pendingConfirmationSchema, type PendingConfirmation } from "@/lib/contracts/confirmation";
export type { PendingConfirmation };

const baseCardSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
});

export const meetingCardSchema = baseCardSchema.extend({
  type: z.literal("meeting"),
  title: z.string(),
  time: z.string(),
  attendees: z.array(z.string()),
  focus: z.array(z.string()),
});

export const calendarCardSchema = baseCardSchema.extend({
  type: z.literal("calendar"),
  date: z.string(),
  events: z.array(z.object({ time: z.string(), title: z.string(), detail: z.string() })),
});

export const emailCardSchema = baseCardSchema.extend({
  type: z.literal("email"),
  sender: z.string(),
  subject: z.string(),
  preview: z.string(),
  receivedAt: z.string(),
});

export const noteCardSchema = baseCardSchema.extend({
  type: z.literal("note"),
  title: z.string(),
  excerpt: z.string(),
  path: z.string(),
  modifiedAt: z.string(),
});

export const insightCardSchema = baseCardSchema.extend({
  type: z.literal("insight"),
  title: z.string(),
  body: z.string(),
  confidence: z.enum(["observed", "inferred", "uncertain"]),
});

export const actionCardSchema = baseCardSchema.extend({
  type: z.literal("action"),
  title: z.string(),
  detail: z.string(),
  status: z.enum(["proposed", "blocked", "ready"]),
});

export const documentCardSchema = baseCardSchema.extend({
  type: z.literal("document"),
  title: z.string(),
  format: z.string(),
  summary: z.string(),
  modifiedAt: z.string(),
});

export const researchCardSchema = baseCardSchema.extend({
  type: z.literal("research"),
  topic: z.string(),
  summary: z.string(),
  findings: z.array(z.string()),
});

export const sourceCardSchema = baseCardSchema.extend({
  type: z.literal("source"),
  title: z.string(),
  sourceType: z.string(),
  location: z.string(),
});

export const genericCardSchema = baseCardSchema.extend({
  type: z.literal("generic"),
  title: z.string(),
  body: z.string(),
});

export const resultCardSchema = z.discriminatedUnion("type", [
  meetingCardSchema,
  calendarCardSchema,
  emailCardSchema,
  noteCardSchema,
  insightCardSchema,
  actionCardSchema,
  documentCardSchema,
  researchCardSchema,
  sourceCardSchema,
  genericCardSchema,
]);

export const sourceSchema = z.object({
  id: z.string(),
  title: z.string(),
  kind: z.enum(["calendar", "email", "note", "document", "research"]),
  location: z.string(),
});

export const structuredResultSchema = z.object({
  speech: z.string(),
  title: z.string(),
  state: z
    .enum(["complete", "failed", "waiting_for_approval", "pending_confirmation"])
    .transform((s): "complete" | "failed" | "waiting_for_approval" => (s === "pending_confirmation" ? "waiting_for_approval" : s)),
  cards: z.array(resultCardSchema),
  sources: z.array(sourceSchema),
  confirmation: pendingConfirmationSchema.optional(),
});

export type ResultCard = z.infer<typeof resultCardSchema>;
export type Source = z.infer<typeof sourceSchema>;
export type StructuredResult = z.infer<typeof structuredResultSchema>;
