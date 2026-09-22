import fs from "node:fs/promises";
import type { Dirent } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type {
  DocumentCategory,
  DocumentContentResult,
  DocumentEntry,
} from "@/lib/contracts/document";
import {
  MAX_DOCUMENT_READ_BYTES,
  MAX_DOCUMENT_CONTENT_CHARS,
  MAX_DOCUMENT_LIST_ENTRIES,
} from "./config";

interface ExtMapping {
  category: DocumentCategory;
  mimeType: string;
  isBinary: boolean;
}

const EXTENSION_MAP: Record<string, ExtMapping> = {
  // Markdown & Text
  ".md": { category: "markdown", mimeType: "text/markdown", isBinary: false },
  ".markdown": { category: "markdown", mimeType: "text/markdown", isBinary: false },
  ".txt": { category: "text", mimeType: "text/plain", isBinary: false },
  ".text": { category: "text", mimeType: "text/plain", isBinary: false },
  ".log": { category: "text", mimeType: "text/plain", isBinary: false },
  ".env": { category: "text", mimeType: "text/plain", isBinary: false },

  // Code
  ".ts": { category: "code", mimeType: "application/typescript", isBinary: false },
  ".tsx": { category: "code", mimeType: "application/typescript", isBinary: false },
  ".js": { category: "code", mimeType: "application/javascript", isBinary: false },
  ".jsx": { category: "code", mimeType: "application/javascript", isBinary: false },
  ".mjs": { category: "code", mimeType: "application/javascript", isBinary: false },
  ".cjs": { category: "code", mimeType: "application/javascript", isBinary: false },
  ".py": { category: "code", mimeType: "text/x-python", isBinary: false },
  ".sh": { category: "code", mimeType: "application/x-sh", isBinary: false },
  ".bash": { category: "code", mimeType: "application/x-sh", isBinary: false },
  ".ps1": { category: "code", mimeType: "application/x-powershell", isBinary: false },
  ".html": { category: "code", mimeType: "text/html", isBinary: false },
  ".htm": { category: "code", mimeType: "text/html", isBinary: false },
  ".css": { category: "code", mimeType: "text/css", isBinary: false },
  ".scss": { category: "code", mimeType: "text/x-scss", isBinary: false },

  // Data & Structured
  ".json": { category: "data", mimeType: "application/json", isBinary: false },
  ".csv": { category: "data", mimeType: "text/csv", isBinary: false },
  ".tsv": { category: "data", mimeType: "text/tab-separated-values", isBinary: false },
  ".yaml": { category: "data", mimeType: "application/x-yaml", isBinary: false },
  ".yml": { category: "data", mimeType: "application/x-yaml", isBinary: false },
  ".xml": { category: "data", mimeType: "application/xml", isBinary: false },
  ".sql": { category: "data", mimeType: "application/sql", isBinary: false },

  // Documents
  ".pdf": { category: "document", mimeType: "application/pdf", isBinary: true },
  ".docx": { category: "document", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", isBinary: true },
  ".doc": { category: "document", mimeType: "application/msword", isBinary: true },
  ".xlsx": { category: "document", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", isBinary: true },
  ".xls": { category: "document", mimeType: "application/vnd.ms-excel", isBinary: true },
  ".pptx": { category: "document", mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation", isBinary: true },

  // Images
  ".png": { category: "image", mimeType: "image/png", isBinary: true },
  ".jpg": { category: "image", mimeType: "image/jpeg", isBinary: true },
  ".jpeg": { category: "image", mimeType: "image/jpeg", isBinary: true },
  ".webp": { category: "image", mimeType: "image/webp", isBinary: true },
  ".gif": { category: "image", mimeType: "image/gif", isBinary: true },
  ".svg": { category: "image", mimeType: "image/svg+xml", isBinary: false },
  ".ico": { category: "image", mimeType: "image/x-icon", isBinary: true },

  // Audio
  ".mp3": { category: "audio", mimeType: "audio/mpeg", isBinary: true },
  ".wav": { category: "audio", mimeType: "audio/wav", isBinary: true },
  ".ogg": { category: "audio", mimeType: "audio/ogg", isBinary: true },
  ".m4a": { category: "audio", mimeType: "audio/mp4", isBinary: true },

  // Video
  ".mp4": { category: "video", mimeType: "video/mp4", isBinary: true },
  ".webm": { category: "video", mimeType: "video/webm", isBinary: true },
  ".mov": { category: "video", mimeType: "video/quicktime", isBinary: true },

  // Archives
  ".zip": { category: "archive", mimeType: "application/zip", isBinary: true },
  ".tar": { category: "archive", mimeType: "application/x-tar", isBinary: true },
  ".gz": { category: "archive", mimeType: "application/gzip", isBinary: true },
};

/**
 * Classifies a file extension into Category, MIME type, and binary flag.
 */
export function classifyFile(filePath: string): ExtMapping {
  const ext = path.extname(filePath).toLowerCase();
  return EXTENSION_MAP[ext] || {
    category: "binary",
    mimeType: "application/octet-stream",
    isBinary: true,
  };
}

/**
 * Sanitizes external text by stripping ANSI escape sequences and non-printable control characters
 * while preserving standard whitespace (\n, \r, \t).
 */
export function sanitizeDocumentText(text: string): string {
  // Strip ANSI escapes
  const strippedAnsi = text.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, "");
  // Replace non-printable ASCII control chars (except \t = 0x09, \n = 0x0A, \r = 0x0D)
  return strippedAnsi.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
}

/**
 * Formats byte size into human readable string.
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const size = bytes / Math.pow(1024, i);
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/**
 * Safely extracts image dimensions from common image headers using Buffer operations.
 */
function tryExtractImageDimensions(buffer: Buffer, ext: string): { width?: number; height?: number } | undefined {
  try {
    if (ext === ".png" && buffer.length >= 24) {
      // PNG header: bytes 16-23 are Width (4 bytes) and Height (4 bytes) big-endian
      const width = buffer.readUInt32BE(16);
      const height = buffer.readUInt32BE(20);
      return { width, height };
    }
    if (ext === ".gif" && buffer.length >= 10) {
      // GIF header: bytes 6-9 are Width (2 bytes) and Height (2 bytes) little-endian
      const width = buffer.readUInt16LE(6);
      const height = buffer.readUInt16LE(8);
      return { width, height };
    }
    if (ext === ".webp" && buffer.length >= 30) {
      // VP8 / VP8L / VP8X basic check
      if (buffer.slice(12, 16).toString("ascii") === "VP8X" && buffer.length >= 30) {
        const width = 1 + (buffer.readUInt32LE(24) & 0xffffff);
        const height = 1 + ((buffer.readUInt32LE(26) >> 8) & 0xffffff);
        return { width, height };
      }
    }
  } catch {
    // Return undefined on malformed header
  }
  return undefined;
}

/**
 * Reads a document safely and returns structured output.
 * For text/code documents: returns sanitized UTF-8 text bounded to limits.
 * For binary/media documents: returns structured metadata without dumping raw bytes.
 */
export async function extractDocumentContent(
  absolutePath: string,
  relativePath: string,
  rootId: string,
  options?: { maxBytes?: number }
): Promise<DocumentContentResult> {
  const stat = await fs.stat(absolutePath);
  if (stat.isDirectory()) {
    throw new Error(`Path "${relativePath}" is a directory, not a document.`);
  }

  const name = path.basename(absolutePath);
  const classification = classifyFile(absolutePath);
  const maxBytes = Math.min(options?.maxBytes ?? MAX_DOCUMENT_READ_BYTES, MAX_DOCUMENT_READ_BYTES);

  // Binary or media file: do NOT dump raw bytes into LLM context
  if (classification.isBinary) {
    const fileHandle = await fs.open(absolutePath, "r");
    const sampleBuffer = Buffer.alloc(Math.min(stat.size, 4096));
    let sha256 = "";
    try {
      await fileHandle.read(sampleBuffer, 0, sampleBuffer.length, 0);
      // Compute full file sha256 via stream
      const fileData = await fs.readFile(absolutePath);
      sha256 = crypto.createHash("sha256").update(fileData).digest("hex");
    } finally {
      await fileHandle.close();
    }

    const ext = path.extname(absolutePath).toLowerCase();
    const dimensions = tryExtractImageDimensions(sampleBuffer, ext);

    const metadata: Record<string, unknown> = {
      sha256,
      sizeBytes: stat.size,
      formattedSize: formatBytes(stat.size),
      mimeType: classification.mimeType,
      category: classification.category,
      modifiedAt: stat.mtime.toISOString(),
      ...(dimensions ? { dimensions } : {}),
      summary: `Binary file (${classification.mimeType}, ${formatBytes(stat.size)})`,
    };

    return {
      name,
      path: relativePath,
      rootId,
      sizeBytes: stat.size,
      mimeType: classification.mimeType,
      category: classification.category,
      isBinary: true,
      metadata,
    };
  }

  // Text / Code document: read, sanitize, and bound
  const readLength = Math.min(stat.size, maxBytes);
  const buffer = Buffer.alloc(readLength);
  const fileHandle = await fs.open(absolutePath, "r");
  try {
    await fileHandle.read(buffer, 0, readLength, 0);
  } finally {
    await fileHandle.close();
  }

  const rawText = buffer.toString("utf-8");
  const sanitized = sanitizeDocumentText(rawText);

  let content = sanitized;
  let truncated = stat.size > maxBytes;

  if (content.length > MAX_DOCUMENT_CONTENT_CHARS) {
    content = content.slice(0, MAX_DOCUMENT_CONTENT_CHARS);
    truncated = true;
  }

  const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
  const lineCount = content.split(/\r?\n/).length;

  return {
    name,
    path: relativePath,
    rootId,
    sizeBytes: stat.size,
    mimeType: classification.mimeType,
    category: classification.category,
    isBinary: false,
    content,
    truncated,
    metadata: {
      sha256,
      lineCount,
      modifiedAt: stat.mtime.toISOString(),
      formattedSize: formatBytes(stat.size),
    },
  };
}

/**
 * Lists documents and directories inside an allowed path.
 */
export async function listDirectoryContents(
  absoluteDir: string,
  relativeDir: string,
  rootId: string,
  recursive = false,
  limit = 50
): Promise<DocumentEntry[]> {
  const maxLimit = Math.min(limit, MAX_DOCUMENT_LIST_ENTRIES);
  const entries: DocumentEntry[] = [];

  async function scan(currentAbs: string, currentRel: string): Promise<void> {
    if (entries.length >= maxLimit) return;

    let dirEntries: Dirent[];
    try {
      dirEntries = (await fs.readdir(currentAbs, { withFileTypes: true })).sort((a, b) =>
        a.name.localeCompare(b.name)
      );
    } catch {
      return;
    }

    for (const ent of dirEntries) {
      if (entries.length >= maxLimit) break;

      // Skip hidden files/directories (starting with .)
      if (ent.name.startsWith(".")) continue;

      const itemAbs = path.join(currentAbs, ent.name);
      const itemRel = currentRel === "." || currentRel === "" ? ent.name : `${currentRel}/${ent.name}`;

      try {
        const stat = await fs.stat(itemAbs);
        if (ent.isDirectory()) {
          entries.push({
            name: ent.name,
            path: itemRel,
            rootId,
            sizeBytes: 0,
            mimeType: "inode/directory",
            category: "directory",
            modifiedAt: stat.mtime.toISOString(),
            isBinary: false,
            isDirectory: true,
          });

          if (recursive) {
            await scan(itemAbs, itemRel);
          }
        } else if (ent.isFile()) {
          const classification = classifyFile(ent.name);
          entries.push({
            name: ent.name,
            path: itemRel,
            rootId,
            sizeBytes: stat.size,
            mimeType: classification.mimeType,
            category: classification.category,
            modifiedAt: stat.mtime.toISOString(),
            isBinary: classification.isBinary,
            isDirectory: false,
          });
        }
      } catch {
        // Skip unreadable files
      }
    }
  }

  await scan(absoluteDir, relativeDir);
  return entries;
}
