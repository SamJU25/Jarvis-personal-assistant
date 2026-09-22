import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { SkillVerificationStrategy } from "@/lib/verification/strategies/skill-verification";
import { applyProposal } from "@/lib/learning/service";

const SKILL_V1 = `---
name: "demo-skill"
description: "A demo skill"
version: "1.0.0"
author: "JARVIS"
category: "productivity"
tags: ["demo"]
---

# Purpose
Original.
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
Improved.
`;

describe("Phase 12: skill verification strategy", () => {
  let vaultDir: string;
  let previousVaultEnv: string | undefined;
  const strategy = new SkillVerificationStrategy();

  beforeEach(async () => {
    vaultDir = await mkdtemp(path.join(tmpdir(), "jarvis-skill-verify-"));
    await mkdir(path.join(vaultDir, "AI", "Skills", "demo-skill"), { recursive: true });
    await writeFile(path.join(vaultDir, "AI", "Skills", "demo-skill", "SKILL.md"), SKILL_V1, "utf-8");
    previousVaultEnv = process.env.OBSIDIAN_VAULT_PATH;
    process.env.OBSIDIAN_VAULT_PATH = vaultDir;
  });

  afterEach(async () => {
    if (previousVaultEnv === undefined) delete process.env.OBSIDIAN_VAULT_PATH;
    else process.env.OBSIDIAN_VAULT_PATH = previousVaultEnv;
    await rm(vaultDir, { recursive: true, force: true });
  });

  async function realOutput() {
    return applyProposal({ skill: "demo-skill", content: SKILL_V2 }, vaultDir);
  }

  it("passes for a genuine, verified skill write and reports path/version/history evidence", async () => {
    const output = await realOutput();
    const result = await strategy.verify({
      runId: "run-1",
      taskId: "task-1",
      toolId: "propose_skill_improvement",
      parameters: { skill: "demo-skill" },
      toolResult: { callId: "c1", toolId: "propose_skill_improvement", status: "success", output },
      timestamp: new Date().toISOString(),
    });

    expect(result.status).toBe("passed");
    const details = result.evidence.map((e) => e.description).join(" ");
    expect(details).toContain("canonical SKILL.md");
    expect(details).toContain("discovery reports the new version");
    expect(details).toContain("archived for rollback");
  });

  it("fails when the model claims success without a real write", async () => {
    const fabricated = {
      skillName: "demo-skill",
      version: "9.9.9",
      previousVersion: null,
      relativePath: "AI/Skills/demo-skill/SKILL.md",
      historyPath: null,
      contentHash: "deadbeef",
      byteSize: 10,
      operation: "update",
    };

    const result = await strategy.verify({
      runId: "run-2",
      taskId: "task-2",
      toolId: "propose_skill_improvement",
      parameters: {},
      toolResult: {
        callId: "c2",
        toolId: "propose_skill_improvement",
        status: "success",
        output: fabricated,
      },
      timestamp: new Date().toISOString(),
    });

    expect(result.status).toBe("failed");
    expect(result.reason).toContain("content hash");
  });

  it("fails when the reported hash does not match the file on disk (tampering)", async () => {
    const output = await realOutput();
    await writeFile(
      path.join(vaultDir, "AI", "Skills", "demo-skill", "SKILL.md"),
      SKILL_V2.replace("Improved.", "Tampered after verification."),
      "utf-8"
    );

    const result = await strategy.verify({
      runId: "run-3",
      taskId: "task-3",
      toolId: "propose_skill_improvement",
      parameters: {},
      toolResult: { callId: "c3", toolId: "propose_skill_improvement", status: "success", output },
      timestamp: new Date().toISOString(),
    });

    expect(result.status).toBe("failed");
    expect(result.reason).toContain("content hash");
  });

  it("fails when the reported path escapes the canonical AI/Skills layout", async () => {
    const result = await strategy.verify({
      runId: "run-4",
      taskId: "task-4",
      toolId: "propose_skill_improvement",
      parameters: {},
      toolResult: {
        callId: "c4",
        toolId: "propose_skill_improvement",
        status: "success",
        output: {
          skillName: "demo-skill",
          version: "1.0.1",
          relativePath: "Inbox/evil/SKILL.md",
          historyPath: null,
          contentHash: "x",
          byteSize: 1,
          operation: "update",
        },
      },
      timestamp: new Date().toISOString(),
    });

    expect(result.status).toBe("failed");
    expect(result.reason).toContain("canonical AI/Skills/ layout");
  });

  it("fails when the previous version was not archived (rollback unavailable)", async () => {
    const output = await realOutput();
    const result = await strategy.verify({
      runId: "run-5",
      taskId: "task-5",
      toolId: "propose_skill_improvement",
      parameters: {},
      toolResult: {
        callId: "c5",
        toolId: "propose_skill_improvement",
        status: "success",
        output: { ...output, historyPath: "AI/Skills/demo-skill/history/9.9.9.md" },
      },
      timestamp: new Date().toISOString(),
    });

    expect(result.status).toBe("failed");
    expect(result.reason).toContain("rollback unavailable");
  });

  it("fails when the tool itself failed", async () => {
    const result = await strategy.verify({
      runId: "run-6",
      taskId: "task-6",
      toolId: "propose_skill_improvement",
      parameters: {},
      toolResult: {
        callId: "c6",
        toolId: "propose_skill_improvement",
        status: "failure",
        error: "write failed",
      },
      timestamp: new Date().toISOString(),
    });

    expect(result.status).toBe("failed");
    expect(result.reason).toBe("write failed");
  });
});
