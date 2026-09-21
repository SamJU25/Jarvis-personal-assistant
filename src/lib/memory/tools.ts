import type { JarvisTool } from "@/lib/contracts/tool";
import type { ToolRegistry } from "@/lib/tools/registry";
import { getMemoryService, MemoryService } from "./service";
import {
  searchMemoryInputSchema,
  searchMemoryOutputSchema,
  storeMemoryInputSchema,
  storeMemoryOutputSchema,
  listMemoryInputSchema,
  listMemoryOutputSchema,
  deleteMemoryInputSchema,
  deleteMemoryOutputSchema,
  type SearchMemoryInput,
  type SearchMemoryOutput,
  type StoreMemoryInput,
  type StoreMemoryOutput,
  type ListMemoryInput,
  type ListMemoryOutput,
  type DeleteMemoryInput,
  type DeleteMemoryOutput,
} from "./types";

export function createSearchMemoryTool(
  service: MemoryService = getMemoryService()
): JarvisTool<SearchMemoryInput, SearchMemoryOutput> {
  return {
    id: "search_memory",
    name: "Search Memory",
    description:
      "Searches persistent memory for relevant facts, preferences, instructions, and user context. Use when the user asks what JARVIS remembers about a topic, asks about their preferences, or when past user context is needed. Do not use for searching files or emails.",
    inputSchema: searchMemoryInputSchema,
    outputSchema: searchMemoryOutputSchema,
    permission: "read",
    riskLevel: "low",
    capabilityClass: "read",
    confirmationPolicy: "none",
    verificationStrategy: "read_verification",
    reversible: true,
    timeoutMs: 5000,
    idempotent: true,
    renderer: "insight",
    source: "memory",
    async execute(input) {
      return service.searchMemory(input);
    },
  };
}

export function createStoreMemoryTool(
  service: MemoryService = getMemoryService()
): JarvisTool<StoreMemoryInput, StoreMemoryOutput> {
  return {
    id: "store_memory",
    name: "Store Memory",
    description:
      "Saves an intentionally requested fact, user preference, instruction, or reminder to persistent memory. Use ONLY when the user explicitly asks to remember, save, or store information for future sessions. Never use for ordinary conversation, notes, or external data.",
    inputSchema: storeMemoryInputSchema,
    outputSchema: storeMemoryOutputSchema,
    permission: "memory",
    riskLevel: "low",
    capabilityClass: "idempotent_write",
    confirmationPolicy: "none",
    verificationStrategy: "read_verification",
    reversible: true,
    timeoutMs: 5000,
    idempotent: true,
    renderer: "insight",
    source: "memory",
    async execute(input) {
      return service.storeMemory(input);
    },
  };
}

export function createListMemoryTool(
  service: MemoryService = getMemoryService()
): JarvisTool<ListMemoryInput, ListMemoryOutput> {
  return {
    id: "list_memory",
    name: "List Memory",
    description:
      "Lists stored memories, optionally filtered by category (preference, project, instruction, fact, reminder). Use when the user asks to inspect, view, or review all saved memories.",
    inputSchema: listMemoryInputSchema,
    outputSchema: listMemoryOutputSchema,
    permission: "read",
    riskLevel: "low",
    capabilityClass: "read",
    confirmationPolicy: "none",
    verificationStrategy: "read_verification",
    reversible: true,
    timeoutMs: 5000,
    idempotent: true,
    renderer: "generic",
    source: "memory",
    async execute(input) {
      return service.listMemory(input);
    },
  };
}

export function createDeleteMemoryTool(
  service: MemoryService = getMemoryService()
): JarvisTool<DeleteMemoryInput, DeleteMemoryOutput> {
  return {
    id: "delete_memory",
    name: "Delete Memory",
    description:
      "Removes a specific memory record by its ID. Use when the user explicitly requests to forget or delete a stored memory or preference.",
    inputSchema: deleteMemoryInputSchema,
    outputSchema: deleteMemoryOutputSchema,
    permission: "memory",
    riskLevel: "medium",
    capabilityClass: "write",
    confirmationPolicy: "none",
    verificationStrategy: "read_verification",
    reversible: false,
    timeoutMs: 5000,
    idempotent: true,
    renderer: "generic",
    source: "memory",
    async execute(input) {
      return service.deleteMemory(input);
    },
  };
}

export function registerMemoryTools(
  registry: ToolRegistry,
  service: MemoryService = getMemoryService()
): void {
  registry.register(createSearchMemoryTool(service));
  registry.register(createStoreMemoryTool(service));
  registry.register(createListMemoryTool(service));
  registry.register(createDeleteMemoryTool(service));
}
