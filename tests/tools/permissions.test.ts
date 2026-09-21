import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { AgentRuntime } from "@/lib/agent/runtime";
import { ToolRegistry } from "@/lib/tools/registry";
import type { AgentProvider } from "@/lib/contracts/provider";
import type { JarvisTool } from "@/lib/contracts/tool";

function mockTool(id: string, permission: "read" | "write" | "dangerous", executeFn = vi.fn(async () => ({ ok: true }))): JarvisTool {
  return {
    id,
    name: `Tool ${id}`,
    description: `Test tool ${id}`,
    inputSchema: z.object({ value: z.string().optional() }),
    outputSchema: z.object({ ok: z.boolean() }),
    permission,
    renderer: "generic",
    source: "test",
    execute: executeFn,
  };
}

describe("Tool Permissions Enforcement (Phase 3)", () => {
  it("allows execution of tools with READ permission", async () => {
    const executeSpy = vi.fn(async () => ({ ok: true }));
    const readTool = mockTool("safe_read_tool", "read", executeSpy);

    const registry = new ToolRegistry();
    registry.register(readTool);

    let turn = 0;
    const provider: AgentProvider = {
      id: "test",
      name: "Test",
      async runAgent() {
        turn++;
        if (turn === 1) {
          return {
            events: (async function* () {})(),
            result: Promise.resolve({
              decision: {
                type: "tool_call",
                request: { type: "tool_call", callId: "c1", toolId: "safe_read_tool", arguments: { value: "test" } },
              },
              meta: { provider: "Test", model: "m", durationMs: 5 },
            }),
            cancel: async () => {},
          };
        }
        return {
          events: (async function* () {})(),
          result: Promise.resolve({
            decision: {
              type: "direct",
              result: { speech: "Executed successfully.", title: "Done", state: "complete", cards: [], sources: [] },
            },
            result: { speech: "Executed successfully.", title: "Done", state: "complete", cards: [], sources: [] },
            meta: { provider: "Test", model: "m", durationMs: 5 },
          }),
          cancel: async () => {},
        };
      },
    };

    const runtime = new AgentRuntime(provider, registry);
    const frames = [];
    for await (const frame of runtime.run({ message: "Run read tool", conversation: [] }, new AbortController().signal)) {
      frames.push(frame);
    }

    expect(executeSpy).toHaveBeenCalledOnce();
    const eventTypes = frames.filter((f) => f.type === "event").map((f) => (f as { event: { type: string } }).event.type);
    expect(eventTypes).toContain("tool_requested");
    expect(eventTypes).toContain("tool_started");
    expect(eventTypes).toContain("tool_completed");
  });

  it("rejects execution of WRITE tools in Phase 3 without calling execute", async () => {
    const executeSpy = vi.fn(async () => ({ ok: true }));
    const writeTool = mockTool("write_tool", "write", executeSpy);

    const registry = new ToolRegistry();
    registry.register(writeTool);

    let turn = 0;
    let turn2PromptReceived = "";
    const provider: AgentProvider = {
      id: "test",
      name: "Test",
      async runAgent(req) {
        turn++;
        if (turn === 1) {
          return {
            events: (async function* () {})(),
            result: Promise.resolve({
              decision: {
                type: "tool_call",
                request: { type: "tool_call", callId: "c2", toolId: "write_tool", arguments: {} },
              },
              meta: { provider: "Test", model: "m", durationMs: 5 },
            }),
            cancel: async () => {},
          };
        }
        turn2PromptReceived = JSON.stringify(req.conversation);
        return {
          events: (async function* () {})(),
          result: Promise.resolve({
            decision: {
              type: "direct",
              result: { speech: "Permission denied for write.", title: "Denied", state: "complete", cards: [], sources: [] },
            },
            meta: { provider: "Test", model: "m", durationMs: 5 },
          }),
          cancel: async () => {},
        };
      },
    };

    const runtime = new AgentRuntime(provider, registry);
    const frames = [];
    for await (const frame of runtime.run({ message: "Write something", conversation: [] }, new AbortController().signal)) {
      frames.push(frame);
    }

    expect(executeSpy).not.toHaveBeenCalled();
    const failedEvent = frames.find(
      (f) => f.type === "event" && (f as { event: { type: string } }).event.type === "tool_failed"
    );
    expect(failedEvent).toBeDefined();
    expect(turn2PromptReceived.toLowerCase()).toContain("permission");
    expect(turn2PromptReceived).toContain("write");
  });

  it("rejects execution of DANGEROUS tools in Phase 3 without calling execute", async () => {
    const executeSpy = vi.fn(async () => ({ ok: true }));
    const dangerousTool = mockTool("dangerous_tool", "dangerous", executeSpy);

    const registry = new ToolRegistry();
    registry.register(dangerousTool);

    let turn = 0;
    const provider: AgentProvider = {
      id: "test",
      name: "Test",
      async runAgent() {
        turn++;
        if (turn === 1) {
          return {
            events: (async function* () {})(),
            result: Promise.resolve({
              decision: {
                type: "tool_call",
                request: { type: "tool_call", callId: "c3", toolId: "dangerous_tool", arguments: {} },
              },
              meta: { provider: "Test", model: "m", durationMs: 5 },
            }),
            cancel: async () => {},
          };
        }
        return {
          events: (async function* () {})(),
          result: Promise.resolve({
            decision: {
              type: "direct",
              result: { speech: "Dangerous tool blocked.", title: "Blocked", state: "complete", cards: [], sources: [] },
            },
            meta: { provider: "Test", model: "m", durationMs: 5 },
          }),
          cancel: async () => {},
        };
      },
    };

    const runtime = new AgentRuntime(provider, registry);
    const frames = [];
    for await (const frame of runtime.run({ message: "Run dangerous action", conversation: [] }, new AbortController().signal)) {
      frames.push(frame);
    }

    expect(executeSpy).not.toHaveBeenCalled();
    const failedEvent = frames.find(
      (f) => f.type === "event" && (f as { event: { type: string } }).event.type === "tool_failed"
    );
    expect(failedEvent).toBeDefined();
  });
});
