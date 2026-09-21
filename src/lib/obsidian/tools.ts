import { z } from "zod";
import type { JarvisTool } from "@/lib/contracts/tool";
import type { ToolRegistry } from "@/lib/tools/registry";
import { getObsidianVaultPath } from "@/lib/obsidian/config";
import { searchVault, readVaultNote, createVaultNote } from "@/lib/obsidian/vault";

export const searchVaultInputSchema = z.object({
  query: z.string().trim().min(1, "Search query cannot be empty").max(500),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

export const searchVaultOutputSchema = z.object({
  query: z.string(),
  total: z.number().int().nonnegative(),
  results: z.array(
    z.object({
      path: z.string(),
      title: z.string(),
      excerpt: z.string(),
      modifiedAt: z.string(),
      tags: z.array(z.string()),
    })
  ),
});

export const searchVaultTool: JarvisTool<
  z.infer<typeof searchVaultInputSchema>,
  z.infer<typeof searchVaultOutputSchema>
> = {
  id: "search_vault",
  name: "Search Obsidian Vault",
  description:
    "Searches your personal Obsidian vault for notes matching keywords, topics, or phrases. Use when the user asks what they wrote about something, wants to find notes, or asks for information from their second brain.",
  inputSchema: searchVaultInputSchema,
  outputSchema: searchVaultOutputSchema,
  permission: "read",
  riskLevel: "low",
  capabilityClass: "read",
  confirmationPolicy: "none",
  verificationStrategy: "read_verification",
  reversible: true,
  timeoutMs: 5000,
  idempotent: true,
  renderer: "research",
  source: "obsidian",
  async execute(input) {
    const vaultRoot = getObsidianVaultPath();
    if (!vaultRoot) {
      throw new Error("Obsidian vault is not configured. Set OBSIDIAN_VAULT_PATH in server environment.");
    }
    return searchVault(vaultRoot, input.query, input.limit);
  },
};

export const readNoteInputSchema = z.object({
  path: z.string().trim().min(1, "Note path cannot be empty").max(500),
});

export const readNoteOutputSchema = z.object({
  path: z.string(),
  title: z.string(),
  content: z.string(),
  modifiedAt: z.string(),
  tags: z.array(z.string()),
});

export const readNoteTool: JarvisTool<
  z.infer<typeof readNoteInputSchema>,
  z.infer<typeof readNoteOutputSchema>
> = {
  id: "read_note",
  name: "Read Obsidian Note",
  description:
    "Reads the full content of a specific note in your Obsidian vault using its vault-relative path (e.g. 'Projects/DeepSeek.md'). Use when search results indicate a relevant note or exact note text is needed.",
  inputSchema: readNoteInputSchema,
  outputSchema: readNoteOutputSchema,
  permission: "read",
  riskLevel: "low",
  capabilityClass: "read",
  confirmationPolicy: "none",
  verificationStrategy: "read_verification",
  reversible: true,
  timeoutMs: 5000,
  idempotent: true,
  renderer: "note",
  source: "obsidian",
  async execute(input) {
    const vaultRoot = getObsidianVaultPath();
    if (!vaultRoot) {
      throw new Error("Obsidian vault is not configured. Set OBSIDIAN_VAULT_PATH in server environment.");
    }
    return readVaultNote(vaultRoot, input.path);
  },
};

export const createNoteInputSchema = z.object({
  title: z.string().trim().min(1, "Title cannot be empty").max(200),
  content: z.string().min(1, "Content cannot be empty").max(100_000),
  folder: z.string().trim().max(300).optional(),
});

export const createNoteOutputSchema = z.object({
  path: z.string(),
  title: z.string(),
  createdAt: z.string(),
});

export const createNoteTool: JarvisTool<
  z.infer<typeof createNoteInputSchema>,
  z.infer<typeof createNoteOutputSchema>
> = {
  id: "create_note",
  name: "Create Obsidian Note",
  description:
    "Creates a new Markdown note in your Obsidian vault. Use when the user explicitly asks to take a note, write a note, or record information in their Obsidian vault. Default destination is 'Inbox/JARVIS/'.",
  inputSchema: createNoteInputSchema,
  outputSchema: createNoteOutputSchema,
  permission: "write",
  riskLevel: "medium",
  capabilityClass: "write",
  confirmationPolicy: "explicit",
  verificationStrategy: "note_verification",
  reversible: false,
  timeoutMs: 10000,
  idempotent: false,
  renderer: "note",
  source: "obsidian",
  async execute(input) {
    const vaultRoot = getObsidianVaultPath();
    if (!vaultRoot) {
      throw new Error("Obsidian vault is not configured. Set OBSIDIAN_VAULT_PATH in server environment.");
    }
    return createVaultNote(vaultRoot, input.title, input.content, input.folder);
  },
};

export function registerObsidianTools(registry: ToolRegistry): void {
  registry.register(searchVaultTool);
  registry.register(readNoteTool);
  registry.register(createNoteTool);
}
