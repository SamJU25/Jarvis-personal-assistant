import type {
  JarvisTool,
  ToolMetadata,
  ToolPermission,
  CapabilityRiskLevel,
  CapabilityClass,
  ConfirmationPolicy,
} from "@/lib/contracts/tool";

export class ToolRegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ToolRegistryError";
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyJarvisTool = JarvisTool<any, any>;

export function defaultRiskLevel(permission: ToolPermission): CapabilityRiskLevel {
  switch (permission) {
    case "dangerous":
      return "critical";
    case "write":
      return "medium";
    case "memory":
    case "read":
    default:
      return "low";
  }
}

export function defaultCapabilityClass(permission: ToolPermission): CapabilityClass {
  switch (permission) {
    case "dangerous":
      return "admin";
    case "write":
      return "write";
    case "memory":
      return "idempotent_write";
    case "read":
    default:
      return "read";
  }
}

export function defaultConfirmationPolicy(permission: ToolPermission): ConfirmationPolicy {
  switch (permission) {
    case "dangerous":
      return "always";
    case "write":
      return "explicit";
    case "memory":
    case "read":
    default:
      return "none";
  }
}

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

  getCapability(id: string): (AnyJarvisTool & Required<Pick<JarvisTool, "riskLevel" | "capabilityClass" | "confirmationPolicy" | "verificationStrategy" | "reversible" | "timeoutMs" | "idempotent">>) | undefined {
    const tool = this.tools.get(id);
    if (!tool) return undefined;
    return {
      ...tool,
      riskLevel: tool.riskLevel ?? defaultRiskLevel(tool.permission),
      capabilityClass: tool.capabilityClass ?? defaultCapabilityClass(tool.permission),
      confirmationPolicy: tool.confirmationPolicy ?? defaultConfirmationPolicy(tool.permission),
      verificationStrategy: tool.verificationStrategy ?? (tool.permission === "write" ? `${tool.id}_verification` : "read_verification"),
      reversible: tool.reversible ?? (tool.permission === "read" || tool.permission === "memory"),
      timeoutMs: tool.timeoutMs ?? (tool.permission === "dangerous" ? 15000 : tool.permission === "write" ? 10000 : 5000),
      idempotent: tool.idempotent ?? (tool.permission === "read" || tool.permission === "memory"),
    };
  }

  isConfirmationRequired(id: string): boolean {
    const tool = this.tools.get(id);
    if (!tool) return false;
    const policy = tool.confirmationPolicy ?? defaultConfirmationPolicy(tool.permission);
    return policy === "explicit" || policy === "always";
  }

  getVerificationStrategy(id: string): string {
    const tool = this.tools.get(id);
    if (!tool) return "read_verification";
    return tool.verificationStrategy ?? (tool.permission === "write" ? `${tool.id}_verification` : "read_verification");
  }

  getMetadata(): readonly ToolMetadata[] {
    return Array.from(this.tools.values()).map((tool) => ({
      id: tool.id,
      name: tool.name,
      description: tool.description,
      permission: tool.permission,
      parameters: extractParametersFromSchema(tool.inputSchema),
      riskLevel: tool.riskLevel ?? defaultRiskLevel(tool.permission),
      capabilityClass: tool.capabilityClass ?? defaultCapabilityClass(tool.permission),
      confirmationPolicy: tool.confirmationPolicy ?? defaultConfirmationPolicy(tool.permission),
      verificationStrategy: tool.verificationStrategy ?? (tool.permission === "write" ? `${tool.id}_verification` : "read_verification"),
      reversible: tool.reversible ?? (tool.permission === "read" || tool.permission === "memory"),
      timeoutMs: tool.timeoutMs ?? (tool.permission === "dangerous" ? 15000 : tool.permission === "write" ? 10000 : 5000),
      idempotent: tool.idempotent ?? (tool.permission === "read" || tool.permission === "memory"),
      auditPolicy: tool.auditPolicy ?? { logParameters: true },
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
