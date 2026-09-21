# PHASE 5 — GOOGLE WORKSPACE MIGRATION TO HERMES

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


Hermes:
https://github.com/NousResearch/hermes-agent.git

## Goal
Migrate Google Workspace capability toward Hermes only after real verification. Do not delete the existing JARVIS implementation first.

Hermes currently has a Google Workspace skill covering Gmail, Calendar, Drive, Docs, Sheets, and Contacts.

Reference:
https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/skills/google-workspace.md

## Audit current JARVIS Google
Inspect:
- Gmail
- Calendar
- Drive
- Docs
- OAuth/config
- GWS wrapper
- tests
- confirmation
- verification

Classify each:
KEEP / ADAPT / REPLACE / REMOVE LATER

## Configure Hermes Google Workspace
Use current Hermes-supported OAuth.
Keep all tokens/secrets server-side.

## Real read tests
- Gmail search/read
- Calendar
- Drive search/read
- Docs
- Sheets/Contacts where configured

## Write tests
Any Google write remains:
proposal → approval → execution → verification

Never allow Hermes Google writes to bypass JARVIS confirmation.

## Cleanup
Only remove old JARVIS Google code after the Hermes replacement is actually verified and unused code is identified by import/usage search.

Run all quality gates and real Google verification.

STOP.
