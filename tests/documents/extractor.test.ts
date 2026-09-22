import { describe, expect, it, beforeEach, afterEach } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import {
  extractDocumentContent,
  listDirectoryContents,
  classifyFile,
  sanitizeDocumentText,
  formatBytes,
} from "@/lib/documents/extractor";

describe("Document Intelligence — Extractor & Media Handling", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "jarvis-doc-extractor-test-"));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe("File classification", () => {
    it("correctly identifies text and markdown", () => {
      expect(classifyFile("test.md")).toEqual({
        category: "markdown",
        mimeType: "text/markdown",
        isBinary: false,
      });
      expect(classifyFile("script.py")).toEqual({
        category: "code",
        mimeType: "text/x-python",
        isBinary: false,
      });
      expect(classifyFile("data.json")).toEqual({
        category: "data",
        mimeType: "application/json",
        isBinary: false,
      });
    });

    it("correctly identifies binary and media formats", () => {
      expect(classifyFile("doc.pdf")).toEqual({
        category: "document",
        mimeType: "application/pdf",
        isBinary: true,
      });
      expect(classifyFile("image.png")).toEqual({
        category: "image",
        mimeType: "image/png",
        isBinary: true,
      });
      expect(classifyFile("sound.mp3")).toEqual({
        category: "audio",
        mimeType: "audio/mpeg",
        isBinary: true,
      });
    });
  });

  describe("Text Sanitization & Formatting", () => {
    it("strips ANSI escapes and non-printable control characters while preserving newlines/tabs", () => {
      const raw = "\x1B[31mError:\x1B[0m Invalid \x00null\x07bell\tTabbed\nLine 2";
      const sanitized = sanitizeDocumentText(raw);
      expect(sanitized).toBe("Error: Invalid nullbell\tTabbed\nLine 2");
    });

    it("formats bytes accurately", () => {
      expect(formatBytes(0)).toBe("0 B");
      expect(formatBytes(1024)).toBe("1.0 KB");
      expect(formatBytes(1024 * 1024 * 5)).toBe("5.0 MB");
    });
  });

  describe("Document Content Extraction", () => {
    it("extracts text content with metadata and line counts", async () => {
      const filePath = path.join(tempDir, "sample.md");
      const content = "# Test Document\n\nThis is a sample document for testing.\nLine 4";
      await fs.writeFile(filePath, content, "utf-8");

      const result = await extractDocumentContent(filePath, "sample.md", "documents");
      expect(result.isBinary).toBe(false);
      expect(result.content).toBe(content);
      expect(result.category).toBe("markdown");
      expect(result.metadata?.lineCount).toBe(4);
      expect(result.metadata?.sha256).toBeTruthy();
      expect(result.truncated).toBe(false);
    });

    it("handles binary files safely without dumping raw binary into content", async () => {
      const filePath = path.join(tempDir, "test.png");
      // Create a minimal 24-byte PNG-like buffer with dimensions 640x480
      const pngBuffer = Buffer.alloc(32);
      pngBuffer.write("\x89PNG\r\n\x1a\n", 0, 8, "binary");
      pngBuffer.writeUInt32BE(640, 16); // width
      pngBuffer.writeUInt32BE(480, 20); // height
      await fs.writeFile(filePath, pngBuffer);

      const result = await extractDocumentContent(filePath, "test.png", "documents");
      expect(result.isBinary).toBe(true);
      expect(result.content).toBeUndefined();
      expect(result.category).toBe("image");
      expect(result.mimeType).toBe("image/png");
      expect(result.metadata?.sha256).toBeTruthy();
      expect(result.metadata?.sizeBytes).toBe(32);
      expect(result.metadata?.dimensions).toEqual({ width: 640, height: 480 });
    });

    it("rejects extracting content from a directory", async () => {
      const dirPath = path.join(tempDir, "subfolder");
      await fs.mkdir(dirPath);

      await expect(extractDocumentContent(dirPath, "subfolder", "documents")).rejects.toThrow(
        "is a directory"
      );
    });
  });

  describe("Directory Listing", () => {
    it("lists files and subdirectories, skipping hidden files", async () => {
      await fs.writeFile(path.join(tempDir, "fileA.txt"), "hello");
      await fs.writeFile(path.join(tempDir, "fileB.json"), "{}");
      await fs.writeFile(path.join(tempDir, ".hidden.txt"), "secret");
      await fs.mkdir(path.join(tempDir, "subfolder"));
      await fs.writeFile(path.join(tempDir, "subfolder", "nested.md"), "nested");

      const flat = await listDirectoryContents(tempDir, ".", "documents", false, 50);
      expect(flat.some((e) => e.name === "fileA.txt" && !e.isDirectory)).toBe(true);
      expect(flat.some((e) => e.name === "fileB.json" && !e.isDirectory)).toBe(true);
      expect(flat.some((e) => e.name === "subfolder" && e.isDirectory)).toBe(true);
      expect(flat.some((e) => e.name === ".hidden.txt")).toBe(false);
      expect(flat.some((e) => e.name === "nested.md")).toBe(false);

      const recursive = await listDirectoryContents(tempDir, ".", "documents", true, 50);
      expect(recursive.some((e) => e.name === "nested.md")).toBe(true);
    });
  });
});
