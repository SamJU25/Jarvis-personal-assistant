import { describe, expect, it } from "vitest";
import { AgentRuntime } from "@/lib/agent/runtime";
import { AgentRuntimeError } from "@/lib/agent/errors";
import type { AgentProvider } from "@/lib/contracts/provider";

const result = { speech: "Hello", title: "Greeting", state: "complete" as const, cards: [], sources: [] };
async function collect(runtime: AgentRuntime, signal = new AbortController().signal) { const frames = []; for await (const frame of runtime.run({ message: "Hi", conversation: [] }, signal)) frames.push(frame); return frames; }

function provider(failure?: Error): AgentProvider {
  return {
    id: "fake",
    name: "Fake",
    async runAgent() {
      return {
        events: (async function* () {
          yield { id: "1", type: "agent_started" as const, timestamp: "now", label: "Started" };
        })(),
        result: failure
          ? Promise.reject(failure)
          : Promise.resolve({
              decision: { type: "direct" as const, result },
              result,
              meta: { provider: "Fake", model: "test", durationMs: 1 },
            }),
        cancel: async () => {},
      };
    },
  };
}

describe("AgentRuntime", () => {
  it("streams normalized events then a validated result", async () => {
    expect((await collect(new AgentRuntime(provider()))).map((frame) => frame.type)).toEqual(["event", "result"]);
  });

  it("converts runtime failures to safe frames", async () => {
    const frames = await collect(new AgentRuntime(provider(new AgentRuntimeError("timeout"))));
    expect(frames.at(-1)).toEqual({ type: "error", error: { code: "timeout", message: "The reasoning request timed out." } });
  });

  it("does not expose unknown exception details", async () => {
    const frames = await collect(new AgentRuntime(provider(new Error("secret raw failure"))));
    expect(JSON.stringify(frames)).not.toContain("secret");
    expect(frames.at(-1)).toMatchObject({ type: "error", error: { code: "unknown" } });
  });
});
