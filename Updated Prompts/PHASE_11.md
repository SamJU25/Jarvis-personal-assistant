# PHASE 11 — CONTROLLED WINDOWS COMPUTER CONTROL

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
Add safe Windows desktop control as explicit JARVIS tools.

Possible low/medium-risk tools:
- open_application
- list_windows
- focus_window
- press_shortcut
- type_text
- clipboard_get/set
- set_volume
- set_brightness
- get_system_status

Inspect existing Windows capabilities before choosing libraries.

## Prohibited architecture
Do not create:
- unrestricted PowerShell
- unrestricted cmd
- arbitrary pyautogui scripts
- model-controlled permission changes

Every action must be a typed tool with an explicit scope.

## Permission tiers
Read-only actions: normally no confirmation.
Medium-risk actions: configurable/confirm as appropriate.
High-risk/irreversible actions: explicit confirmation + verification.

## Verify
Real app launch, focus, shortcut, typing, safe system setting, invalid target, permission denial, cancellation, verification.

Run all quality gates.

STOP.
