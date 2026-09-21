import { describe, expect, it } from "vitest";
import { SpecialistRegistry, specialistRegistry } from "@/lib/specialist/registry";

describe("SpecialistRegistry", () => {
  it("initializes with 5 canonical specialist roles", () => {
    const list = specialistRegistry.list();
    expect(list).toHaveLength(5);
    const ids = list.map((s) => s.id);
    expect(ids).toContain("research");
    expect(ids).toContain("coding");
    expect(ids).toContain("productivity");
    expect(ids).toContain("memory");
    expect(ids).toContain("communications");
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
  });

  it("finds best specialist based on query domain", () => {
    const codeMatch = specialistRegistry.findBestSpecialist("inspect the repository architecture and refactor components");
    expect(codeMatch?.id).toBe("coding");

    const memMatch = specialistRegistry.findBestSpecialist("remember my preferences from stored memory");
    expect(memMatch?.id).toBe("memory");

    const prodMatch = specialistRegistry.findBestSpecialist("check my calendar for tomorrow's meeting agenda");
    expect(prodMatch?.id).toBe("productivity");

    const commMatch = specialistRegistry.findBestSpecialist("draft an email reply in gmail");
    expect(commMatch?.id).toBe("communications");

    const researchMatch = specialistRegistry.findBestSpecialist("investigate notes and search vault for documents");
    expect(researchMatch?.id).toBe("research");
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
