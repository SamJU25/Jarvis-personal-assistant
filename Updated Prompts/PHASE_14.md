# PHASE 14 — SCREEN + WEBCAM VISION

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


References:
Mark-LIV: https://github.com/FatihMakes/Mark-LIV.git
Google Live tools: https://ai.google.dev/gemini-api/docs/live-api/tools

## Goal
Add opt-in visual awareness.

## Screen
- explicit Share Screen control
- capture current frame when user asks
- do not answer from stale cached frame
- stop/ended share must produce truthful "I can't see" state
- do not continuously upload screen frames unless a separate later opt-in monitoring feature is implemented

## Webcam
- explicit camera control
- default OFF
- no component may turn it on automatically

## Privacy
Prefer local processing when possible.
If a frame goes to Gemini, clearly indicate the active state and document that the frame leaves the machine.
Do not persist frames by default.

## Tool boundary
Vision can answer questions and propose actions, but actions still use JARVIS tools.

## Verify
Screen on/off, current-frame question, ended-share state, webcam on/off, no stale-frame use, secret/privacy check.

Run all quality gates.

STOP.
