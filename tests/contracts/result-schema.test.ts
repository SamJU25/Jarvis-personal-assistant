import { describe, expect, it } from "vitest";
import { resultCardSchema, structuredResultSchema } from "@/lib/contracts/result";
import { sampleScenarios } from "@/lib/mock/scenarios";

const expectedTypes = ["meeting", "calendar", "email", "note", "insight", "action", "document", "research", "source", "generic"];

describe("result schemas", () => {
  it("validates every semantic sample renderer", () => {
    const types = sampleScenarios.flatMap((scenario) => scenario.cards.map((card) => card.type));
    expect(new Set(types)).toEqual(new Set(expectedTypes));
  });

  it("rejects unknown renderer types", () => {
    expect(() => resultCardSchema.parse({ id: "bad", type: "html", label: "Unsafe", body: "<b>Hi</b>" })).toThrow();
  });

  it("validates the structured result boundary", () => {
    const result = structuredResultSchema.parse({
      speech: "Sample response",
      title: "Preview",
      state: "complete",
      cards: sampleScenarios[0].cards,
      sources: sampleScenarios[0].sources,
    });
    expect(result.cards).toHaveLength(3);
  });

  it("marks every scenario as sample data", () => {
    expect(sampleScenarios.every((scenario) => scenario.kind === "sample")).toBe(true);
  });
});
