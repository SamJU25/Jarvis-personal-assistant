import { describe, expect, it } from "vitest";
import { delegationPolicy } from "@/lib/specialist/policy";
import { specialistRegistry } from "@/lib/specialist/registry";

describe("DelegationPolicy", () => {
  it("routes simple conversational queries and greetings directly without delegation", () => {
    const greeting = delegationPolicy.evaluateDelegation("hello");
    expect(greeting.shouldDelegate).toBe(false);
    expect(greeting.reason).toContain("Simple conversational query");
    expect(greeting.targetSpecialists).toHaveLength(0);

    const factQuery = delegationPolicy.evaluateDelegation("what is the capital of france");
    expect(factQuery.shouldDelegate).toBe(false);
    expect(factQuery.reason).toContain("Simple conversational query");
  });

  it("routes single tool requests directly to Hermes core without child agent overhead", () => {
    const timeQuery = delegationPolicy.evaluateDelegation("what time is it");
    expect(timeQuery.shouldDelegate).toBe(false);
    expect(timeQuery.reason).toContain("Small single tool call");

    const noteQuery = delegationPolicy.evaluateDelegation("read note Apollo");
    expect(noteQuery.shouldDelegate).toBe(false);
    expect(noteQuery.reason).toContain("Small single tool call");

    const vaultQuery = delegationPolicy.evaluateDelegation("search vault for roadmap");
    expect(vaultQuery.shouldDelegate).toBe(false);
    expect(vaultQuery.reason).toContain("Small single tool call");
  });

  it("delegates multi-domain requests spanning productivity and research", () => {
    const plan = delegationPolicy.evaluateDelegation(
      "Check my calendar for tomorrow and research notes on Project Apollo in my vault"
    );
    expect(plan.shouldDelegate).toBe(true);
    expect(plan.targetSpecialists).toEqual(["productivity", "research"]);
    expect(plan.tasks).toHaveLength(2);
    expect(plan.tasks[0].specialistId).toBe("productivity");
    expect(plan.tasks[1].specialistId).toBe("research");
  });

  it("delegates parallel research queries across notes and communications", () => {
    const plan = delegationPolicy.evaluateDelegation(
      "parallel research on product feedback"
    );
    expect(plan.shouldDelegate).toBe(true);
    expect(plan.targetSpecialists).toEqual(["research", "communications"]);
    expect(plan.tasks).toHaveLength(2);
  });

  it("delegates codebase inspection and architectural queries to coding specialist", () => {
    const plan = delegationPolicy.evaluateDelegation(
      "inspect repository architecture and component dependencies"
    );
    expect(plan.shouldDelegate).toBe(true);
    expect(plan.targetSpecialists).toEqual(["coding"]);
    expect(plan.tasks).toHaveLength(1);
    expect(plan.tasks[0].specialistId).toBe("coding");
  });

  it("delegates explicit user delegation requests to appropriate specialist", () => {
    const plan = delegationPolicy.evaluateDelegation(
      "spawn a specialist to inspect calendar schedule for this week"
    );
    expect(plan.shouldDelegate).toBe(true);
    expect(plan.targetSpecialists).toEqual(["productivity"]);
    expect(plan.tasks[0].goal).toContain("inspect calendar schedule for this week");
  });

  it("validates child specialist permissions against parent capabilities", () => {
    const research = specialistRegistry.get("research")!;
    expect(research).toBeDefined();

    // Parent has all capabilities research needs
    const allCaps = [...research.allowedCapabilities, "get_current_time"];
    const validCheck = delegationPolicy.validateChildPermissions(research, allCaps);
    expect(validCheck.valid).toBe(true);
    expect(validCheck.disallowedTools).toHaveLength(0);

    // Parent has restricted capabilities (e.g. no Google Drive access)
    const restrictedCaps = ["search_vault", "read_note", "get_current_time"];
    const invalidCheck = delegationPolicy.validateChildPermissions(research, restrictedCaps);
    expect(invalidCheck.valid).toBe(false);
    expect(invalidCheck.disallowedTools).toContain("search_drive");
    expect(invalidCheck.disallowedTools).toContain("read_drive_file");
  });
});
