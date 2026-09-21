import type { JarvisTool, ToolMetadata } from "@/lib/contracts/tool";

export class ToolRegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ToolRegistryError";
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyJarvisTool = JarvisTool<any, any>;

export class ToolRegistry {
  private readonly tools = new Map<string, AnyJarvisTool>();

  register<TInput, TOutput>(tool: JarvisTool<TInput, TOutput>): void {
    if (!tool || typeof tool !== "object") {
      throw new ToolRegistryError("Invalid tool: tool must be an object.");
    }
    if (!tool.id || typeof tool.id !== "string" || !tool.id.trim()) {
      throw new ToolRegistryError("Tool id must be a non-empty string.");
    }
    if (this.tools.has(tool.id)) {
      throw new ToolRegistryError(`Tool with ID "${tool.id}" is already registered.`);
    }
    if (!tool.name || typeof tool.name !== "string" || !tool.name.trim()) {
      throw new ToolRegistryError(`Tool "${tool.id}" must have a non-empty name.`);
    }
    if (!tool.description || typeof tool.description !== "string" || !tool.description.trim()) {
      throw new ToolRegistryError(`Tool "${tool.id}" must have a non-empty description.`);
    }
    if (!["read", "write", "dangerous", "memory"].includes(tool.permission)) {
      throw new ToolRegistryError(`Tool "${tool.id}" has invalid permission: ${tool.permission}`);
    }
    if (!tool.inputSchema || typeof tool.inputSchema.parse !== "function") {
      throw new ToolRegistryError(`Tool "${tool.id}" must provide a valid Zod input schema.`);
    }
    if (!tool.outputSchema || typeof tool.outputSchema.parse !== "function") {
      throw new ToolRegistryError(`Tool "${tool.id}" must provide a valid Zod output schema.`);
    }
    if (typeof tool.execute !== "function") {
      throw new ToolRegistryError(`Tool "${tool.id}" must have an execute function.`);
    }

    this.tools.set(tool.id, tool as AnyJarvisTool);
  }

  get(id: string): AnyJarvisTool | undefined {
    return this.tools.get(id);
  }

  has(id: string): boolean {
    return this.tools.has(id);
  }

  list(): readonly AnyJarvisTool[] {
    return Array.from(this.tools.values());
  }

  getMetadata(): readonly ToolMetadata[] {
    return Array.from(this.tools.values()).map((tool) => ({
      id: tool.id,
      name: tool.name,
      description: tool.description,
      permission: tool.permission,
      parameters: extractParametersFromSchema(tool.inputSchema),
    }));
  }
}

function extractParametersFromSchema(schema: unknown): Record<string, unknown> {
  if (!schema || typeof schema !== "object") return {};
  const shape = (schema as { shape?: Record<string, unknown> }).shape;
  if (shape && typeof shape === "object") {
    const params: Record<string, unknown> = {};
    for (const [key, prop] of Object.entries(shape)) {
      const typeName = (prop as { _def?: { typeName?: string } })._def?.typeName ?? "unknown";
      params[key] = { type: typeName.replace(/^Zod/, "").toLowerCase() };
    }
    return params;
  }
  return {};
}
