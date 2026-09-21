import { describe, expect, it } from "vitest";
import { buildAgentPrompt, parseStructuredResult } from "@/lib/agent/prompt";

const validResult = JSON.stringify({ speech: "Hello.", title: "Greeting", state: "complete", cards: [{ id: "response", type: "generic", label: "Response", title: "Hello", body: "Ready." }], sources: [] });

describe("agent prompt boundary", () => {
  it("includes bounded role context and Phase 4 limits", () => {
    const prompt = buildAgentPrompt({ request: "Hello Jarvis.", conversation: [{ role: "assistant", content: "Previous answer" }] });
    expect(prompt).toContain("ASSISTANT: Previous answer");
    expect(prompt).toContain("USER: Hello Jarvis.");
    expect(prompt).toContain("Phase 4 has a tool registry");
    expect(prompt).toContain('"type":"generic"');
  });

  it("parses strict validated JSON", () => {
    expect(parseStructuredResult(validResult).speech).toBe("Hello.");
  });

  it.each([`\n${validResult}`, `${validResult}\n`, `\`\`\`json\n${validResult}\n\`\`\``, `Answer: ${validResult}`, "not json", JSON.stringify({ speech: "Hi" })])("rejects malformed provider text", (text) => {
    expect(() => parseStructuredResult(text)).toThrow("safely validated");
  });
});
