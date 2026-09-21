# PHASE 12 — MESSAGING TOOLS

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
Add controlled outbound messaging capabilities.

Mark-LIV currently advertises WhatsApp/Telegram messaging, but do not copy its code or bypass platform security.

Use official/authorized APIs or supported browser automation for the configured service.

## Tools
- search_contact
- draft_message
- send_message

Separate contact lookup from sending.

## Safety
Every outbound message is a write:
draft → preview → approval → send → verify

Never send based on model inference alone.

Protect:
- access tokens
- cookies
- private contact data

## Verification
Verify recipient, destination, message text, and delivery/send status where the platform provides trustworthy evidence.

If delivery cannot be confirmed, say so.

## Tests
Draft, confirmation, send, cancellation, failure, duplicate prevention, truthful delivery status.

Run all quality gates.

STOP.
