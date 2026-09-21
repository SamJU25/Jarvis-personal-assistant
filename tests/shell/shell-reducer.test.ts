import { describe, expect, it } from "vitest";
import { initialShellState, shellReducer } from "@/lib/shell/shell-reducer";

const meta = { provider: "Command Code", model: "default", durationMs: 10 };
const result = { speech: "Hello", title: "Greeting", state: "complete" as const, cards: [], sources: [] };

describe("shellReducer", () => {
  it("keeps explicit preview state when idle", () => expect(shellReducer(initialShellState, { type: "coreStateChanged", state: "thinking" }).coreState).toBe("thinking"));
  it("starts a real run in thinking state", () => expect(shellReducer(initialShellState, { type: "runRequested", runId: "1", command: "Hi" })).toMatchObject({ activeRunId: "1", runStatus: "running", coreState: "thinking", submittedCommand: "Hi" }));
  it("accepts events and results only for the active run", () => {
    const running = shellReducer(initialShellState, { type: "runRequested", runId: "1", command: "Hi" });
    const stale = shellReducer(running, { type: "runResultReceived", runId: "old", result, meta });
    expect(stale).toBe(running);
    const complete = shellReducer(running, { type: "runResultReceived", runId: "1", result, meta });
    expect(complete).toMatchObject({ activeRunId: null, runStatus: "complete", coreState: "idle", result });
    expect(complete.conversation).toHaveLength(2);
  });
  it("maps failure and cancellation truthfully", () => {
    const running = shellReducer(initialShellState, { type: "runRequested", runId: "1", command: "Hi" });
    expect(shellReducer(running, { type: "runFailed", runId: "1", error: { code: "timeout", message: "Timed out" } })).toMatchObject({ coreState: "error", runStatus: "failed" });
    expect(shellReducer(running, { type: "runCancelled", runId: "1" })).toMatchObject({ coreState: "idle", runStatus: "cancelled" });
  });
  it("blocks visual preview changes during a real run", () => {
    const running = shellReducer(initialShellState, { type: "runRequested", runId: "1", command: "Hi" });
    expect(shellReducer(running, { type: "coreStateChanged", state: "speaking" })).toBe(running);
  });
  it("resets all state", () => expect(shellReducer({ ...initialShellState, coreState: "speaking" }, { type: "shellReset" })).toEqual(initialShellState));
});
