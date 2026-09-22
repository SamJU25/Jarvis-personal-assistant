import {
  type SpecialistDefinition,
  type RoutingProfile,
  specialistDefinitionSchema,
} from "@/lib/contracts/specialist";
import { DEFAULT_SPECIALISTS } from "./default-specialists";

export interface CreateTemporarySpecialistOptions {
  id?: string;
  displayName?: string;
  role: string;
  allowedCapabilities?: string[];
  allowedSkills?: string[];
  maxExecutionTimeMs?: number;
  preferredRoutingProfile?: RoutingProfile;
  parentAllowedCapabilities?: string[];
}

/**
 * In-memory declarative registry for JARVIS specialist agent roles.
 * Provides role lookup, task matching, and bounded temporary specialist creation.
 */
export class SpecialistRegistry {
  private readonly specialists = new Map<string, SpecialistDefinition>();
  private readonly temporarySpecialists = new Map<string, SpecialistDefinition>();

  constructor(initialSpecialists?: readonly SpecialistDefinition[]) {
    const list = initialSpecialists ?? DEFAULT_SPECIALISTS;
    for (const spec of list) {
      this.register(spec);
    }
  }

  /**
   * Register a persistent specialist definition.
   */
  register(specialist: SpecialistDefinition): void {
    const validated = specialistDefinitionSchema.parse(specialist);
    this.specialists.set(validated.id, validated);
  }

  /**
   * Retrieve a specialist by ID (checks permanent and temporary specialists).
   */
  get(id: string): SpecialistDefinition | undefined {
    return this.specialists.get(id) ?? this.temporarySpecialists.get(id);
  }

  /**
   * Check if a specialist ID exists.
   */
  has(id: string): boolean {
    return this.specialists.has(id) || this.temporarySpecialists.has(id);
  }

  /**
   * List all permanent user-visible or all specialists.
   */
  list(includeHidden = false): SpecialistDefinition[] {
    const all = Array.from(this.specialists.values());
    if (includeHidden) {
      return all;
    }
    return all.filter((s) => s.userVisible);
  }

  /**
   * List all registered specialists including active temporary ones.
   */
  listAll(): SpecialistDefinition[] {
    return [
      ...Array.from(this.specialists.values()),
      ...Array.from(this.temporarySpecialists.values()),
    ];
  }

  /**
   * Creates a bounded, task-scoped temporary specialist definition.
   * Enforces:
   * - Bounded tool capabilities (cannot exceed parent toolset).
   * - Bounded execution lifetime (clamped to max 60s).
   * - Explicit objective and output contract.
   * - Does NOT persist across system restart.
   */
  createTemporarySpecialist(options: CreateTemporarySpecialistOptions): SpecialistDefinition {
    const tempId = options.id || `temp-${crypto.randomUUID().slice(0, 8)}`;
    const displayName = options.displayName || `Specialist (${tempId})`;

    // Filter capabilities to never exceed parent authorization
    let capabilities = options.allowedCapabilities ?? [];
    if (options.parentAllowedCapabilities && options.parentAllowedCapabilities.length > 0) {
      const allowedSet = new Set(options.parentAllowedCapabilities);
      capabilities = capabilities.filter((c) => allowedSet.has(c));
    }

    // Clamp timeout to 60s maximum for temporary specialists
    const maxTime = Math.min(Math.max(5000, options.maxExecutionTimeMs ?? 30000), 60000);

    const definition: SpecialistDefinition = {
      id: tempId,
      displayName,
      role: options.role,
      preferredRoutingProfile: options.preferredRoutingProfile ?? "fast",
      allowedSkills: options.allowedSkills ?? [],
      allowedCapabilities: capabilities,
      maxExecutionTimeMs: maxTime,
      concurrencyLimit: 1,
      userVisible: true,
      isTemporary: true,
      createdAt: new Date().toISOString(),
    };

    const validated = specialistDefinitionSchema.parse(definition);
    this.temporarySpecialists.set(validated.id, validated);
    return validated;
  }

  /**
   * Release/remove a temporary specialist after its task concludes.
   */
  releaseTemporarySpecialist(id: string): boolean {
    return this.temporarySpecialists.delete(id);
  }

