import { describe, expect, it } from "vitest";
import {
  normalizeGmailSearch,
  normalizeGmailMessage,
  normalizeCalendarEvents,
  normalizeDriveSearch,
  normalizeDriveFile,
  truncateContent,
  parseSender,
  isSupportedTextFormat,
} from "@/lib/google/normalizers";
import { GoogleApiError } from "@/lib/google/client";

describe("Google Workspace Normalizers", () => {
  describe("truncateContent", () => {
    it("preserves short content without truncation notice", () => {
      const { text, truncated } = truncateContent("Hello world", 50);
      expect(text).toBe("Hello world");
      expect(truncated).toBe(false);
    });

    it("truncates content and appends explicit truncation notice", () => {
      const { text, truncated } = truncateContent("1234567890abcdef", 10);
      expect(truncated).toBe(true);
      expect(text).toContain("[Content truncated...]");
      expect(text.startsWith("1234567890")).toBe(true);
    });
  });

  describe("parseSender", () => {
    it("parses name and email format", () => {
      const parsed = parseSender("Sam Altman <sam@openai.com>");
      expect(parsed.senderName).toBe("Sam Altman");
      expect(parsed.senderEmail).toBe("sam@openai.com");
    });

    it("parses raw email", () => {
      const parsed = parseSender("user@example.com");
      expect(parsed.senderName).toBe("user@example.com");
      expect(parsed.senderEmail).toBe("user@example.com");
    });
  });

  describe("normalizeGmailSearch", () => {
    it("returns empty result honestly for null or empty responses", () => {
      expect(normalizeGmailSearch(null, "from:alice")).toEqual({
        query: "from:alice",
        total: 0,
        messages: [],
      });
      expect(normalizeGmailSearch({ messages: [] }, "test")).toEqual({
        query: "test",
        total: 0,
        messages: [],
      });
    });

    it("normalizes messages correctly with snippet, headers, and attachments", () => {
      const raw = {
        messages: [
          {
            id: "msg-1",
            snippet: "Here is the project update...",
            internalDate: "1726819200000",
            labelIds: ["INBOX", "UNREAD"],
            payload: {
              headers: [
                { name: "From", value: "Alice Smith <alice@example.com>" },
                { name: "Subject", value: "Quarterly Review" },
              ],
              parts: [
                { filename: "report.pdf", mimeType: "application/pdf", body: { size: 1024 } },
              ],
            },
          },
        ],
      };

      const result = normalizeGmailSearch(raw, "Quarterly");
      expect(result.total).toBe(1);
      expect(result.messages[0]).toEqual({
        id: "msg-1",
        senderName: "Alice Smith",
        senderEmail: "alice@example.com",
        subject: "Quarterly Review",
        snippet: "Here is the project update...",
        timestamp: "2024-09-20T08:00:00.000Z",
        labels: ["INBOX", "UNREAD"],
        hasAttachments: true,
      });
    });
  });

  describe("normalizeGmailMessage", () => {
    it("extracts sender, recipients, subject, and decodes base64url body", () => {
      const encodedBody = Buffer.from("Hi Sam, let us sync tomorrow.", "utf8").toString("base64url");
      const raw = {
        id: "msg-123",
        payload: {
          headers: [
            { name: "From", value: "bob@example.com" },
            { name: "To", value: "sam@example.com, team@example.com" },
            { name: "Subject", value: "Sync Tomorrow" },
            { name: "Date", value: "2026-09-20T10:00:00Z" },
          ],
          parts: [
            {
              mimeType: "text/plain",
              body: { data: encodedBody },
            },
            {
              filename: "notes.docx",
              mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              body: { size: 4096 },
            },
          ],
        },
      };

      const result = normalizeGmailMessage(raw, "msg-123");
      expect(result.id).toBe("msg-123");
      expect(result.sender).toBe("bob@example.com");
      expect(result.recipients).toEqual(["sam@example.com", "team@example.com"]);
      expect(result.subject).toBe("Sync Tomorrow");
      expect(result.body).toBe("Hi Sam, let us sync tomorrow.");
      expect(result.attachments).toHaveLength(1);
      expect(result.attachments[0].filename).toBe("notes.docx");
    });

    it("truncates oversized email bodies", () => {
      const hugeText = "A".repeat(50_000);
      const encodedBody = Buffer.from(hugeText, "utf8").toString("base64url");
      const raw = {
        id: "msg-huge",
        payload: {
          headers: [{ name: "Subject", value: "Huge email" }],
          parts: [{ mimeType: "text/plain", body: { data: encodedBody } }],
        },
      };

      const result = normalizeGmailMessage(raw, "msg-huge");
      expect(result.truncated).toBe(true);
      expect(result.body).toContain("[Content truncated...]");
      expect(result.body.length).toBeLessThan(45_000);
    });
  });

  describe("normalizeCalendarEvents", () => {
    it("returns empty result honestly when items is empty or missing", () => {
      const result = normalizeCalendarEvents({}, "2026-09-20T00:00:00Z", "2026-09-20T23:59:59Z");
      expect(result.total).toBe(0);
      expect(result.events).toEqual([]);
    });

    it("normalizes calendar event details, attendees, and descriptions", () => {
      const raw = {
        items: [
          {
            id: "evt-1",
            summary: "Sprint Planning",
            description: "Review backlog and allocate tasks.",
            location: "Room 401",
            start: { dateTime: "2026-09-20T14:00:00Z" },
            end: { dateTime: "2026-09-20T15:00:00Z" },
            attendees: [{ displayName: "Alice", email: "alice@example.com" }],
          },
        ],
      };

      const result = normalizeCalendarEvents(raw, "2026-09-20T00:00:00Z", "2026-09-20T23:59:59Z");
      expect(result.total).toBe(1);
      expect(result.events[0]).toEqual({
        id: "evt-1",
        title: "Sprint Planning",
        start: "2026-09-20T14:00:00Z",
        end: "2026-09-20T15:00:00Z",
        attendees: ["Alice"],
        location: "Room 401",
        description: "Review backlog and allocate tasks.",
      });
    });
  });

  describe("normalizeDriveSearch", () => {
    it("normalizes file metadata and types", () => {
      const raw = {
        files: [
          {
            id: "file-doc-1",
            name: "Architecture Spec",
            mimeType: "application/vnd.google-apps.document",
            modifiedTime: "2026-09-18T12:00:00Z",
            owners: [{ displayName: "Sam" }],
            webViewLink: "https://docs.google.com/document/d/file-doc-1/edit",
          },
        ],
      };

      const result = normalizeDriveSearch(raw, "Architecture");
      expect(result.total).toBe(1);
      expect(result.files[0]).toEqual({
        id: "file-doc-1",
        name: "Architecture Spec",
        type: "Google Doc",
        modifiedAt: "2026-09-18T12:00:00Z",
        owner: "Sam",
        webLink: "https://docs.google.com/document/d/file-doc-1/edit",
      });
    });
  });

  describe("normalizeDriveFile", () => {
    it("normalizes supported text file content", () => {
      const content = "# Meeting Notes\nDiscussion on Phase 6.";
      const result = normalizeDriveFile("doc-1", content, {
        name: "Notes.md",
        mimeType: "text/markdown",
        modifiedTime: "2026-09-20T08:00:00Z",
      });

      expect(result.id).toBe("doc-1");
      expect(result.name).toBe("Notes.md");
      expect(result.mimeType).toBe("text/markdown");
      expect(result.content).toBe(content);
      expect(result.truncated).toBeUndefined();
    });

    it("rejects unsupported binary files safely", () => {
      expect(() =>
        normalizeDriveFile("img-1", "binarydata", {
          name: "diagram.png",
          mimeType: "image/png",
        })
      ).toThrow(GoogleApiError);
    });

    it("checks isSupportedTextFormat", () => {
      expect(isSupportedTextFormat("text/plain")).toBe(true);
      expect(isSupportedTextFormat("text/markdown")).toBe(true);
      expect(isSupportedTextFormat("application/vnd.google-apps.document")).toBe(true);
      expect(isSupportedTextFormat("image/jpeg")).toBe(false);
      expect(isSupportedTextFormat("video/mp4")).toBe(false);
      expect(isSupportedTextFormat("application/zip")).toBe(false);
    });
  });
});
