import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import type { JarvisTool } from "@/lib/contracts/tool";
import { ToolRegistry } from "@/lib/tools/registry";
import {
  listDocumentsInputSchema,
  listDocumentsOutputSchema,
  readDocumentInputSchema,
  readDocumentOutputSchema,
  writeDocumentInputSchema,
  writeDocumentOutputSchema,
  type ListDocumentsInput,
  type ListDocumentsOutput,
  type ReadDocumentInput,
  type ReadDocumentOutput,
  type WriteDocumentInput,
  type WriteDocumentOutput,
} from "@/lib/contracts/document";
import { resolveAllowedPath } from "./path";
import { extractDocumentContent, listDirectoryContents } from "./extractor";
import { MAX_DOCUMENT_WRITE_BYTES } from "./config";
import { containsSecret } from "@/lib/memory/secrets";

export const listDocumentsTool: JarvisTool<ListDocumentsInput, ListDocumentsOutput> = {
  id: "list_documents",
  name: "List Documents",
  description:
    "Lists files and directories inside an explicitly allowed document directory. Use when the user asks to see what files, notes, or documents exist.",
  inputSchema: listDocumentsInputSchema,
  outputSchema: listDocumentsOutputSchema,
  permission: "read",
  riskLevel: "low",
  capabilityClass: "read",
  confirmationPolicy: "none",
  verificationStrategy: "read_verification",
  reversible: true,
  timeoutMs: 5000,
  idempotent: true,
  renderer: "document",
  source: "filesystem",
  async execute(rawInput) {
    const input = listDocumentsInputSchema.parse(rawInput);
    const resolved = await resolveAllowedPath(input.path || ".", input.rootId);
    const stat = await fs.stat(resolved.absolutePath).catch(() => null);

    if (!stat) {
      throw new Error(`Directory not found: "${resolved.relativePath}"`);
    }

    if (!stat.isDirectory()) {
      throw new Error(`Target "${resolved.relativePath}" is a file, not a directory.`);
    }

    const entries = await listDirectoryContents(
      resolved.absolutePath,
      resolved.relativePath,
      resolved.rootId,
      input.recursive,
      input.limit
    );

    return {
      rootId: resolved.rootId,
      path: resolved.relativePath,
      total: entries.length,
      entries,
    };
  },
};

export const readDocumentTool: JarvisTool<ReadDocumentInput, ReadDocumentOutput> = {
  id: "read_document",
  name: "Read Document",
  description:
    "Reads content from a text or markdown file, or extracts structured metadata from binary/media documents inside allowed directories.",
  inputSchema: readDocumentInputSchema,
  outputSchema: readDocumentOutputSchema,
  permission: "read",
  riskLevel: "low",
  capabilityClass: "read",
  confirmationPolicy: "none",
  verificationStrategy: "read_verification",
  reversible: true,
  timeoutMs: 5000,
  idempotent: true,
  renderer: "document",
  source: "filesystem",
  async execute(rawInput) {
    const input = readDocumentInputSchema.parse(rawInput);
    const resolved = await resolveAllowedPath(input.path, input.rootId);
    const stat = await fs.stat(resolved.absolutePath).catch(() => null);

    if (!stat) {
      throw new Error(`Document not found: "${resolved.relativePath}"`);
    }

    if (stat.isDirectory()) {
      throw new Error(`"${resolved.relativePath}" is a directory. Use list_documents instead.`);
    }

    return await extractDocumentContent(
      resolved.absolutePath,
      resolved.relativePath,
      resolved.rootId,
      { maxBytes: input.maxBytes }
    );
  },
};

export const writeDocumentTool: JarvisTool<WriteDocumentInput, WriteDocumentOutput> = {
  id: "write_document",
  name: "Write Document",
  description:
    "Creates or updates a document in an allowed directory with given text content. Requires explicit human confirmation before executing.",
  inputSchema: writeDocumentInputSchema,
  outputSchema: writeDocumentOutputSchema,
  permission: "write",
  riskLevel: "medium",
  capabilityClass: "write",
  confirmationPolicy: "explicit",
  verificationStrategy: "document_verification",
  reversible: true,
  timeoutMs: 10000,
  idempotent: false,
  renderer: "document",
  source: "filesystem",
  async execute(rawInput) {
    const input = writeDocumentInputSchema.parse(rawInput);
    const contentBytes = Buffer.byteLength(input.content, "utf-8");
    if (contentBytes > MAX_DOCUMENT_WRITE_BYTES) {
      throw new Error(
        `Document content exceeds maximum allowed write size (${MAX_DOCUMENT_WRITE_BYTES} bytes).`
      );
    }

    // Secret rejection check
    const secretCheck = containsSecret(input.content);
    if (secretCheck.hasSecret) {
      throw new Error(
        `Cannot write document: Content contains sensitive credentials (${secretCheck.reason || "secret pattern detected"}).`
      );
    }

    const resolved = await resolveAllowedPath(input.path, input.rootId);

    if (resolved.root.readOnly) {
      throw new Error(`Allowed root "${resolved.root.name}" is read-only. Writes are rejected.`);
    }

    // Ensure parent directory exists
    const parentDir = path.dirname(resolved.absolutePath);
    await fs.mkdir(parentDir, { recursive: true });

    // Write file content
    await fs.writeFile(resolved.absolutePath, input.content, "utf-8");

    const sha256 = crypto
      .createHash("sha256")
      .update(Buffer.from(input.content, "utf-8"))
      .digest("hex");

    return {
      path: resolved.relativePath,
      rootId: resolved.rootId,
      sizeBytes: contentBytes,
      sha256,
      writtenAt: new Date().toISOString(),
    };
  },
};

/**
 * Registers all Document Intelligence tools into the ToolRegistry.
 */
export function registerDocumentTools(registry: ToolRegistry): void {
  registry.register(listDocumentsTool);
  registry.register(readDocumentTool);
  registry.register(writeDocumentTool);
}