  /**
   * Match a task description or query to the most appropriate specialist role.
   */
  findBestSpecialist(taskDescription: string): SpecialistDefinition | undefined {
    const normalized = taskDescription.toLowerCase();

    // 1. Academic & Assignment domain
    if (
      normalized.includes("assignment") ||
      normalized.includes("essay") ||
      normalized.includes("thesis") ||
      normalized.includes("dissertation") ||
      normalized.includes("literature review") ||
      normalized.includes("citation") ||
      normalized.includes("bibtex") ||
      normalized.includes("rubric") ||
      normalized.includes("coursework") ||
      normalized.includes("lab report")
    ) {
      return this.get("academic");
    }

    // 2. Marketing & Growth domain
    if (
      normalized.includes("marketing") ||
      normalized.includes("growth") ||
      normalized.includes("copywriting") ||
      normalized.includes("product hunt") ||
      normalized.includes("show hn") ||
      normalized.includes("social media") ||
      normalized.includes("launch strategy") ||
      normalized.includes("seo") ||
      normalized.includes("viral")
    ) {
      return this.get("marketing");
    }

    // 3. Quality, Testing & Debugging domain
    if (
      /\b(test|tests|testing|tdd|debug|debugging)\b/.test(normalized) ||
      normalized.includes("vulnerability") ||
      normalized.includes("security review") ||
      normalized.includes("performance") ||
      normalized.includes("web vitals") ||
      normalized.includes("lighthouse") ||
      normalized.includes("verification loop")
    ) {
      return this.get("quality");
    }

    // 4. Frontend & UI/UX domain
    if (
      normalized.includes("frontend") ||
      /\b(ui|ux|css)\b/.test(normalized) ||
      normalized.includes("tailwind") ||
      normalized.includes("react") ||
      normalized.includes("nextjs") ||
      normalized.includes("component") ||
      normalized.includes("remotion") ||
      normalized.includes("landing page")
    ) {
      return this.get("frontend");
    }

    // 5. Backend & Systems domain
    if (
      normalized.includes("backend") ||
      /\b(api|apis|auth)\b/.test(normalized) ||
      normalized.includes("database") ||
      normalized.includes("postgres") ||
      normalized.includes("golang") ||
      normalized.includes("kotlin") ||
      normalized.includes("endpoint") ||
      normalized.includes("route handler")
    ) {
      return this.get("backend");
    }

    // 6. Architecture & Planning domain
    if (
      normalized.includes("excalidraw") ||
      normalized.includes("diagram") ||
      normalized.includes("brainstorming") ||
      normalized.includes("system design") ||
      normalized.includes("graphify") ||
      normalized.includes("deploy to vercel") ||
      normalized.includes("trade-off")
    ) {
      return this.get("architecture");
    }

    // 7. General Coding domain
    if (
      normalized.includes("code") ||
      normalized.includes("architecture") ||
      normalized.includes("refactor") ||
      normalized.includes("bug") ||
      normalized.includes("inspect repository") ||
      normalized.includes("typescript") ||
      normalized.includes("python")
    ) {
      return this.get("coding");
    }

    // 8. Memory / Knowledge domain
    if (
      normalized.includes("remember") ||
      normalized.includes("memory") ||
      normalized.includes("recall") ||
      normalized.includes("stored facts") ||
      normalized.includes("preferences")
    ) {
      return this.get("memory");
    }

    // 9. Communications domain
    if (
      normalized.includes("email") ||
      normalized.includes("draft") ||
      normalized.includes("gmail") ||
      normalized.includes("correspondence") ||
      normalized.includes("message to")
    ) {
      return this.get("communications");
    }

    // 10. Productivity domain
    if (
      normalized.includes("calendar") ||
      normalized.includes("agenda") ||
      normalized.includes("schedule") ||
      normalized.includes("meeting") ||
      normalized.includes("briefing") ||
      normalized.includes("loose ends")
    ) {
      return this.get("productivity");
    }

    // 11. Research domain
    if (
      normalized.includes("research") ||
      normalized.includes("investigate") ||
      normalized.includes("notes") ||
      normalized.includes("find information") ||
      normalized.includes("search vault")
    ) {
      return this.get("research");
    }

    return undefined;
  }
}

export const specialistRegistry = new SpecialistRegistry();
