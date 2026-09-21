import { z } from "zod";
import type { JarvisTool } from "@/lib/contracts/tool";
import { ToolRegistry } from "@/lib/tools/registry";
import { registerObsidianTools } from "@/lib/obsidian/tools";
import { registerGoogleTools } from "@/lib/google/tools";
import { registerMemoryTools } from "@/lib/memory/tools";

export const DEMO_DATASET = [
  {
    id: "demo-item-1",
    title: "JARVIS Operating Philosophy",
    content: "JARVIS is a local-first personal AI operating assistant focused on reliable tools, well-defined processes, and natural language command execution.",
    category: "architecture",
    tags: ["jarvis", "philosophy", "local-first"],
    lastModified: "2026-09-01T10:00:00.000Z",
  },
  {
    id: "demo-item-2",
    title: "Agentic Tool Registry Design",
    content: "The tool registry enforces strict permission boundaries (read, write, dangerous) and Zod schema validation before execution, keeping the model strictly within safe bounds.",
    category: "security",
    tags: ["tools", "registry", "permissions", "security"],
    lastModified: "2026-09-10T14:30:00.000Z",
  },
  {
    id: "demo-item-3",
    title: "Command Code Integration Notes",
    content: "Command Code runs headless via its bundled CLI entry with plan permissions, parsing NDJSON and emitting safe event streams to the JARVIS shell.",
    category: "provider",
    tags: ["command-code", "headless", "ndjson"],
    lastModified: "2026-09-15T09:15:00.000Z",
  },
] as const;

export const currentTimeInputSchema = z.object({
  timezone: z.string().optional(),
});

export const currentTimeOutputSchema = z.object({
  iso: z.string(),
  date: z.string(),
  time: z.string(),
  timezone: z.string(),
});

export const getCurrentTimeTool: JarvisTool<
  z.infer<typeof currentTimeInputSchema>,
  z.infer<typeof currentTimeOutputSchema>
> = {
  id: "get_current_time",
  name: "Get Current Time",
  description:
    "Returns the current server date and time. Use when the user asks for the current time, date, day of the week, or needs a timestamp reference.",
  inputSchema: currentTimeInputSchema,
  outputSchema: currentTimeOutputSchema,
  permission: "read",
  riskLevel: "low",
  capabilityClass: "read",
  confirmationPolicy: "none",
  verificationStrategy: "read_verification",
  reversible: true,
  timeoutMs: 5000,
  idempotent: true,
  renderer: "generic",
  source: "system",
  async execute(input) {
    const now = new Date();
    const tz = input.timezone || "UTC";
    let dateStr: string;
    let timeStr: string;
    try {
      dateStr = now.toLocaleDateString("en-US", { timeZone: tz, dateStyle: "full" });
      timeStr = now.toLocaleTimeString("en-US", { timeZone: tz, timeStyle: "medium" });
    } catch {
      dateStr = now.toLocaleDateString("en-US", { timeZone: "UTC", dateStyle: "full" });
      timeStr = now.toLocaleTimeString("en-US", { timeZone: "UTC", timeStyle: "medium" });
    }
    return {
      iso: now.toISOString(),
      date: dateStr,
      time: timeStr,
      timezone: tz,
    };
  },
};

export const searchDemoDataInputSchema = z.object({
  query: z.string().trim().min(1),
});

export const searchDemoDataOutputSchema = z.object({
  query: z.string(),
  total: z.number().int().nonnegative(),
  results: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      summary: z.string(),
      category: z.string(),
    })
  ),
});

export const searchDemoDataTool: JarvisTool<
  z.infer<typeof searchDemoDataInputSchema>,
  z.infer<typeof searchDemoDataOutputSchema>
> = {
  id: "search_demo_data",
  name: "Search Demo Data",
  description:
    "Searches the deterministic demo knowledge collection by keyword. Use when the user asks to search or find notes or articles in demo data.",
  inputSchema: searchDemoDataInputSchema,
  outputSchema: searchDemoDataOutputSchema,
  permission: "read",
  riskLevel: "low",
  capabilityClass: "read",
  confirmationPolicy: "none",
  verificationStrategy: "read_verification",
  reversible: true,
  timeoutMs: 5000,
  idempotent: true,
  renderer: "research",
  source: "demo_database",
  async execute(input) {
    const q = input.query.toLowerCase();
    const matches = DEMO_DATASET.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.content.toLowerCase().includes(q) ||
        item.tags.some((t) => t.toLowerCase().includes(q))
    );
    return {
      query: input.query,
      total: matches.length,
      results: matches.map((item) => ({
        id: item.id,
        title: item.title,
        summary: item.content.slice(0, 100) + (item.content.length > 100 ? "..." : ""),
        category: item.category,
      })),
    };
  },
};

export const readDemoItemInputSchema = z.object({
  id: z.string().trim().min(1),
});

export const readDemoItemOutputSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  category: z.string(),
  tags: z.array(z.string()),
  lastModified: z.string(),
});

export const readDemoItemTool: JarvisTool<
  z.infer<typeof readDemoItemInputSchema>,
  z.infer<typeof readDemoItemOutputSchema>
> = {
  id: "read_demo_item",
  name: "Read Demo Item",
  description:
    "Retrieves the full content of a specific item from demo data using its exact ID. Use after searching when full item details are needed.",
  inputSchema: readDemoItemInputSchema,
  outputSchema: readDemoItemOutputSchema,
  permission: "read",
  riskLevel: "low",
  capabilityClass: "read",
  confirmationPolicy: "none",
  verificationStrategy: "read_verification",
  reversible: true,
  timeoutMs: 5000,
  idempotent: true,
  renderer: "note",
  source: "demo_database",
  async execute(input) {
    const item = DEMO_DATASET.find((entry) => entry.id === input.id);
    if (!item) {
      throw new Error(`Item with ID "${input.id}" not found in demo data.`);
    }
    return {
      id: item.id,
      title: item.title,
      content: item.content,
      category: item.category,
      tags: [...item.tags],
      lastModified: item.lastModified,
    };
  },
};

export function createDefaultToolRegistry(): ToolRegistry {
  const registry = new ToolRegistry();
  registry.register(getCurrentTimeTool);
  registry.register(searchDemoDataTool);
  registry.register(readDemoItemTool);
  registerObsidianTools(registry);
  registerGoogleTools(registry);
  registerMemoryTools(registry);
  return registry;
}
