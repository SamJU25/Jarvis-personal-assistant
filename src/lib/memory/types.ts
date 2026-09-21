import { z } from "zod";

export const MEMORY_CATEGORIES = [
  "preference",
  "project",
  "instruction",
  "fact",
  "reminder",
] as const;

export const memoryCategorySchema = z.enum(MEMORY_CATEGORIES);
export type MemoryCategory = z.infer<typeof memoryCategorySchema>;

export const memorySourceSchema = z.enum(["user_explicit", "conversation", "skill"]);
export type MemorySource = z.infer<typeof memorySourceSchema>;

export const memoryRecordSchema = z.object({
  id: z.string().min(1),
  content: z.string().trim().min(1).max(1_000),
  category: memoryCategorySchema,
  source: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type MemoryRecord = z.infer<typeof memoryRecordSchema>;

// Tool Schemas: search_memory
export const searchMemoryInputSchema = z.object({
  query: z.string().trim().min(1).max(200),
  limit: z.coerce.number().int().min(1).max(20).optional().default(5),
});

export const searchMemoryOutputSchema = z.object({
  query: z.string(),
  total: z.number().int().nonnegative(),
  memories: z.array(memoryRecordSchema),
});

export type SearchMemoryInput = z.input<typeof searchMemoryInputSchema>;
export type SearchMemoryOutput = z.infer<typeof searchMemoryOutputSchema>;

// Tool Schemas: store_memory
export const storeMemoryInputSchema = z.object({
  content: z.string().trim().min(1).max(1_000),
  category: memoryCategorySchema.optional().default("preference"),
  source: z.string().optional().default("user_explicit"),
});

export const storeMemoryOutputSchema = z.object({
  id: z.string(),
  content: z.string(),
  category: z.string(),
  createdAt: z.string(),
  status: z.enum(["stored", "duplicate"]),
});

export type StoreMemoryInput = z.input<typeof storeMemoryInputSchema>;
export type StoreMemoryOutput = z.infer<typeof storeMemoryOutputSchema>;

// Tool Schemas: list_memory
export const listMemoryInputSchema = z.object({
  category: memoryCategorySchema.optional(),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
});

export const listMemoryOutputSchema = z.object({
  total: z.number().int().nonnegative(),
  memories: z.array(memoryRecordSchema),
});

export type ListMemoryInput = z.input<typeof listMemoryInputSchema>;
export type ListMemoryOutput = z.infer<typeof listMemoryOutputSchema>;

// Tool Schemas: delete_memory
export const deleteMemoryInputSchema = z.object({
  id: z.string().trim().min(1),
});

export const deleteMemoryOutputSchema = z.object({
  success: z.boolean(),
  deletedId: z.string(),
  message: z.string(),
});

export type DeleteMemoryInput = z.infer<typeof deleteMemoryInputSchema>;
export type DeleteMemoryOutput = z.infer<typeof deleteMemoryOutputSchema>;
