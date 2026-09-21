import { describe, expect, it } from "vitest";
import {
  currentTimeInputSchema,
  currentTimeOutputSchema,
  searchDemoDataInputSchema,
  searchDemoDataOutputSchema,
  readDemoItemInputSchema,
  readDemoItemOutputSchema,
} from "@/lib/tools/demo-tools";
import {
  toolCallRequestSchema,
  toolResultSchema,
} from "@/lib/contracts/tool";

describe("Tool Contracts & Schemas", () => {
  describe("currentTime schemas", () => {
    it("validates valid input with and without timezone", () => {
      expect(currentTimeInputSchema.safeParse({}).success).toBe(true);
      expect(currentTimeInputSchema.safeParse({ timezone: "America/New_York" }).success).toBe(true);
    });

    it("rejects invalid input types", () => {
      expect(currentTimeInputSchema.safeParse({ timezone: 123 }).success).toBe(false);
    });

    it("validates valid output", () => {
      const valid = {
        iso: "2026-09-20T12:00:00.000Z",
        date: "Sunday, September 20, 2026",
        time: "12:00:00 PM",
        timezone: "UTC",
      };
      expect(currentTimeOutputSchema.safeParse(valid).success).toBe(true);
    });

    it("rejects invalid output missing required fields", () => {
      expect(currentTimeOutputSchema.safeParse({ iso: "2026" }).success).toBe(false);
    });
  });

  describe("searchDemoData schemas", () => {
    it("validates valid query input", () => {
      expect(searchDemoDataInputSchema.safeParse({ query: "jarvis" }).success).toBe(true);
    });

    it("rejects empty or whitespace query input", () => {
      expect(searchDemoDataInputSchema.safeParse({ query: "" }).success).toBe(false);
      expect(searchDemoDataInputSchema.safeParse({ query: "   " }).success).toBe(false);
      expect(searchDemoDataInputSchema.safeParse({}).success).toBe(false);
    });

    it("validates valid search results output", () => {
      const valid = {
        query: "jarvis",
        total: 1,
        results: [{ id: "demo-1", title: "Title", summary: "Summary", category: "arch" }],
      };
      expect(searchDemoDataOutputSchema.safeParse(valid).success).toBe(true);
    });

    it("rejects negative total or malformed results array", () => {
      expect(searchDemoDataOutputSchema.safeParse({ query: "x", total: -1, results: [] }).success).toBe(false);
      expect(searchDemoDataOutputSchema.safeParse({ query: "x", total: 0, results: [{ id: 123 }] }).success).toBe(false);
    });
  });

  describe("readDemoItem schemas", () => {
    it("validates valid id input", () => {
      expect(readDemoItemInputSchema.safeParse({ id: "demo-item-1" }).success).toBe(true);
    });

    it("rejects blank id input", () => {
      expect(readDemoItemInputSchema.safeParse({ id: "" }).success).toBe(false);
      expect(readDemoItemInputSchema.safeParse({ id: "   " }).success).toBe(false);
      expect(readDemoItemInputSchema.safeParse({}).success).toBe(false);
    });

    it("validates valid item output", () => {
      const valid = {
        id: "demo-item-1",
        title: "Test",
        content: "Detailed content",
        category: "notes",
        tags: ["one", "two"],
        lastModified: "2026-09-01T00:00:00.000Z",
      };
      expect(readDemoItemOutputSchema.safeParse(valid).success).toBe(true);
    });

    it("rejects output with missing tags or content", () => {
      expect(readDemoItemOutputSchema.safeParse({ id: "demo-1", title: "T" }).success).toBe(false);
    });
  });

  describe("ToolCallRequest & ToolResult schemas", () => {
    it("validates well-formed tool call request", () => {
      const request = {
        type: "tool_call",
        callId: "call_abc",
        toolId: "get_current_time",
        arguments: { timezone: "UTC" },
      };
      const parsed = toolCallRequestSchema.safeParse(request);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.callId).toBe("call_abc");
        expect(parsed.data.toolId).toBe("get_current_time");
      }
    });

    it("rejects tool call with missing callId or toolId", () => {
      expect(toolCallRequestSchema.safeParse({ type: "tool_call", toolId: "t1" }).success).toBe(false);
      expect(toolCallRequestSchema.safeParse({ type: "tool_call", callId: "c1" }).success).toBe(false);
      expect(toolCallRequestSchema.safeParse({ type: "tool_call", callId: "", toolId: "t1" }).success).toBe(false);
    });

    it("validates successful tool result", () => {
      const result = {
        callId: "call_abc",
        toolId: "get_current_time",
        status: "success",
        output: { iso: "2026-09-20T00:00:00.000Z" },
      };
      expect(toolResultSchema.safeParse(result).success).toBe(true);
    });

    it("validates failed tool result with error message", () => {
      const result = {
        callId: "call_abc",
        toolId: "read_demo_item",
        status: "failure",
        error: "Item not found",
      };
      expect(toolResultSchema.safeParse(result).success).toBe(true);
    });

    it("rejects invalid status", () => {
      expect(toolResultSchema.safeParse({ callId: "c1", toolId: "t1", status: "pending" }).success).toBe(false);
    });
  });
});
