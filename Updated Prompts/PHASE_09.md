# PHASE 9 — FILE + DOCUMENT INTELLIGENCE

GLOBAL RULES
- Work on the existing JARVIS repository. Do not rebuild it.
- Implement ONLY the numbered phase in this file. Do not continue into later phases.
- Before coding, inspect the current repository and actual Hermes checkout.
- Read JARVIS_MASTER_PROMPT.md, AGENTS.md, README.md, docs/ARCHITECTURE.md, docs/ROADMAP.md, docs/SECURITY.md, and relevant source/tests.
- Actual source code is authoritative when docs are stale.
- Do not invent Hermes APIs. Use the checked-out Hermes version and its current docs.
- Preserve working Phase 9–12 confirmation, verification, diagnostics, voice, memory, and tool boundaries unless the phase explicitly changes them.
- Never put API keys, OAuth tokens, refresh tokens, or secrets in browser/client code.
- Never claim success without actual evidence.
- Run relevant tests, lint, typecheck, build, and real runtime/browser verification.
- Report NOT VERIFIED where a dependency/device/credential prevents real verification.
- When this phase is verified, STOP. Do not implement the next phase.


Mark-LIV reference only:
https://github.com/FatihMakes/Mark-LIV.git

## Goal
Add safe local document/file capabilities in the existing JARVIS ToolRegistry.

Do not copy Mark-LIV source. Mark-LIV is CC BY-NC 4.0.

## Initial formats
- DOCX
- PPTX
- XLSX
- PDF
- TXT
- Markdown

Use explicit typed tools such as:
- read_docx / edit_docx / create_docx
- read_pptx / edit_pptx / create_pptx
- read_xlsx / edit_xlsx
- read_pdf
- inspect_file

## Security
- allowlisted roots
- path normalization/containment
- traversal protection
- size/type limits
- sanitized errors
- no arbitrary shell/Python command execution

## Writes
Every file/document write:
proposal → confirmation → execution → verification

Verify:
- output exists
- output opens/parses
- intended change is present

## Verify
Real DOCX/PPTX/XLSX/PDF operations plus invalid path, traversal, size, cancellation, confirmation, and post-write verification.

Run all quality gates.

STOP.
