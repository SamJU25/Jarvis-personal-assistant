import { describe, expect, it } from "vitest";
import { z } from "zod";
import { getCurrentTimeTool, searchDemoDataTool, readDemoItemTool } from "@/lib/tools/demo-tools";
import { ToolRegistry } from "@/lib/tools/registry";
import { AgentRuntime } from "@/lib/agent/runtime";
import type { AgentProvider } from "@/lib/contracts/provider";
import type { JarvisTool } from "@/lib/contracts/tool";

describe("Tool Execution & Error Handling", () => {
  it("executes get_current_time and produces valid structured output", async () => {
    const result = await getCurrentTimeTool.execute({ timezone: "UTC" }, { signal: new AbortController().signal, callId: "c1" });
    expect(result).toHaveProperty("iso");
    expect(result).toHaveProperty("date");
    expect(result).toHaveProperty("time");
    expect(result.timezone).toBe("UTC");
  });

  it("executes search_demo_data and finds matching items", async () => {
    const result = await searchDemoDataTool.execute({ query: "philosophy" }, { signal: new AbortController().signal, callId: "c2" });
    expect(result.total).toBeGreaterThan(0);
    expect(result.results[0].title).toContain("Philosophy");
  });

  it("executes read_demo_item and retrieves specific content", async () => {
    const result = await readDemoItemTool.execute({ id: "demo-item-1" }, { signal: new AbortController().signal, callId: "c3" });
    expect(result.id).toBe("demo-item-1");
    expect(result.title).toContain("Operating Philosophy");
    expect(result.tags).toContain("local-first");
  });

  it("read_demo_item throws for non-existent ID", async () => {
    await expect(
      readDemoItemTool.execute({ id: "does_not_exist" }, { signal: new AbortController().signal, callId: "c4" })
    ).rejects.toThrow('not found');
  });

  it("handles tool throwing an internal error gracefully in runtime", async () => {
    const throwingTool: JarvisTool = {
      id: "throw_tool",
      name: "Throw Tool",
      description: "Always throws",
      inputSchema: z.object({}),
      outputSchema: z.object({ ok: z.boolean() }),
      permission: "read",
      renderer: "generic",
      source: "test",
      execute: async () => {
        throw new Error("Internal tool failure");
      },
    };

    const registry = new ToolRegistry();
    registry.register(throwingTool);

    let turn = 0;
    let turn2Prompt = "";
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
                request: { type: "tool_call", callId: "c_throw", toolId: "throw_tool", arguments: {} },
              },
              meta: { provider: "Test", model: "m", durationMs: 5 },
            }),
            cancel: async () => {},
          };
        }
        turn2Prompt = JSON.stringify(req.conversation);
        return {
          events: (async function* () {})(),
          result: Promise.resolve({
            decision: {
              type: "direct",
              result: { speech: "Recovered from failure.", title: "Recovered", state: "complete", cards: [], sources: [] },
            },
            meta: { provider: "Test", model: "m", durationMs: 5 },
          }),
          cancel: async () => {},
        };
      },
    };

    const runtime = new AgentRuntime(provider, registry);
    const frames = [];
    for await (const frame of runtime.run({ message: "Run throw tool", conversation: [] }, new AbortController().signal)) {
      frames.push(frame);
    }

    const failedEvent = frames.find(
      (f) => f.type === "event" && (f as { event: { type: string } }).event.type === "tool_failed"
    );
    expect(failedEvent).toBeDefined();
    expect(turn2Prompt).toContain("failure");
    expect(turn2Prompt).toContain("status");
  });

  it("handles invalid tool output schema gracefully in runtime", async () => {
    const badOutputTool: JarvisTool = {
      id: "bad_output_tool",
      name: "Bad Output Tool",
      description: "Returns wrong schema",
      inputSchema: z.object({}),
      outputSchema: z.object({ requiredField: z.string() }),
      permission: "read",
      renderer: "generic",
      source: "test",
      execute: async () => ({ wrongField: 123 }),
    };

    const registry = new ToolRegistry();
    registry.register(badOutputTool);

    let turn = 0;
    let turn2Prompt = "";
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
                request: { type: "tool_call", callId: "c_bad", toolId: "bad_output_tool", arguments: {} },
              },
              meta: { provider: "Test", model: "m", durationMs: 5 },
            }),
            cancel: async () => {},
          };
        }
        turn2Prompt = JSON.stringify(req.conversation);
        return {
          events: (async function* () {})(),
          result: Promise.resolve({
            decision: {
              type: "direct",
              result: { speech: "Handled bad output.", title: "Recovered", state: "complete", cards: [], sources: [] },
            },
            meta: { provider: "Test", model: "m", durationMs: 5 },
          }),
          cancel: async () => {},
        };
      },
    };

    const runtime = new AgentRuntime(provider, registry);
    const frames = [];
    for await (const frame of runtime.run({ message: "Run bad tool", conversation: [] }, new AbortController().signal)) {
      frames.push(frame);
    }

    const failedEvent = frames.find(
      (f) => f.type === "event" && (f as { event: { type: string } }).event.type === "tool_failed"
    );
    expect(failedEvent).toBeDefined();
    expect(turn2Prompt).toContain("failure");
    expect(turn2Prompt).toContain("status");
  });

  it("respects cancellation during tool execution", async () => {
    const controller = new AbortController();
    const slowTool: JarvisTool = {
      id: "slow_tool",
      name: "Slow Tool",
      description: "Takes time",
      inputSchema: z.object({}),
      outputSchema: z.object({ ok: z.boolean() }),
      permission: "read",
      renderer: "generic",
      source: "test",
      execute: async (_input, context) => {
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => resolve({ ok: true }), 1000);
          context.signal.addEventListener("abort", () => {
            clearTimeout(timer);
            reject(new Error("aborted"));
          });
        });
      },
    };

    const registry = new ToolRegistry();
    registry.register(slowTool);

    const provider: AgentProvider = {
      id: "test",
      name: "Test",
      async runAgent() {
        return {
          events: (async function* () {})(),
          result: Promise.resolve({
            decision: {
              type: "tool_call",
              request: { type: "tool_call", callId: "c_slow", toolId: "slow_tool", arguments: {} },
            },
            meta: { provider: "Test", model: "m", durationMs: 5 },
          }),
          cancel: async () => {},
        };
      },
    };

    const runtime = new AgentRuntime(provider, registry);
    const runPromise = (async () => {
      const frames = [];
      for await (const frame of runtime.run({ message: "Slow", conversation: [] }, controller.signal)) {
        frames.push(frame);
      }
      return frames;
    })();

    // Abort after 20ms
    setTimeout(() => controller.abort(), 20);
    const frames = await runPromise;
    const errorFrame = frames.find((f) => f.type === "error");
    expect(errorFrame).toBeDefined();
    expect(errorFrame).toMatchObject({
      type: "error",
      error: { code: "cancelled" },
    });
  });
});
