import { describe, expect, it, vi, afterEach } from "vitest";
import { AgentRuntime } from "@/lib/agent/runtime";
import { ToolRegistry } from "@/lib/tools/registry";
import { registerGoogleTools } from "@/lib/google/tools";
import { registerObsidianTools } from "@/lib/obsidian/tools";
import { getCurrentTimeTool } from "@/lib/tools/demo-tools";
import { SkillRegistry } from "@/lib/skills/registry";
import { loadSkillsFromDirectory } from "@/lib/skills/loader";
import type {
  AgentDecision,
  AgentProvider,
  AgentRequest,
  AgentRun,
} from "@/lib/contracts/provider";
import * as clientModule from "@/lib/google/client";
import path from "node:path";

class MockProvider implements AgentProvider {
  readonly id = "mock-provider";
  readonly name = "Mock Provider";
  public turn = 0;

  constructor(
    private readonly handler: (turn: number, input: AgentRequest) => {
      decision: AgentDecision;
      meta?: { provider: string; model: string; durationMs: number };
    }
  ) {}

  async runAgent(input: AgentRequest): Promise<AgentRun> {
    this.turn++;
    const currentTurn = this.turn;
    const output = this.handler(currentTurn, input);

    return {
      events: (async function* () {
        yield {
          id: "evt-step",
          type: "agent_started" as const,
          timestamp: new Date().toISOString(),
          label: "Agent processing turn " + currentTurn,
        };
      })(),
      result: Promise.resolve({
        decision: output.decision,
        result: output.decision.type === "direct" ? output.decision.result : undefined,
        meta: output.meta ?? { provider: this.name, model: "test-model", durationMs: 10 },
      }),
      cancel: async () => {},
    };
  }
}

async function setupRuntime(provider: AgentProvider) {
  const registry = new ToolRegistry();
  registry.register(getCurrentTimeTool);
  registerObsidianTools(registry);
  registerGoogleTools(registry);

  const skillsDir = path.resolve(process.cwd(), "skills");
  const skills = await loadSkillsFromDirectory(skillsDir);
  const skillRegistry = new SkillRegistry();
  for (const skill of skills) {
    skillRegistry.register(skill);
  }

  return new AgentRuntime(provider, registry, skillRegistry);
}

