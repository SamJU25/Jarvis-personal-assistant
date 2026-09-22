import { describe, expect, it } from "vitest";
import { SpecialistRegistry, specialistRegistry } from "@/lib/specialist/registry";

describe("SpecialistRegistry", () => {
  it("initializes with 11 canonical specialist roles", () => {
    const list = specialistRegistry.list();
    expect(list).toHaveLength(11);
    const ids = list.map((s) => s.id);
    expect(ids).toContain("research");
    expect(ids).toContain("coding");
    expect(ids).toContain("productivity");
    expect(ids).toContain("memory");
    expect(ids).toContain("communications");
    expect(ids).toContain("frontend");
    expect(ids).toContain("backend");
    expect(ids).toContain("quality");
    expect(ids).toContain("academic");
    expect(ids).toContain("marketing");
    expect(ids).toContain("architecture");
  });

  it("retrieves each canonical specialist with proper attributes", () => {
    const research = specialistRegistry.get("research");
    expect(research).toBeDefined();
    expect(research?.displayName).toBe("Research Specialist");
    expect(research?.preferredRoutingProfile).toBe("reasoning");
    expect(research?.allowedSkills).toContain("research");
    expect(research?.allowedCapabilities).toContain("search_vault");
    expect(research?.userVisible).toBe(true);

    const coding = specialistRegistry.get("coding");
    expect(coding).toBeDefined();
    expect(coding?.preferredRoutingProfile).toBe("coding");

    const productivity = specialistRegistry.get("productivity");
    expect(productivity).toBeDefined();
    expect(productivity?.preferredRoutingProfile).toBe("fast");
    expect(productivity?.allowedSkills).toContain("morning-briefing");

    const memory = specialistRegistry.get("memory");
    expect(memory).toBeDefined();
    expect(memory?.allowedCapabilities).toContain("search_memory");

    const comms = specialistRegistry.get("communications");
    expect(comms).toBeDefined();
    expect(comms?.allowedCapabilities).toContain("search_gmail");

    const frontend = specialistRegistry.get("frontend");
    expect(frontend).toBeDefined();
    expect(frontend?.displayName).toBe("Frontend & UI/UX Specialist");
    expect(frontend?.preferredRoutingProfile).toBe("coding");
    expect(frontend?.allowedSkills).toContain("frontend-design");
    expect(frontend?.allowedSkills).toContain("ui-ux-pro-max");

    const backend = specialistRegistry.get("backend");
    expect(backend).toBeDefined();
    expect(backend?.displayName).toBe("Backend & Systems Specialist");
    expect(backend?.allowedSkills).toContain("backend-patterns");
    expect(backend?.allowedSkills).toContain("api-design-principles");

    const quality = specialistRegistry.get("quality");
    expect(quality).toBeDefined();
    expect(quality?.displayName).toBe("Quality & Testing Specialist");
    expect(quality?.preferredRoutingProfile).toBe("reasoning");
    expect(quality?.allowedSkills).toContain("systematic-debugging");
    expect(quality?.allowedSkills).toContain("tdd-workflow");

    const academic = specialistRegistry.get("academic");
    expect(academic).toBeDefined();
    expect(academic?.displayName).toBe("Academic & Writing Specialist");
    expect(academic?.allowedSkills).toContain("academic-writer");
    expect(academic?.allowedSkills).toContain("citation-specialist");

    const marketing = specialistRegistry.get("marketing");
    expect(marketing).toBeDefined();
    expect(marketing?.displayName).toBe("Marketing & Growth Specialist");
    expect(marketing?.allowedSkills).toContain("growth-hacker");

    const architecture = specialistRegistry.get("architecture");
    expect(architecture).toBeDefined();
    expect(architecture?.displayName).toBe("Architecture & Planning Specialist");
    expect(architecture?.allowedSkills).toContain("excalidraw");
  });

  it("finds best specialist based on query domain", () => {
    const codeMatch = specialistRegistry.findBestSpecialist("inspect the repository code and refactor modules");
    expect(codeMatch?.id).toBe("coding");

    const memMatch = specialistRegistry.findBestSpecialist("remember my preferences from stored memory");
    expect(memMatch?.id).toBe("memory");

    const prodMatch = specialistRegistry.findBestSpecialist("check my calendar for tomorrow's meeting agenda");
    expect(prodMatch?.id).toBe("productivity");

    const commMatch = specialistRegistry.findBestSpecialist("draft an email reply in gmail");
    expect(commMatch?.id).toBe("communications");

    const researchMatch = specialistRegistry.findBestSpecialist("investigate notes and search vault for documents");
    expect(researchMatch?.id).toBe("research");

    const frontendMatch = specialistRegistry.findBestSpecialist("build a modern responsive nextjs landing page with tailwind");
    expect(frontendMatch?.id).toBe("frontend");

    const backendMatch = specialistRegistry.findBestSpecialist("design a rest api endpoint with auth and postgres database");
    expect(backendMatch?.id).toBe("backend");

    const qualityMatch = specialistRegistry.findBestSpecialist("run tdd test suite and performance audit for web vitals");
    expect(qualityMatch?.id).toBe("quality");

    const academicMatch = specialistRegistry.findBestSpecialist("write an academic literature review with ieee citations for my assignment");
    expect(academicMatch?.id).toBe("academic");

    const marketingMatch = specialistRegistry.findBestSpecialist("prepare a product hunt launch strategy and growth copywriting");
    expect(marketingMatch?.id).toBe("marketing");

    const archMatch = specialistRegistry.findBestSpecialist("draw an excalidraw system design diagram for the cloud architecture");
    expect(archMatch?.id).toBe("architecture");
  });

  it("creates bounded task-scoped temporary specialist with parent permission containment", () => {
    const registry = new SpecialistRegistry();
    const parentCapabilities = ["read_note", "search_vault"];

    const temp = registry.createTemporarySpecialist({
      id: "temp-arch-reviewer",
      displayName: "Architecture Reviewer",
      role: "Review system architecture",
      allowedCapabilities: ["read_note", "terminal", "execute_code"], // asks for forbidden tools
      parentAllowedCapabilities: parentCapabilities,
      maxExecutionTimeMs: 120000, // requests 120s
    });

    expect(temp.id).toBe("temp-arch-reviewer");
    expect(temp.isTemporary).toBe(true);
    // Disallowed tools filtered out
    expect(temp.allowedCapabilities).toEqual(["read_note"]);
    // Timeout clamped to 60s max
    expect(temp.maxExecutionTimeMs).toBe(60000);

    expect(registry.has("temp-arch-reviewer")).toBe(true);
    expect(registry.get("temp-arch-reviewer")).toBeDefined();

    // Release temporary specialist
    const released = registry.releaseTemporarySpecialist("temp-arch-reviewer");
    expect(released).toBe(true);
    expect(registry.has("temp-arch-reviewer")).toBe(false);
  });
});
