import { z } from "zod";

export const skillMetadataSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  whenToUse: z.array(z.string()),
  preferredTools: z.array(z.string()),
});

export const skillDefinitionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  purpose: z.string().min(1),
  description: z.string().min(1),
  whenToUse: z.array(z.string()).min(1),
  process: z.array(z.string()).min(1),
  preferredTools: z.array(z.string()),
  decisionRules: z.array(z.string()),
  expectedOutput: z.string().min(1),
});

export type SkillMetadata = z.infer<typeof skillMetadataSchema>;
export type SkillDefinition = z.infer<typeof skillDefinitionSchema>;