describe("Phase 6 Skills with Google Workspace Integration", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("meeting-prep skill queries calendar and synthesizes preparation context", async () => {
    const calendarEvents = {
      items: [
        {
          id: "evt-arch-1",
          summary: "Architecture Sync with Yusuf",
          start: { dateTime: "2026-09-20T14:00:00Z" },
          end: { dateTime: "2026-09-20T14:30:00Z" },
          attendees: [{ displayName: "Yusuf", email: "yusuf@example.com" }],
          location: "Google Meet",
        },
      ],
    };

    vi.spyOn(clientModule, "executeGws").mockResolvedValue(JSON.stringify(calendarEvents));

    const provider = new MockProvider((turn) => {
      if (turn === 1) {
        return {
          decision: {
            type: "tool_call",
            request: {
              type: "tool_call",
              callId: "call-cal",
              toolId: "get_calendar_events",
              arguments: {
                start: "2026-09-20T00:00:00Z",
                end: "2026-09-20T23:59:59Z",
              },
            },
          },
          meta: { provider: "Command Code", model: "default", durationMs: 25 },
        };
      }
      return {
        decision: {
          type: "direct",
          result: {
            speech: "You have an Architecture Sync with Yusuf at 2:00 PM.",
            title: "Meeting Preparation",
            state: "complete",
            cards: [
              {
                id: "meeting-card-1",
                type: "meeting",
                label: "Upcoming Meeting",
                title: "Architecture Sync with Yusuf",
                time: "2:00 PM · 30m",
                attendees: ["Yusuf"],
                focus: ["Architecture Sync"],
              },
            ],
            sources: [
              {
                id: "src-1",
                title: "Architecture Sync with Yusuf",
                kind: "calendar",
                location: "Google Calendar",
              },
            ],
          },
        },
        meta: { provider: "Command Code", model: "default", durationMs: 30 },
      };
    });

    const runtime = await setupRuntime(provider);
    const frames = [];
    const controller = new AbortController();

    for await (const frame of runtime.run(
      { message: "Prepare me for my next meeting", conversation: [] },
      controller.signal
    )) {
      frames.push(frame);
    }

    const skillSelected = frames.find(
      (f) => f.type === "event" && f.event.type === "skill_selected" && f.event.label.includes("Meeting Preparation")
    );
    expect(skillSelected).toBeDefined();

    const toolCompleted = frames.find(
      (f) => f.type === "event" && f.event.type === "tool_completed" && f.event.label.includes("Get Calendar Events")
    );
    expect(toolCompleted).toBeDefined();

    const resultFrame = frames.find((f) => f.type === "result");
    expect(resultFrame).toBeDefined();
    const cards = (resultFrame as { type: "result"; result: { cards: Array<{ type: string }> } })
      .result.cards;
    expect(cards[0].type).toBe("meeting");
  });

  it("morning-briefing skill queries schedule and recent emails", async () => {
    const gmailResponse = {
      messages: [
        {
          id: "m-1",
          snippet: "PR #42 is ready for review",
          internalDate: "1726819200000",
          payload: {
            headers: [
              { name: "From", value: "Dev Lead <lead@example.com>" },
              { name: "Subject", value: "PR #42 Ready" },
            ],
          },
        },
      ],
    };

    vi.spyOn(clientModule, "executeGws").mockResolvedValue(JSON.stringify(gmailResponse));

    const provider = new MockProvider((turn) => {
      if (turn === 1) {
        return {
          decision: {
            type: "tool_call",
            request: {
              type: "tool_call",
              callId: "call-gmail",
              toolId: "search_gmail",
              arguments: { query: "is:unread", limit: 5 },
            },
          },
          meta: { provider: "Command Code", model: "default", durationMs: 15 },
        };
      }
      return {
        decision: {
          type: "direct",
          result: {
            speech: "Good morning. You have 1 unread message from Dev Lead regarding PR #42.",
            title: "Morning Briefing",
            state: "complete",
            cards: [
              {
                id: "email-card-1",
                type: "email",
                label: "Unread message",
                sender: "Dev Lead",
                subject: "PR #42 Ready",
                preview: "PR #42 is ready for review",
                receivedAt: "Today",
              },
            ],
            sources: [
              {
                id: "src-email",
                title: "PR #42 Ready",
                kind: "email",
                location: "Gmail",
              },
            ],
          },
        },
        meta: { provider: "Command Code", model: "default", durationMs: 20 },
      };
    });

    const runtime = await setupRuntime(provider);
    const frames = [];
    const controller = new AbortController();

    for await (const frame of runtime.run(
      { message: "Give me my morning briefing", conversation: [] },
      controller.signal
    )) {
      frames.push(frame);
    }

    const skillSelected = frames.find(
      (f) => f.type === "event" && f.event.type === "skill_selected" && f.event.label.includes("Morning Briefing")
    );
    expect(skillSelected).toBeDefined();

    const toolCompleted = frames.find(
      (f) => f.type === "event" && f.event.type === "tool_completed" && f.event.label.includes("Search Gmail")
    );
    expect(toolCompleted).toBeDefined();
  });

  it("research skill searches Drive and quotes document context", async () => {
    const driveSearchResponse = {
      files: [
        {
          id: "drive-doc-deepseek",
          name: "DeepSeek Analysis",
          mimeType: "application/vnd.google-apps.document",
          modifiedTime: "2026-09-19T10:00:00Z",
          owners: [{ displayName: "Sam" }],
        },
      ],
    };

    vi.spyOn(clientModule, "executeGws").mockResolvedValue(JSON.stringify(driveSearchResponse));

    const provider = new MockProvider((turn) => {
      if (turn === 1) {
        return {
          decision: {
            type: "tool_call",
            request: {
              type: "tool_call",
              callId: "call-drive",
              toolId: "search_drive",
              arguments: { query: "DeepSeek", limit: 5 },
            },
          },
          meta: { provider: "Command Code", model: "default", durationMs: 15 },
        };
      }
      return {
        decision: {
          type: "direct",
          result: {
            speech: "Found your Google Doc on DeepSeek Analysis.",
            title: "Research: DeepSeek",
            state: "complete",
            cards: [
              {
                id: "doc-1",
                type: "document",
                label: "Google Doc",
                title: "DeepSeek Analysis",
                format: "Google Doc",
                summary: "Analysis of DeepSeek architectural efficiencies.",
                modifiedAt: "Yesterday",
              },
            ],
            sources: [
              {
                id: "src-drive",
                title: "DeepSeek Analysis",
                kind: "document",
                location: "Google Drive",
              },
            ],
          },
        },
        meta: { provider: "Command Code", model: "default", durationMs: 20 },
      };
    });

    const runtime = await setupRuntime(provider);
    const frames = [];
    const controller = new AbortController();

    for await (const frame of runtime.run(
      { message: "Find the document I wrote about DeepSeek", conversation: [] },
      controller.signal
    )) {
      frames.push(frame);
    }

    const skillSelected = frames.find(
      (f) => f.type === "event" && f.event.type === "skill_selected" && f.event.label.includes("Personal Knowledge Research")
    );
    expect(skillSelected).toBeDefined();

    const toolCompleted = frames.find(
      (f) => f.type === "event" && f.event.type === "tool_completed" && f.event.label.includes("Search Google Drive")
    );
    expect(toolCompleted).toBeDefined();
  });

  it("loose-ends skill queries email and calendar for open commitments", async () => {
    const calendarEvents = {
      items: [
        {
          id: "evt-followup",
          summary: "Follow up with client",
          start: { dateTime: "2026-09-20T16:00:00Z" },
          end: { dateTime: "2026-09-20T16:30:00Z" },
        },
      ],
    };

    vi.spyOn(clientModule, "executeGws").mockResolvedValue(JSON.stringify(calendarEvents));

    const provider = new MockProvider((turn) => {
      if (turn === 1) {
        return {
          decision: {
            type: "tool_call",
            request: {
              type: "tool_call",
              callId: "call-ends",
              toolId: "get_calendar_events",
              arguments: {
                start: "2026-09-20T00:00:00Z",
                end: "2026-09-20T23:59:59Z",
                query: "follow up",
              },
            },
          },
          meta: { provider: "Command Code", model: "default", durationMs: 15 },
        };
      }
      return {
        decision: {
          type: "direct",
          result: {
            speech: "Possible loose end: You have a scheduled follow-up with client at 4:00 PM.",
            title: "Loose Ends",
            state: "complete",
            cards: [
              {
                id: "action-1",
                type: "action",
                label: "Possible Follow-up",
                title: "Follow up with client",
                detail: "Scheduled for 4:00 PM today.",
                status: "proposed",
              },
            ],
            sources: [
              {
                id: "src-cal",
                title: "Follow up with client",
                kind: "calendar",
                location: "Google Calendar",
              },
            ],
          },
        },
        meta: { provider: "Command Code", model: "default", durationMs: 20 },
      };
    });

    const runtime = await setupRuntime(provider);
    const frames = [];
    const controller = new AbortController();

    for await (const frame of runtime.run(
      { message: "What are my loose ends?", conversation: [] },
      controller.signal
    )) {
      frames.push(frame);
    }

    const skillSelected = frames.find(
      (f) => f.type === "event" && f.event.type === "skill_selected" && f.event.label.includes("Loose Ends")
    );
    expect(skillSelected).toBeDefined();
  });
});
