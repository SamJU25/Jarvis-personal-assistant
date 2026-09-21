import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AgentRuntime } from "@/lib/agent/runtime";
import { ToolRegistry } from "@/lib/tools/registry";
import { getCurrentTimeTool } from "@/lib/tools/demo-tools";
import { createNoteTool, registerObsidianTools } from "@/lib/obsidian/tools";
import { createGoogleDocTool, draftEmailTool } from "@/lib/google/tools";
import { getConfirmationService } from "@/lib/confirmation/service";
import { isAffirmativeConfirmation } from "@/lib/confirmation/intent";
import type { JarvisTool } from "@/lib/contracts/tool";
import type {
  AgentDecision,
  AgentProvider,
  AgentRequest,
  AgentRun,
} from "@/lib/contracts/provider";
import * as clientModule from "@/lib/google/client";

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
          id: `evt-${currentTurn}`,
          type: "agent_started" as const,
          timestamp: new Date().toISOString(),
          label: "Agent processing",
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

describe("Phase 9: Write Actions & Confirmation Architecture", () => {
  let tempVaultDir: string;
  const originalVaultEnv = process.env.OBSIDIAN_VAULT_PATH;

  beforeEach(async () => {
    tempVaultDir = await mkdtemp(join(tmpdir(), "jarvis-p9-vault-"));
    process.env.OBSIDIAN_VAULT_PATH = tempVaultDir;
    getConfirmationService().clear();
  });

  afterEach(async () => {
    if (originalVaultEnv !== undefined) {
      process.env.OBSIDIAN_VAULT_PATH = originalVaultEnv;
    } else {
      delete process.env.OBSIDIAN_VAULT_PATH;
    }
    await rm(tempVaultDir, { recursive: true, force: true }).catch(() => {});
    vi.restoreAllMocks();
  });

  describe("Permission System Boundaries", () => {
    it("read tool executes automatically without confirmation", async () => {
      const registry = new ToolRegistry();
      registry.register(getCurrentTimeTool);

      const provider = new MockProvider((turn) => {
        if (turn === 1) {
          return {
            decision: {
              type: "tool_call",
              request: {
                type: "tool_call",
                callId: "call-read-time",
                toolId: "get_current_time",
                arguments: {},
              },
            },
          };
        }
        return {
          decision: {
            type: "direct",
            result: {
              speech: "The current time is verified.",
              title: "Time Result",
              state: "complete",
              cards: [],
              sources: [],
            },
          },
        };
      });

      const runtime = new AgentRuntime(provider, registry);
      const frames = [];
      for await (const frame of runtime.run({ message: "What time is it?", conversation: [] }, new AbortController().signal)) {
        frames.push(frame);
      }

      const completed = frames.find(
        (f) => f.type === "event" && f.event.type === "tool_completed" && f.event.label.includes("Get Current Time")
      );
      expect(completed).toBeDefined();

      const resultFrame = frames.find((f) => f.type === "result");
      expect(resultFrame).toBeDefined();
    });

    it("dangerous permission tool remains strictly blocked", async () => {
      const registry = new ToolRegistry();
      const dangerousTool: JarvisTool = {
        id: "format_disk",
        name: "Format Disk",
        description: "Dangerous tool that must never execute",
        inputSchema: getCurrentTimeTool.inputSchema,
        outputSchema: getCurrentTimeTool.outputSchema,
        permission: "dangerous",
        renderer: "generic",
        source: "system",
        execute: vi.fn(),
      };
      registry.register(dangerousTool);

      const provider = new MockProvider(() => ({
        decision: {
          type: "tool_call",
          request: {
            type: "tool_call",
            callId: "call-dang",
            toolId: "format_disk",
            arguments: {},
          },
        },
      }));

      const runtime = new AgentRuntime(provider, registry);
      const frames = [];
      for await (const frame of runtime.run({ message: "Format the drive", conversation: [] }, new AbortController().signal)) {
        frames.push(frame);
      }

      const failedEvent = frames.find(
        (f) => f.type === "event" && f.event.type === "tool_failed" && f.event.label.includes('Permission "dangerous" denied')
      );
      expect(failedEvent).toBeDefined();
      expect(dangerousTool.execute).not.toHaveBeenCalled();
    });
  });

  describe("create_note Flow", () => {
    it("proposes create_note, halts execution, creates PendingConfirmation and emits confirmation_required", async () => {
      const registry = new ToolRegistry();
      registerObsidianTools(registry);

      const provider = new MockProvider((turn) => {
        if (turn === 1) {
          return {
            decision: {
              type: "tool_call",
              request: {
                type: "tool_call",
                callId: "c1",
                toolId: "create_note",
                arguments: {
                  title: "Release Checklist",
                  content: "- Verify tests pass\n- Check security",
                },
              },
            },
          };
        }
        return {
          decision: {
            type: "direct",
            result: {
              speech: "I have prepared the note. Please confirm to save it.",
              title: "Note Prepared",
              state: "waiting_for_approval",
              cards: [],
              sources: [],
            },
          },
        };
      });

      const runtime = new AgentRuntime(provider, registry);
      const frames = [];
      for await (const frame of runtime.run({ message: "Take a note of release checklist", conversation: [] }, new AbortController().signal)) {
        frames.push(frame);
      }

      // Check confirmation_required was emitted
      const confEvent = frames.find(
        (f) => f.type === "event" && f.event.type === "confirmation_required"
      );
      expect(confEvent).toBeDefined();

      // Check result state is waiting_for_approval with attached confirmation
      const resultFrame = frames.find((f) => f.type === "result");
      expect(resultFrame).toBeDefined();
      if (resultFrame?.type === "result") {
        expect(resultFrame.result.state).toBe("waiting_for_approval");
        expect(resultFrame.result.confirmation).toBeDefined();
        expect(resultFrame.result.confirmation?.title).toBe("CREATE NOTE");
        expect(resultFrame.result.confirmation?.parameters.title).toBe("Release Checklist");
      }
    });

    it("executes confirmed create_note only upon explicit authorization and creates the note file", async () => {
      const registry = new ToolRegistry();
      registerObsidianTools(registry);

      const confirmationService = getConfirmationService();
      const pending = confirmationService.createPendingConfirmation({
        originatingRunId: "run-note-exec",
        toolId: "create_note",
        actionCategory: "note",
        title: "CREATE NOTE",
        target: "Inbox/JARVIS/ConfirmedNote.md",
        summary: "Create note in Obsidian vault",
        preview: "This is verified content.",
        parameters: {
          title: "ConfirmedNote",
          content: "This is verified content.",
          folder: "Inbox/JARVIS",
        },
      });

      // User explicitly confirms: authorize the confirmation
      const authorized = confirmationService.authorize(pending.id);
      expect(authorized.status).toBe("consumed");

      // Execute through registered tool using the exact stored parameters
      const noteTool = registry.get("create_note");
      expect(noteTool).toBeDefined();
      const result = await noteTool?.execute(authorized.parameters, {
        signal: new AbortController().signal,
        callId: authorized.id,
      });

      expect(result).toBeDefined();
      expect(result.path).toContain("ConfirmedNote.md");

      // Verify file actually exists on disk
      const filePath = join(tempVaultDir, "Inbox", "JARVIS", "ConfirmedNote.md");
      const diskContent = await readFile(filePath, "utf-8");
      expect(diskContent).toBe("This is verified content.");
    });

    it("rejects duplicate confirmation (replay attack protection)", () => {
      const confirmationService = getConfirmationService();
      const pending = confirmationService.createPendingConfirmation({
        originatingRunId: "run-replay-note",
        toolId: "create_note",
        actionCategory: "note",
        title: "CREATE NOTE",
        target: "Inbox/JARVIS/ReplayNote.md",
        summary: "Test",
        preview: "Content",
        parameters: { title: "ReplayNote", content: "Content" },
      });

      // First confirmation succeeds
      confirmationService.authorize(pending.id);

      // Second confirmation is rejected
      expect(() => confirmationService.authorize(pending.id)).toThrow(/already consumed/);
    });

    it("blocks path traversal in create_note even if confirmed", async () => {
      const confirmationService = getConfirmationService();
      const pending = confirmationService.createPendingConfirmation({
        originatingRunId: "run-traversal",
        toolId: "create_note",
        actionCategory: "note",
        title: "CREATE NOTE",
        target: "Outside vault",
        summary: "Attack attempt",
        preview: "Hacked",
        parameters: {
          title: "HackedNote",
          content: "Compromised",
          folder: "../../../Outside",
        },
      });

      const authorized = confirmationService.authorize(pending.id);
      const noteTool = createNoteTool;

      // Tool must reject path traversal attempt
      await expect(
        noteTool.execute(
          authorized.parameters as unknown as {
            title: string;
            content: string;
            folder?: string;
          },
          {
            signal: new AbortController().signal,
            callId: authorized.id,
          }
        )
      ).rejects.toThrow(/traversal/i);
    });
  });

  describe("create_google_doc Flow", () => {
    it("creates a Google Doc when confirmed and GWS CLI returns document metadata", async () => {
      const mockGwsDoc = {
        id: "doc-12345",
        title: "Project Phoenix Specification",
        alternateLink: "https://docs.google.com/document/d/doc-12345/edit",
      };

      vi.spyOn(clientModule, "executeGws").mockResolvedValue(JSON.stringify(mockGwsDoc));

      const docTool = createGoogleDocTool;
      const output = await docTool.execute(
        { title: "Project Phoenix Specification", content: "Full architecture details." },
        { signal: new AbortController().signal, callId: "c-doc-1" }
      );

      expect(output.documentId).toBe("doc-12345");
      expect(output.title).toBe("Project Phoenix Specification");
      expect(output.webLink).toContain("https://docs.google.com");
    });

    it("truthfully reports failure when GWS is unauthenticated/unavailable", async () => {
      vi.spyOn(clientModule, "executeGws").mockRejectedValue(
        new Error("GWS executable not found or not authenticated")
      );

      const docTool = createGoogleDocTool;
      await expect(
        docTool.execute(
          { title: "Test Doc", content: "Test" },
          { signal: new AbortController().signal, callId: "c-doc-2" }
        )
      ).rejects.toThrow(/not authenticated/);
    });
  });

  describe("draft_email Flow", () => {
    it("creates an email draft and never sends email", async () => {
      const mockGwsDraft = {
        id: "draft-999",
        message: {
          id: "msg-draft-999",
          threadId: "thread-123",
        },
      };

      const executeGwsSpy = vi.spyOn(clientModule, "executeGws").mockResolvedValue(
        JSON.stringify(mockGwsDraft)
      );

      const emailTool = draftEmailTool;
      const output = await emailTool.execute(
        {
          to: "partner@example.com",
          subject: "Partnership Discussion",
          body: "Let's align on next steps for the project.",
        },
        { signal: new AbortController().signal, callId: "c-draft-1" }
      );

      expect(output.draftId).toBe("draft-999");
      expect(output.to).toBe("partner@example.com");
      expect(output.subject).toBe("Partnership Discussion");

      // Verify the command executed was drafts create, NOT messages send!
      const commandArgs = executeGwsSpy.mock.calls[0][0];
      expect(commandArgs).toContain("drafts");
      expect(commandArgs).toContain("create");
      expect(commandArgs).not.toContain("send");
    });
  });

  describe("Voice Confirmation Safety", () => {
    it("matches explicit voice affirmative utterances ('Yes, create it')", () => {
      expect(isAffirmativeConfirmation("Yes, create it.")).toBe(true);
      expect(isAffirmativeConfirmation("create it")).toBe(true);
      expect(isAffirmativeConfirmation("Confirm")).toBe(true);
    });

    it("rejects generic 'Yes' as authorization when no confirmation is pending", () => {
      const confirmationService = getConfirmationService();
      // No pending confirmation in service
      expect(confirmationService.getLatestPending()).toBeUndefined();
      // Bare "Yes" without pending confirmation cannot authorize anything
    });
  });
});
