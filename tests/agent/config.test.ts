import { describe, expect, it } from "vitest";
import { readAgentConfig } from "@/lib/agent/config";

const validEntry = "C:\\tools\\node_modules\\command-code\\dist\\index.mjs";

describe("agent configuration", () => {
  it("uses bounded defaults and leaves the model configurable", () => {
    const config = readAgentConfig({ JARVIS_COMMAND_CODE_ENTRY: validEntry });
    expect(config).toMatchObject({ commandCodeEntry: validEntry, timeoutMs: 60_000, maxTurns: 2 });
    expect(config.model).toBeUndefined();
  });

  it("accepts an optional configured model", () => {
    expect(readAgentConfig({ JARVIS_COMMAND_CODE_ENTRY: validEntry, JARVIS_COMMAND_CODE_MODEL: "provider/model", JARVIS_AGENT_TIMEOUT_MS: "5000", JARVIS_AGENT_MAX_TURNS: "3" }).model).toBe("provider/model");
  });

  it("rejects Windows Command Prompt and shell shims", () => {
    expect(() => readAgentConfig({ JARVIS_COMMAND_CODE_ENTRY: "C:\\Windows\\System32\\cmd.exe" })).toThrow("not configured");
    expect(() => readAgentConfig({ JARVIS_COMMAND_CODE_ENTRY: "C:\\tools\\commandcode.cmd" })).toThrow("not configured");
  });

  it("rejects missing and unsafe range values", () => {
    expect(() => readAgentConfig({})).toThrow("not configured");
    expect(() => readAgentConfig({ JARVIS_COMMAND_CODE_ENTRY: validEntry, JARVIS_AGENT_TIMEOUT_MS: "10" })).toThrow("not configured");
  });
});
