import { describe, expect, it, beforeEach, afterEach } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import {
  listDocumentsTool,
  readDocumentTool,
  writeDocumentTool,
} from "@/lib/documents/tools";
import { setAllowedRootsOverride } from "@/lib/documents/config";

const mockContext = {
  signal: new AbortController().signal,
  callId: "test-call-id",
};

describe("Document Intelligence — Governed Tools Execution", () => {
  let tempDir: string;
  let docsRoot: string;
  let readOnlyRoot: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "jarvis-doc-tools-test-"));
    docsRoot = path.join(tempDir, "docs");
    readOnlyRoot = path.join(tempDir, "readonly");
    await fs.mkdir(docsRoot, { recursive: true });
    await fs.mkdir(readOnlyRoot, { recursive: true });

    setAllowedRootsOverride([
      { id: "docs", name: "Documents", path: docsRoot, readOnly: false },
      { id: "readonly", name: "Read Only Archive", path: readOnlyRoot, readOnly: true },
    ]);
  });

  afterEach(async () => {
    setAllowedRootsOverride(null);
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe("Declarative Capabilities", () => {
    it("list_documents declares read capability with read_verification", () => {
      expect(listDocumentsTool.permission).toBe("read");
      expect(listDocumentsTool.riskLevel).toBe("low");
      expect(listDocumentsTool.confirmationPolicy).toBe("none");
      expect(listDocumentsTool.verificationStrategy).toBe("read_verification");
    });

    it("read_document declares read capability with read_verification", () => {
      expect(readDocumentTool.permission).toBe("read");
      expect(readDocumentTool.riskLevel).toBe("low");
      expect(readDocumentTool.confirmationPolicy).toBe("none");
      expect(readDocumentTool.verificationStrategy).toBe("read_verification");
    });

    it("write_document declares write capability with explicit confirmation and document_verification", () => {
      expect(writeDocumentTool.permission).toBe("write");
      expect(writeDocumentTool.riskLevel).toBe("medium");
      expect(writeDocumentTool.confirmationPolicy).toBe("explicit");
      expect(writeDocumentTool.verificationStrategy).toBe("document_verification");
    });
  });

  describe("Tool Execution", () => {
    it("list_documents lists directory entries", async () => {
      await fs.writeFile(path.join(docsRoot, "file1.txt"), "hello");
      await fs.writeFile(path.join(docsRoot, "file2.md"), "world");

      const res = await listDocumentsTool.execute(
        { path: ".", rootId: "docs", recursive: false, limit: 10 },
        mockContext
      );
      expect(res.rootId).toBe("docs");
      expect(res.total).toBe(2);
      expect(res.entries.map((e) => e.name).sort()).toEqual(["file1.txt", "file2.md"]);
    });

    it("read_document reads text document content", async () => {
      const filePath = path.join(docsRoot, "test.txt");
      await fs.writeFile(filePath, "JARVIS document content", "utf-8");

      const res = await readDocumentTool.execute(
        { path: "test.txt", rootId: "docs", maxBytes: 1000 },
        mockContext
      );
      expect(res.name).toBe("test.txt");
      expect(res.content).toBe("JARVIS document content");
      expect(res.isBinary).toBe(false);
    });

    it("write_document writes file to disk and calculates sha256", async () => {
      const res = await writeDocumentTool.execute(
        {
          path: "subfolder/newdoc.md",
          content: "# New Document\nWritten by JARVIS.",
          rootId: "docs",
        },
        mockContext
      );

      expect(res.path).toBe("subfolder/newdoc.md");
      expect(res.rootId).toBe("docs");
      expect(res.sha256).toBeTruthy();

      const diskContent = await fs.readFile(path.join(docsRoot, "subfolder", "newdoc.md"), "utf-8");
      expect(diskContent).toBe("# New Document\nWritten by JARVIS.");
    });

    it("write_document rejects writing to read-only root", async () => {
      await expect(
        writeDocumentTool.execute(
          {
            path: "readonly.txt",
            content: "attempt",
            rootId: "readonly",
          },
          mockContext
        )
      ).rejects.toThrow("is read-only");
    });

    it("write_document rejects content containing credentials / secrets", async () => {
      await expect(
        writeDocumentTool.execute(
          {
            path: "leak.txt",
            content: "Here is my secret: AKIAIOSFODNN7EXAMPLE",
            rootId: "docs",
          },
          mockContext
        )
      ).rejects.toThrow("Cannot write document: Content contains sensitive credentials");
    });
  });
});
