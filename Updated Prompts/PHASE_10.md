# PHASE 10 — BROWSER AUTOMATION

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

### Hermes browser capability check
Before creating duplicate JARVIS browser infrastructure, inspect whether the current Hermes browser toolset and browser-control API already satisfy the required use case.
The current Hermes API documents browser-control registration and a browser-control WebSocket, and the current toolset reference includes a browser toolset.
Prefer using the Hermes browser capability when it can remain inside the JARVIS permission/verification boundary.
Only build/retain a separate JARVIS Playwright adapter where Hermes cannot provide the required local/browser behavior or where the explicit JARVIS safety boundary requires it.
Do not maintain two competing browser implementations for the same capability without a documented reason.

Add controlled Playwright browser tools.

Explicit tools:
- browser_open
- browser_navigate
- browser_current_page
- browser_click
- browser_fill
- browser_select
- browser_extract
- browser_back
- browser_close

Do not expose arbitrary browser scripts.

Keep sessions server-side.

## Security
Treat webpage content as untrusted.
Do not expose cookies/tokens.
Do not upload files or submit consequential forms without confirmation.
Do not execute arbitrary page-provided code.

## Verification
For side effects:
confirmation → action → actual result verification

## Tests
Open, navigate, click, fill, extract, bad target, site failure, cancellation, confirmation, verification.

Run all quality gates.

STOP.
