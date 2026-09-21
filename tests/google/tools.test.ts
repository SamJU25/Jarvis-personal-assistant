import { describe, expect, it } from "vitest";
import { ToolRegistry } from "@/lib/tools/registry";
import {
  searchGmailTool,
  readGmailTool,
  getCalendarEventsTool,
  searchDriveTool,
  readDriveFileTool,
  registerGoogleTools,
} from "@/lib/google/tools";
import {
  searchGmailInputSchema,
  readGmailInputSchema,
  getCalendarEventsInputSchema,
  searchDriveInputSchema,
  readDriveFileInputSchema,
} from "@/lib/google/types";

describe("Google Workspace Tools and Registry", () => {
  it("registers all 5 Google tools into the ToolRegistry", () => {
    const registry = new ToolRegistry();
    registerGoogleTools(registry);

    expect(registry.has("search_gmail")).toBe(true);
    expect(registry.has("read_gmail")).toBe(true);
    expect(registry.has("get_calendar_events")).toBe(true);
    expect(registry.has("search_drive")).toBe(true);
    expect(registry.has("read_drive_file")).toBe(true);
  });

  it("ensures all 5 tools are strictly read permission", () => {
    expect(searchGmailTool.permission).toBe("read");
    expect(readGmailTool.permission).toBe("read");
    expect(getCalendarEventsTool.permission).toBe("read");
    expect(searchDriveTool.permission).toBe("read");
    expect(readDriveFileTool.permission).toBe("read");
  });

  it("validates search_gmail inputs and rejects empty or oversized query", () => {
    expect(() => searchGmailInputSchema.parse({ query: "" })).toThrow();
    expect(() => searchGmailInputSchema.parse({ query: "   " })).toThrow();
    expect(() => searchGmailInputSchema.parse({ query: "a".repeat(501) })).toThrow();
    expect(searchGmailInputSchema.parse({ query: "from:alice", limit: 5 })).toEqual({
      query: "from:alice",
      limit: 5,
    });
  });

  it("validates read_gmail inputs and rejects empty messageId", () => {
    expect(() => readGmailInputSchema.parse({ messageId: "" })).toThrow();
    expect(() => readGmailInputSchema.parse({ messageId: "  " })).toThrow();
    expect(readGmailInputSchema.parse({ messageId: "msg-12345" })).toEqual({
      messageId: "msg-12345",
    });
  });

  it("validates get_calendar_events inputs and enforces valid date range", () => {
    expect(() =>
      getCalendarEventsInputSchema.parse({
        start: "invalid-date",
        end: "2026-09-20",
      })
    ).toThrow();

    // Start after End must be rejected
    expect(() =>
      getCalendarEventsInputSchema.parse({
        start: "2026-09-21T00:00:00Z",
        end: "2026-09-20T00:00:00Z",
      })
    ).toThrow();

    const valid = getCalendarEventsInputSchema.parse({
      start: "2026-09-20T00:00:00Z",
      end: "2026-09-20T23:59:59Z",
      query: "planning",
    });
    expect(valid.query).toBe("planning");
  });

  it("validates search_drive inputs and bounds limits", () => {
    expect(() => searchDriveInputSchema.parse({ query: "" })).toThrow();
    expect(() => searchDriveInputSchema.parse({ query: "doc", limit: 100 })).toThrow();
    expect(searchDriveInputSchema.parse({ query: "launch", limit: 20 })).toEqual({
      query: "launch",
      limit: 20,
    });
  });

  it("validates read_drive_file inputs", () => {
    expect(() => readDriveFileInputSchema.parse({ fileId: "" })).toThrow();
    expect(readDriveFileInputSchema.parse({ fileId: "file-999" })).toEqual({
      fileId: "file-999",
    });
  });

  it("provides meaningful, agent-focused descriptions without exposing CLI details", () => {
    const registry = new ToolRegistry();
    registerGoogleTools(registry);
    const meta = registry.getMetadata();

    for (const toolMeta of meta) {
      expect(toolMeta.description).not.toContain("gws");
      expect(toolMeta.description).not.toContain("execFile");
      expect(toolMeta.description).not.toContain("child_process");
      expect(toolMeta.description.length).toBeGreaterThan(30);
    }
  });
});
