import { describe, expect, it } from "vitest";
import path from "node:path";
import { loadSkillsFromDirectory } from "@/lib/skills/loader";
import { selectSkill } from "@/lib/skills/selector";
import { MemoryService } from "@/lib/memory/service";
import type { AgentProvider, AgentRun, AgentRequest } from "@/lib/contracts/provider";
import { AgentRuntime } from "@/lib/agent/runtime";
import { ToolRegistry } from "@/lib/tools/registry";
import { registerMemoryTools } from "@/lib/memory/tools";
import { registerObsidianTools } from "@/lib/obsidian/tools";
import { createDefaultSkillRegistry } from "@/lib/skills/registry";

describe("Skills & Memory Integration", () => {
  it("disambiguates note capture from memory requests", async () => {
    const skills = await loadSkillsFromDirectory(path.resolve(process.cwd(), "skills"));

    // "Take a note..." selects capture-note
    const noteSkill = selectSkill("Take a note: deploy frontend by Friday.", skills);
    expect(noteSkill?.id).toBe("capture-note");

    // "Remember this note..." selects capture-note
    const noteSkill2 = selectSkill("Remember this note: client feedback", skills);
    expect(noteSkill2?.id).toBe("capture-note");

    // "Remember that..." is a memory request, NOT capture-note
    const memoryReq1 = selectSkill("Remember that I prefer dark mode.", skills);
    expect(memoryReq1).toBeNull();

    // "Remember my preference..." is a memory request, NOT capture-note
    const memoryReq2 = selectSkill("Remember my preference for concise summaries.", skills);
    expect(memoryReq2).toBeNull();
  });

  it("injects relevant memory into meeting-prep skill execution", async () => {
    const memoryService = new MemoryService({ dbPath: ":memory:" });
    memoryService.storeMemory({
      content: "Yusuf prefers concise agendas and never meets on Friday afternoons.",
      category: "preference",
    });

    const requestsReceived: AgentRequest[] = [];
    const mockProvider: AgentProvider = {
      id: "mock",
      name: "Mock Provider",
      async runAgent(req: AgentRequest): Promise<AgentRun> {
        requestsReceived.push(req);
        return {
          events: (async function* () {})(),
          result: Promise.resolve({
            decision: {
              type: "direct",
              result: {
                speech: "Prepared briefing for your meeting with Yusuf, incorporating your scheduling preferences.",
                title: "Meeting Briefing",
                state: "complete",
                cards: [],
                sources: [],
              },
            },
            meta: { provider: "Mock", model: "test", durationMs: 10 },
          }),
          cancel: async () => {},
        };
      },
    };

    const registry = new ToolRegistry();
    registerObsidianTools(registry);
    registerMemoryTools(registry, memoryService);

    const skillRegistry = await createDefaultSkillRegistry();

    const runtime = new AgentRuntime(mockProvider, registry, skillRegistry, memoryService);
    const frames = [];
    for await (const frame of runtime.run({ message: "Prepare me for my next meeting with Yusuf.", conversation: [] }, new AbortController().signal)) {
      frames.push(frame);
    }
    expect(frames.length).toBeGreaterThan(0);

    expect(requestsReceived.length).toBe(1);
    // Turn 1 instructions include both the skill workflow and the relevant memory context!
    expect(requestsReceived[0].systemInstructions).toContain("Meeting Preparation (meeting-prep)");
    expect(requestsReceived[0].systemInstructions).toContain("MEMORY CONTEXT");
    expect(requestsReceived[0].systemInstructions).toContain("Yusuf prefers concise agendas");

    memoryService.close();
  });
});
