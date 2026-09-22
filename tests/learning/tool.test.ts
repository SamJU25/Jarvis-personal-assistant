import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, rm, mkdir, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createDefaultToolRegistry } from "@/lib/tools/demo-tools";
import { buildConfirmationDetails } from "@/lib/confirmation/service";
import { getVerificationRegistry } from "@/lib/verification/registry";
import { proposeSkillImprovementTool } from "@/lib/learning/tools";

const SKILL_V1 = `---
name: "demo-skill"
description: "A demo skill"
version: "1.0.0"
author: "JARVIS"
category: "productivity"
tags: ["demo"]
---

# Purpose
Do the demo thing.
`;

const SKILL_V2 = `---
name: "demo-skill"
description: "A demo skill"
version: "1.0.0"
author: "JARVIS"
category: "productivity"
tags: ["demo"]
---

# Purpose
Do the demo thing, improved.
`;

describe("Phase 12: controlled learning capability boundary", () => {
  let vaultDir: string;
  let previousVaultEnv: string | undefined;

  beforeEach(async () => {
    vaultDir = await mkdtemp(path.join(tmpdir(), "jarvis-learning-tool-test-"));
    await mkdir(path.join(vaultDir, "AI", "Skills", "demo-skill"), { recursive: true });
    await writeFile(path.join(vaultDir, "AI", "Skills", "demo-skill", "SKILL.md"), SKILL_V1, "utf-8");
    previousVaultEnv = process.env.OBSIDIAN_VAULT_PATH;
    process.env.OBSIDIAN_VAULT_PATH = vaultDir;
  });

  afterEach(async () => {
    if (previousVaultEnv === undefined) delete process.env.OBSIDIAN_VAULT_PATH;
    else process.env.OBSIDIAN_VAULT_PATH = previousVaultEnv;
    vi.restoreAllMocks();
    await rm(vaultDir, { recursive: true, force: true });
  });

  it("registers the capability as write-class requiring explicit confirmation", () => {
    const registry = createDefaultToolRegistry();
    const tool = registry.getCapability("propose_skill_improvement");

    expect(tool).toBeDefined();
    expect(tool?.permission).toBe("write");
    expect(tool?.confirmationPolicy).toBe("explicit");
    expect(tool?.verificationStrategy).toBe("skill_verification");
    expect(tool?.reversible).toBe(true);
    expect(tool?.idempotent).toBe(false);
    expect(registry.isConfirmationRequired("propose_skill_improvement")).toBe(true);
  });

  it("binds the skill verification strategy to the capability", () => {
    const strategy = getVerificationRegistry().get("skill_verification");
    expect(strategy.name).toBe("SkillVerificationStrategy");
    // Tool-id alias also resolves
    expect(getVerificationRegistry().get("propose_skill_improvement").name).toBe(
      "SkillVerificationStrategy"
    );
  });

  it("renders a diff preview in the confirmation details (provenance visible to the human)", async () => {
    const details = buildConfirmationDetails("propose_skill_improvement", {
      skill: "demo-skill",
      rationale: "Observed the improved workflow succeed.",
      content: SKILL_V2,
    });

    expect(details.title).toBe("UPDATE SKILL");
    expect(details.target).toContain("AI/Skills/demo-skill/SKILL.md");
    expect(details.summary).toContain("Observed the improved workflow");
    expect(details.preview).toContain("- Do the demo thing.");
    expect(details.preview).toContain("+ Do the demo thing, improved.");
  });

  it("the tool writes only when executed through the application path", async () => {
    // Merely defining the proposal (what the model can cause) must not write.
    const details = buildConfirmationDetails("propose_skill_improvement", {
      skill: "demo-skill",
      rationale: "why",
      content: SKILL_V2,
    });
    expect(details).toBeDefined();
    expect(await readFile(path.join(vaultDir, "AI", "Skills", "demo-skill", "SKILL.md"), "utf-8")).toBe(SKILL_V1);

    // Application-owned execution (post-confirmation) performs the verified write.
    const result = await proposeSkillImprovementTool.execute(
      { skill: "demo-skill", rationale: "why", content: SKILL_V2 },
      { signal: new AbortController().signal, callId: "call-1" }
    );

    expect(result.version).toBe("1.0.1");
    expect(result.historyPath).toBeTruthy();
    const onDisk = await readFile(path.join(vaultDir, "AI", "Skills", "demo-skill", "SKILL.md"), "utf-8");
    expect(onDisk).toContain("improved");
  });

  it("refuses to execute for a skill that does not exist in the vault", async () => {
    await expect(
      proposeSkillImprovementTool.execute(
        { skill: "ghost-skill", rationale: "why", content: SKILL_V2 },
        { signal: new AbortController().signal, callId: "call-2" }
      )
    ).rejects.toThrow(/was not found in the vault/);
  });

  it("honours cancellation before writing", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      proposeSkillImprovementTool.execute(
        { skill: "demo-skill", rationale: "why", content: SKILL_V2 },
        { signal: controller.signal, callId: "call-3" }
      )
    ).rejects.toThrow(/cancelled/i);
  });
});
