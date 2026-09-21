import { z } from "zod";
import { verificationStatusSchema } from "@/lib/contracts/verification";
import { structuredResultSchema } from "@/lib/contracts/result";

export const taskStateSchema = z.enum([
  "queued",
  "planning",
  "executing",
  "waiting_for_approval",
  "verifying",
  "completed",
  "failed",
  "cancelled",
]);
export type TaskState = z.infer<typeof taskStateSchema>;

export const agentTaskSchema = z.object({
  id: z.string().min(1),
  runId: z.string().min(1),
  state: taskStateSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  currentAction: z.string().optional(),
  toolId: z.string().optional(),
  verificationStatus: verificationStatusSchema.optional(),
  finalResult: structuredResultSchema.optional(),
  error: z.string().optional(),
});
export type AgentTask = z.infer<typeof agentTaskSchema>;
