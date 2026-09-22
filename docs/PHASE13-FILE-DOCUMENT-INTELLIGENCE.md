# Phase 13 — File + Document Intelligence

> Status: **COMPLETE.** Governed document and file capabilities with explicit allowed root containment, format/size bounds, safe binary metadata handling, read/write classification, confirmation for side-effects, and deterministic on-disk verification. The workstation is never exposed.

## Summary

Implemented Phase 13 according to `Updated Prompts/PHASE_13.md` and `MASTER_RULES.md`:
- **Allowed roots containment**: Access is strictly governed to explicitly allowed directories:
  1. Configured Obsidian Vault (`OBSIDIAN_VAULT_PATH`)
  2. Dedicated documents directory (`JARVIS_DOCUMENTS_PATH`, default `<workspace>/documents`)
  3. Optional extra roots via `JARVIS_ALLOWED_FILE_ROOTS`.
- **Path normalization & containment**: `resolveAllowedPath` strictly blocks directory traversal (`..`), null bytes (`\0`), absolute path escapes outside roots, and symlink escapes.
- **Content extraction & binary/media handling**:
  - Text/markdown/code: UTF-8 decoding, control character sanitization, line counts, and 50,000 char bounding.
  - Binary/media (images, audio, video, PDFs): does NOT dump raw binary into LLM context; extracts structured metadata (MIME, size, sha256 checksum, image dimensions).
- **Read/Write classification**:
  - `list_documents` (`read`, `low` risk, `none` confirmation, `read_verification`).
  - `read_document` (`read`, `low` risk, `none` confirmation, `read_verification`).
  - `write_document` (`write`, `medium` risk, `explicit` confirmation, `document_verification`).
- **Human confirmation & deterministic verification**:
  - Write operations require explicit human confirmation (`buildConfirmationDetails` previews target path and content).
  - Post-write deterministic verification (`DocumentVerificationStrategy`) checks containment, physical file existence, non-empty size, and SHA-256 hash match on disk before reporting completion.

## Architecture impact

Additive and cleanly contained:
- `src/lib/contracts/document.ts` — Typed Zod contracts for queries, outputs, and allowed roots.
- `src/lib/documents/` — Configuration, containment resolver, content extractor, and tools.
- `src/lib/verification/strategies/document-verification.ts` — Deterministic 5-check verification.
- Tool registry expanded cleanly from 18 to 21 tools (`demo-tools.ts`).
- Verification registry updated to alias `write_document` to `document_verification`.
- Confirmation service and API route handle `write_document` with preview and semantic result cards.

## Files changed

- `src/lib/tools/demo-tools.ts` — Registered document tools in `createDefaultToolRegistry` (18 → 21 tools).
- `src/lib/verification/registry.ts` — Registered `document_verification` strategy and `write_document` alias.
- `src/lib/confirmation/service.ts` — Handled `write_document` in `buildConfirmationDetails`.
- `src/app/api/agent/confirm/route.ts` — Formatted `write_document` semantic cards and speech.
- `tests/tools/capability-registry.test.ts` — Updated assertions for 21 tools and document capabilities.
- `tests/tools/tool-registry.test.ts` — Updated assertion for 21 tools.
- `tests/agent/tool-loop.test.ts` — Updated assertion for 21 available tools.
- `AGENTS.md` — Updated milestone tracking.

## Files created

- `src/lib/contracts/document.ts`
- `src/lib/documents/config.ts`
- `src/lib/documents/path.ts`
- `src/lib/documents/extractor.ts`
- `src/lib/documents/tools.ts`
- `src/lib/verification/strategies/document-verification.ts`
- `tests/documents/path.test.ts`
- `tests/documents/extractor.test.ts`
- `tests/documents/tools.test.ts`
- `tests/documents/verification.test.ts`
- `scripts/verify-phase13-live.ts`
- `docs/PHASE13-FILE-DOCUMENT-INTELLIGENCE.md`

## Files removed

None.

## Automated checks

- `npm test`: PASSED — all test suites green.
- `npm run lint`: PASSED — 0 errors (3 pre-existing unused-var warnings in untouched files).
- `npm run typecheck`: PASSED — `tsc --noEmit` clean with 0 errors.
- `npm run build`: PASSED — Next.js Turbopack build compiled all static and dynamic routes.

## Live verification

- Environment: Windows, Node.js v22.14.0, local filesystem (`F:\Jarvis\documents` and `F:\Jarvis\Jarvis Memory`).
- Command: `npx tsx scripts/verify-phase13-live.ts`
- Results:
  - Allowed roots resolved: `documents` (`F:\Jarvis\documents`), `vault` (`F:\Jarvis\Jarvis Memory`).
  - Path traversal (`..`), null bytes (`\0`), and external absolute paths strictly rejected with `DocumentPathError`.
  - `list_documents` safely enumerated allowed directory.
  - `write_document` executed and generated valid confirmation details.
  - `read_document` verified text document content and SHA-256.
  - Binary file (`.png`) safely handled with structured metadata and dimensions without dumping raw bytes.
  - `DocumentVerificationStrategy` verified on-disk existence, containment, and SHA-256 hash.
  - Cleanup deleted test file, leaving roots pristine.

## Security verification

- Workstation files outside allowed roots cannot be accessed or enumerated.
- Path traversal attacks (`..`, symlink escapes, drive letters) fail closed.
- Text content containing sensitive credentials/secrets is rejected by `containsSecret`.
- Writes to read-only roots are rejected.
- Model output cannot authorize writes without explicit user confirmation.

## Known limitations

- Large text reads are bounded to 500 KB and 50,000 characters to protect LLM context windows.

## NOT VERIFIED

None. Live file operations and verification strategy executed and passed against real local filesystem directories.

## Exact next phase

`Updated Prompts/PHASE_14.md` — Voice Subsystem Hardening (Streaming TTS/STT, Interruption, and Voice Activity Detection).
