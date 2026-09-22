import { describe, expect, it, beforeEach, afterEach } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import { DocumentVerificationStrategy } from "@/lib/verification/strategies/document-verification";
import { setAllowedRootsOverride } from "@/lib/documents/config";
import type { VerificationRequest } from "@/lib/contracts/verification";

describe("Document Intelligence — Deterministic Document Verification Strategy", () => {
  let tempDir: string;
  let docsRoot: string;
  let strategy: DocumentVerificationStrategy;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "jarvis-doc-ver-test-"));
    docsRoot = path.join(tempDir, "docs");
    await fs.mkdir(docsRoot, { recursive: true });

    setAllowedRootsOverride([
      { id: "docs", name: "Documents", path: docsRoot, readOnly: false },
    ]);

    strategy = new DocumentVerificationStrategy();
  });

  afterEach(async () => {
    setAllowedRootsOverride(null);
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("passes verification when file exists on disk with matching sha256", async () => {
    const content = "# Verified Document Content\n12345";
    const filePath = path.join(docsRoot, "verified.md");
    await fs.writeFile(filePath, content, "utf-8");

    const sha256 = crypto.createHash("sha256").update(Buffer.from(content, "utf-8")).digest("hex");

    const request: VerificationRequest = {
      runId: "run-1",
      taskId: "task-1",
      toolId: "write_document",
      parameters: { path: "verified.md", content },
      timestamp: new Date().toISOString(),
      toolResult: {
        callId: "call-1",
        toolId: "write_document",
        status: "success",
        output: {
          path: "verified.md",
          rootId: "docs",
          sizeBytes: Buffer.byteLength(content, "utf-8"),
          sha256,
          writtenAt: new Date().toISOString(),
        },
      },
    };

    const res = await strategy.verify(request);
    expect(res.status).toBe("passed");
    expect(res.evidence).toHaveLength(1);
    expect(res.evidence[0].type).toBe("document");
    expect(res.evidence[0].details?.path).toBe("verified.md");
    expect(res.evidence[0].details?.sha256).toBe(sha256);
  });

  it("fails verification when tool execution failed", async () => {
    const request: VerificationRequest = {
      runId: "run-2",
      taskId: "task-2",
      toolId: "write_document",
      parameters: {},
      timestamp: new Date().toISOString(),
      toolResult: {
        callId: "call-2",
        toolId: "write_document",
        status: "failure",
        error: "Disk full error",
      },
    };

    const res = await strategy.verify(request);
    expect(res.status).toBe("failed");
    expect(res.reason).toContain("Disk full error");
  });

  it("fails verification when file is missing from disk", async () => {
    const request: VerificationRequest = {
      runId: "run-3",
      taskId: "task-3",
      toolId: "write_document",
      parameters: {},
      timestamp: new Date().toISOString(),
      toolResult: {
        callId: "call-3",
        toolId: "write_document",
        status: "success",
        output: {
          path: "ghost.txt",
          rootId: "docs",
          sizeBytes: 10,
          sha256: "fakehash",
          writtenAt: new Date().toISOString(),
        },
      },
    };

    const res = await strategy.verify(request);
    expect(res.status).toBe("failed");
    expect(res.reason).toContain("File not found on disk");
  });

  it("fails verification when hash does not match disk content", async () => {
    const filePath = path.join(docsRoot, "tampered.txt");
    await fs.writeFile(filePath, "actual content on disk", "utf-8");

    const request: VerificationRequest = {
      runId: "run-4",
      taskId: "task-4",
      toolId: "write_document",
      parameters: {},
      timestamp: new Date().toISOString(),
      toolResult: {
        callId: "call-4",
        toolId: "write_document",
        status: "success",
        output: {
          path: "tampered.txt",
          rootId: "docs",
          sizeBytes: 20,
          sha256: "expected_different_hash",
          writtenAt: new Date().toISOString(),
        },
      },
    };

    const res = await strategy.verify(request);
    expect(res.status).toBe("failed");
    expect(res.reason).toContain("content hash mismatch");
  });

  it("fails verification when path attempts directory traversal", async () => {
    const request: VerificationRequest = {
      runId: "run-5",
      taskId: "task-5",
      toolId: "write_document",
      parameters: {},
      timestamp: new Date().toISOString(),
      toolResult: {
        callId: "call-5",
        toolId: "write_document",
        status: "success",
        output: {
          path: "../escaped.txt",
          rootId: "docs",
          sizeBytes: 20,
          sha256: "hash",
          writtenAt: new Date().toISOString(),
        },
      },
    };

    const res = await strategy.verify(request);
    expect(res.status).toBe("failed");
    expect(res.reason).toContain("Containment violation");
  });
});
