import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

// Load .env.local (server-side only)
if (fs.existsSync(".env.local")) {
  const content = fs.readFileSync(".env.local", "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const idx = trimmed.indexOf("=");
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

import { getAllowedRoots, ensureDefaultDocumentsDir } from "../src/lib/documents/config";
import { resolveAllowedPath, DocumentPathError } from "../src/lib/documents/path";
import { listDocumentsTool, readDocumentTool, writeDocumentTool } from "../src/lib/documents/tools";
import { DocumentVerificationStrategy } from "../src/lib/verification/strategies/document-verification";
import { buildConfirmationDetails } from "../src/lib/confirmation/service";
import type { VerificationRequest } from "../src/lib/contracts/verification";
import type { ToolContext } from "../src/lib/contracts/tool";

const liveContext: ToolContext = {
  signal: new AbortController().signal,
  callId: "live-call-phase13",
};

async function main() {
  console.log("=== PHASE 13 LIVE VERIFICATION: FILE + DOCUMENT INTELLIGENCE ===");

  // ── 1. Allowed Roots Configuration ─────────────────────────────────────
  console.log("\n1. Resolving allowed roots...");
  await ensureDefaultDocumentsDir();
  const roots = getAllowedRoots();
  console.log(`Found ${roots.length} allowed root(s):`);
  for (const r of roots) {
    console.log(`  - [${r.id}] ${r.name}: ${r.path} (readOnly: ${r.readOnly})`);
  }
  if (roots.length === 0) throw new Error("No allowed roots configured!");

  // ── 2. Path Normalization & Containment Tests ─────────────────────────
  console.log("\n2. Testing path containment & traversal protection...");

  // Allowed relative resolution
  const resolvedDocs = await resolveAllowedPath("sample-test.txt");
  console.log(`  ✓ Relative path resolved to: [${resolvedDocs.rootId}] ${resolvedDocs.relativePath}`);

  // Traversal rejection
  let traversalBlocked = false;
  try {
    await resolveAllowedPath("../../Windows/System32/calc.exe");
  } catch (err) {
    if (err instanceof DocumentPathError) traversalBlocked = true;
  }
  if (!traversalBlocked) throw new Error("FAILED: Directory traversal was not blocked!");
  console.log("  ✓ Directory traversal ('..') strictly blocked");

  // Null byte rejection
  let nullByteBlocked = false;
  try {
    await resolveAllowedPath("safe\0evil.txt");
  } catch (err) {
    if (err instanceof DocumentPathError) nullByteBlocked = true;
  }
  if (!nullByteBlocked) throw new Error("FAILED: Null byte was not blocked!");
  console.log("  ✓ Null byte injection strictly blocked");

  // Unauthorized absolute path rejection
  let outsideBlocked = false;
  try {
    await resolveAllowedPath("C:\\Windows\\win.ini");
  } catch (err) {
    if (err instanceof DocumentPathError) outsideBlocked = true;
  }
  if (!outsideBlocked) throw new Error("FAILED: External absolute path was not blocked!");
  console.log("  ✓ External absolute path strictly blocked");

  // ── 3. Governed list_documents Tool ───────────────────────────────────
  console.log("\n3. Testing list_documents tool...");
  const listResult = await listDocumentsTool.execute({ path: ".", limit: 20, recursive: false }, liveContext);
  console.log(`  ✓ Listed ${listResult.total} entry/entries in [${listResult.rootId}]`);

  // ── 4. Governed write_document Tool & Confirmation Preview ───────────
  console.log("\n4. Testing write_document tool & confirmation preview...");
  const testFileName = "phase13-verification-live.md";
  const testContent = `# Phase 13 Live Verification Test
Generated: ${new Date().toISOString()}
Purpose: Deterministic verification of governed document write operations.`;

  // Check confirmation preview details
  const confDetails = buildConfirmationDetails("write_document", {
    path: testFileName,
    content: testContent,
  });
  if (confDetails.actionCategory !== "document" || confDetails.title !== "WRITE DOCUMENT") {
    throw new Error("FAILED: buildConfirmationDetails returned unexpected details for write_document");
  }
  console.log(`  ✓ Confirmation preview details valid: [${confDetails.actionCategory}] ${confDetails.title}`);

  // Execute write
  const writeResult = await writeDocumentTool.execute(
    {
      path: testFileName,
      content: testContent,
      rootId: "documents",
    },
    liveContext
  );
  console.log(`  ✓ Wrote document: ${writeResult.path} (${writeResult.sizeBytes} bytes, sha256: ${writeResult.sha256.slice(0, 12)}...)`);

  // ── 5. Governed read_document Tool (Text) ─────────────────────────────
  console.log("\n5. Testing read_document tool (text)...");
  const readResult = await readDocumentTool.execute(
    {
      path: testFileName,
      rootId: "documents",
    },
    liveContext
  );
  if (readResult.isBinary) throw new Error("FAILED: Text document marked as binary!");
  if (readResult.content !== testContent) throw new Error("FAILED: Read content does not match written content!");
  console.log(`  ✓ Read document verified: ${readResult.name} (${readResult.category}, ${readResult.sizeBytes} bytes)`);

  // ── 6. Governed read_document Tool (Binary / Media) ───────────────────
  console.log("\n6. Testing binary / media safe handling...");
  const binaryFileName = "test-media-sample.png";
  const docsRoot = roots.find((r) => r.id === "documents")!.path;
  const binaryFilePath = path.join(docsRoot, binaryFileName);

  // Write a synthetic PNG buffer with dimensions 320x240
  const pngHeader = Buffer.alloc(32);
  pngHeader.write("\x89PNG\r\n\x1a\n", 0, 8, "binary");
  pngHeader.writeUInt32BE(320, 16);
  pngHeader.writeUInt32BE(240, 20);
  await fsp.writeFile(binaryFilePath, pngHeader);

  try {
    const binReadResult = await readDocumentTool.execute(
      {
        path: binaryFileName,
        rootId: "documents",
      },
      liveContext
    );
    if (!binReadResult.isBinary) throw new Error("FAILED: Image file not identified as binary!");
    if (binReadResult.content !== undefined) throw new Error("FAILED: Raw binary content was dumped into content field!");
    console.log(`  ✓ Binary file safely handled: ${binReadResult.name} (MIME: ${binReadResult.mimeType}, size: ${binReadResult.sizeBytes} B)`);
    console.log(`    Metadata: ${JSON.stringify(binReadResult.metadata)}`);
  } finally {
    await fsp.unlink(binaryFilePath).catch(() => {});
  }

  // ── 7. Deterministic Document Verification Strategy ───────────────────
  console.log("\n7. Running DocumentVerificationStrategy...");
  const strategy = new DocumentVerificationStrategy();
  const verRequest: VerificationRequest = {
    runId: "live-run-phase13",
    taskId: "live-task-phase13",
    toolId: "write_document",
    parameters: { path: testFileName, content: testContent },
    timestamp: new Date().toISOString(),
    toolResult: {
      callId: "live-call-1",
      toolId: "write_document",
      status: "success",
      output: writeResult,
    },
  };

  const verResult = await strategy.verify(verRequest);
  if (verResult.status !== "passed") {
    throw new Error(`FAILED: Verification failed: ${verResult.reason}`);
  }
  console.log("  ✓ Verification Strategy PASSED with evidence:");
  for (const ev of verResult.evidence) {
    console.log(`    - [${ev.type}]: ${ev.description}`);
    if (ev.details) {
      console.log(`      details: ${JSON.stringify(ev.details)}`);
    }
  }

  // ── 8. Cleanup & Allowed Roots Pristine Guarantee ─────────────────────
  console.log("\n8. Cleaning up live test artifacts...");
  const targetPath = path.join(docsRoot, testFileName);
  await fsp.unlink(targetPath);
  console.log(`  ✓ Removed ${testFileName} (allowed roots left pristine)`);

  console.log("\n=======================================================");
  console.log("✓ ALL PHASE 13 LIVE CHECKS PASSED DETERMINISTICALLY");
  console.log("=======================================================");
}

main().catch((err) => {
  console.error("\n❌ Live Verification FAILED:", err);
  process.exit(1);
});
