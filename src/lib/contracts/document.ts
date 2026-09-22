import { z } from "zod";

export const documentCategorySchema = z.enum([
  "text",
  "markdown",
  "code",
  "data",
  "document",
  "image",
  "audio",
  "video",
  "archive",
  "binary",
  "directory",
]);

export type DocumentCategory = z.infer<typeof documentCategorySchema>;

export const allowedRootSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  path: z.string().min(1),
  readOnly: z.boolean().default(false),
});

export type AllowedRoot = z.infer<typeof allowedRootSchema>;

export const documentEntrySchema = z.object({
  name: z.string().min(1),
  path: z.string().min(1),
  rootId: z.string().min(1),
  sizeBytes: z.number().nonnegative(),
  mimeType: z.string(),
  category: documentCategorySchema,
  modifiedAt: z.string(),
  isBinary: z.boolean(),
  isDirectory: z.boolean(),
});

export type DocumentEntry = z.infer<typeof documentEntrySchema>;

export const documentContentResultSchema = z.object({
  name: z.string().min(1),
  path: z.string().min(1),
  rootId: z.string().min(1),
  sizeBytes: z.number().nonnegative(),
  mimeType: z.string(),
  category: documentCategorySchema,
  isBinary: z.boolean(),
  content: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  truncated: z.boolean().optional(),
});

export type DocumentContentResult = z.infer<typeof documentContentResultSchema>;

// Tool schemas

export const listDocumentsInputSchema = z.object({
  path: z.string().default(""),
  rootId: z.string().optional(),
  recursive: z.boolean().default(false),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

export type ListDocumentsInput = z.input<typeof listDocumentsInputSchema>;

export const listDocumentsOutputSchema = z.object({
  rootId: z.string(),
  path: z.string(),
  total: z.number().nonnegative(),
  entries: z.array(documentEntrySchema),
});

export type ListDocumentsOutput = z.infer<typeof listDocumentsOutputSchema>;

export const readDocumentInputSchema = z.object({
  path: z.string().min(1, "Path cannot be empty"),
  rootId: z.string().optional(),
  maxBytes: z.coerce.number().int().positive().max(1_000_000).default(500_000),
});

export type ReadDocumentInput = z.input<typeof readDocumentInputSchema>;

export const readDocumentOutputSchema = documentContentResultSchema;

export type ReadDocumentOutput = z.infer<typeof readDocumentOutputSchema>;

export const writeDocumentInputSchema = z.object({
  path: z.string().min(1, "Path cannot be empty"),
  content: z.string().max(1_000_000, "Content cannot exceed 1MB"),
  rootId: z.string().optional(),
  title: z.string().optional(),
});

export type WriteDocumentInput = z.input<typeof writeDocumentInputSchema>;

export const writeDocumentOutputSchema = z.object({
  path: z.string(),
  rootId: z.string(),
  sizeBytes: z.number().nonnegative(),
  sha256: z.string(),
  writtenAt: z.string(),
});

export type WriteDocumentOutput = z.infer<typeof writeDocumentOutputSchema>;
