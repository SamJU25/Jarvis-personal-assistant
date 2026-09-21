import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { CreateNoteVerificationStrategy } from "@/lib/verification/strategies/note-verification";
import { CreateGoogleDocVerificationStrategy } from "@/lib/verification/strategies/doc-verification";
import { DraftEmailVerificationStrategy } from "@/lib/verification/strategies/email-verification";
import { DefaultReadVerificationStrategy } from "@/lib/verification/strategies/read-verification";
import type { VerificationRequest } from "@/lib/contracts/verification";

const FIXTURES_DIR = join(process.cwd(), "tests", "fixtures", "verification-vault");

describe("Phase 10 Tool Verification Strategies", () => {
  beforeEach(async () => {
    process.env.OBSIDIAN_VAULT_PATH = FIXTURES_DIR;
    await mkdir(FIXTURES_DIR, { recursive: true });
  });

  afterEach(async () => {
    delete process.env.OBSIDIAN_VAULT_PATH;
    await rm(FIXTURES_DIR, { recursive: true, force: true });
  });

  describe("CreateNoteVerificationStrategy", () => {
    const strategy = new CreateNoteVerificationStrategy();

    it("passes verification when file exists on disk inside vault with matching content", async () => {
      const noteRelative = "Inbox/JARVIS/Test Note.md";
      const fullNotePath = join(FIXTURES_DIR, "Inbox", "JARVIS", "Test Note.md");
      await mkdir(join(FIXTURES_DIR, "Inbox", "JARVIS"), { recursive: true });
      await writeFile(fullNotePath, "# Test Note\n\nVerified content.");

      const request: VerificationRequest = {
        runId: "run-note-1",
        toolId: "create_note",
        parameters: { title: "Test Note", content: "Verified content." },
        toolResult: {
          callId: "call-1",
          toolId: "create_note",
          status: "success",
          output: { path: noteRelative, title: "Test Note" },
        },
        timestamp: new Date().toISOString(),
      };

      const result = await strategy.verify(request);
      expect(result.status).toBe("passed");
      expect(result.evidence.length).toBeGreaterThan(0);
      expect(result.evidence[0].type).toBe("file");
      expect(result.evidence[0].details?.relativePath).toBe(noteRelative.replace(/\\/g, "/"));
    });

    it("fails verification when file is missing from disk", async () => {
      const request: VerificationRequest = {
        runId: "run-note-2",
        toolId: "create_note",
        parameters: { title: "Ghost Note", content: "Not here" },
        toolResult: {
          callId: "call-2",
          toolId: "create_note",
          status: "success",
          output: { path: "Inbox/JARVIS/Ghost Note.md", title: "Ghost Note" },
        },
        timestamp: new Date().toISOString(),
      };

      const result = await strategy.verify(request);
      expect(result.status).toBe("failed");
      expect(result.reason).toContain("Note file was not found on disk");
    });

    it("fails verification when path traversal escapes the vault", async () => {
      const request: VerificationRequest = {
        runId: "run-note-3",
        toolId: "create_note",
        parameters: { title: "Escape Note", content: "Traverse" },
        toolResult: {
          callId: "call-3",
          toolId: "create_note",
          status: "success",
          output: { path: "../../Outside.md", title: "Escape Note" },
        },
        timestamp: new Date().toISOString(),
      };

      const result = await strategy.verify(request);
      expect(result.status).toBe("failed");
      expect(result.reason).toContain("containment");
    });

    it("fails verification when tool execution reported failure", async () => {
      const request: VerificationRequest = {
        runId: "run-note-4",
        toolId: "create_note",
        parameters: {},
        toolResult: {
          callId: "call-4",
          toolId: "create_note",
          status: "failure",
          error: "Filesystem write permission denied",
        },
        timestamp: new Date().toISOString(),
      };

      const result = await strategy.verify(request);
      expect(result.status).toBe("failed");
      expect(result.reason).toContain("Filesystem write permission denied");
    });
  });

  describe("CreateGoogleDocVerificationStrategy", () => {
    const strategy = new CreateGoogleDocVerificationStrategy();

    it("passes verification with valid documentId and safe link", async () => {
      const request: VerificationRequest = {
        runId: "run-doc-1",
        toolId: "create_google_doc",
        parameters: { title: "Quarterly Review" },
        toolResult: {
          callId: "call-doc-1",
          toolId: "create_google_doc",
          status: "success",
          output: {
            documentId: "doc-12345",
            title: "Quarterly Review",
            webLink: "https://docs.google.com/document/d/doc-12345/edit",
            createdAt: new Date().toISOString(),
          },
        },
        timestamp: new Date().toISOString(),
      };

      const result = await strategy.verify(request);
      expect(result.status).toBe("passed");
      expect(result.evidence[0].type).toBe("document");
      expect(result.evidence[0].details?.documentId).toBe("doc-12345");
    });

    it("fails verification when documentId is missing", async () => {
      const request: VerificationRequest = {
        runId: "run-doc-2",
        toolId: "create_google_doc",
        parameters: { title: "Bad Doc" },
        toolResult: {
          callId: "call-doc-2",
          toolId: "create_google_doc",
          status: "success",
          output: {
            title: "Bad Doc",
            webLink: "",
          },
        },
        timestamp: new Date().toISOString(),
      };

      const result = await strategy.verify(request);
      expect(result.status).toBe("failed");
      expect(result.reason).toContain("missing or empty Google Document ID");
    });

    it("fails verification when web link is unsafe or invalid format", async () => {
      const request: VerificationRequest = {
        runId: "run-doc-3",
        toolId: "create_google_doc",
        parameters: { title: "Phishing Doc" },
        toolResult: {
          callId: "call-doc-3",
          toolId: "create_google_doc",
          status: "success",
          output: {
            documentId: "doc-999",
            title: "Phishing Doc",
            webLink: "https://evil.example.com/steal-creds",
          },
        },
        timestamp: new Date().toISOString(),
      };

      const result = await strategy.verify(request);
      expect(result.status).toBe("failed");
      expect(result.reason).toContain("web link format is invalid or unsafe");
    });
  });

  describe("DraftEmailVerificationStrategy", () => {
    const strategy = new DraftEmailVerificationStrategy();

    it("passes verification for a valid draft and confirms draft-only status", async () => {
      const request: VerificationRequest = {
        runId: "run-mail-1",
        toolId: "draft_email",
        parameters: { to: "alice@example.com", subject: "Hello" },
        toolResult: {
          callId: "call-mail-1",
          toolId: "draft_email",
          status: "success",
          output: {
            draftId: "draft-789",
            to: "alice@example.com",
            subject: "Hello",
            createdAt: new Date().toISOString(),
          },
        },
        timestamp: new Date().toISOString(),
      };

      const result = await strategy.verify(request);
      expect(result.status).toBe("passed");
      expect(result.evidence[0].type).toBe("email");
      expect(result.evidence[0].details?.isDraftOnly).toBe(true);
    });

    it("fails verification when draft ID is missing", async () => {
      const request: VerificationRequest = {
        runId: "run-mail-2",
        toolId: "draft_email",
        parameters: { to: "alice@example.com", subject: "Hello" },
        toolResult: {
          callId: "call-mail-2",
          toolId: "draft_email",
          status: "success",
          output: {
            to: "alice@example.com",
            subject: "Hello",
          },
        },
        timestamp: new Date().toISOString(),
      };

      const result = await strategy.verify(request);
      expect(result.status).toBe("failed");
      expect(result.reason).toContain("missing or empty Gmail draft ID");
    });

    it("strictly rejects results claiming an email was sent", async () => {
      const request: VerificationRequest = {
        runId: "run-mail-3",
        toolId: "draft_email",
        parameters: { to: "alice@example.com", subject: "Hello" },
        toolResult: {
          callId: "call-mail-3",
          toolId: "draft_email",
          status: "success",
          output: {
            sentAt: "2026-09-20T12:00:00Z",
            messageId: "sent-msg-123",
          },
        },
        timestamp: new Date().toISOString(),
      };

      const result = await strategy.verify(request);
      expect(result.status).toBe("failed");
      expect(result.reason).toContain("draft-only constraints");
    });
  });

  describe("DefaultReadVerificationStrategy", () => {
    const strategy = new DefaultReadVerificationStrategy();

    it("passes verification when read tool output is present and valid", async () => {
      const request: VerificationRequest = {
        runId: "run-read-1",
        toolId: "search_vault",
        parameters: { query: "AI" },
        toolResult: {
          callId: "call-read-1",
          toolId: "search_vault",
          status: "success",
          output: { total: 1, results: [] },
        },
        timestamp: new Date().toISOString(),
      };

      const result = await strategy.verify(request);
      expect(result.status).toBe("passed");
      expect(result.evidence[0].type).toBe("schema");
    });

    it("fails verification when read tool returned empty or null", async () => {
      const request: VerificationRequest = {
        runId: "run-read-2",
        toolId: "search_vault",
        parameters: { query: "AI" },
        toolResult: {
          callId: "call-read-2",
          toolId: "search_vault",
          status: "success",
          output: null,
        },
        timestamp: new Date().toISOString(),
      };

      const result = await strategy.verify(request);
      expect(result.status).toBe("failed");
    });
  });
});
