# PHASE 16 — NEW CONFIGURATION HUB / REMOVE OLD SETTINGS

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


Hermes source:
https://github.com/NousResearch/hermes-agent.git

## Goal
REMOVE the old JARVIS Settings page you currently have.

Do not merely rename it.
Do not keep the old read-only settings screen.

## New JARVIS Configuration hub

AGENT
- Providers & Models → Hermes
- Profiles → Hermes
- API Keys & Connections → Hermes

CAPABILITIES
- Skills → Hermes
- Tools & MCP → Hermes
- Web & Search → Hermes
- Memory → Hermes

JARVIS
- Voice → JARVIS
- Interface → JARVIS

SYSTEM
- Hermes Status
- Diagnostics
- Advanced

## Current Hermes dashboard and model configuration
The current Hermes dashboard is started with `hermes dashboard` and defaults to http://127.0.0.1:9119. Verify the actual configured port before linking.

Hermes also exposes authenticated model/provider discovery for a richer picker. JARVIS may display the current provider/model and a verified list of configured options, but the full provider/model configuration remains Hermes-owned. Do not hard-code a model list. If a quick-switch is implemented, pass the exact provider/model through the supported Hermes selection mechanism and never silently substitute an unavailable model.

## Ownership
Hermes owns:
- provider/model
- API connections
- profiles
- skills
- toolsets/MCP
- web configuration
- memory configuration
- Hermes agent configuration

JARVIS owns only its own UX:
- voice settings
- microphone preference
- animation/visual settings
- reduced motion
- local UI/diagnostic preferences

Do not duplicate Hermes editors.

## Navigation
The home gear becomes:
Configuration

It opens the JARVIS Configuration hub.
Hermes-owned sections provide "Open in Hermes" or another verified configuration route.
Do not iframe Hermes.
Do not invent deep links.

## Cleanup
Search usages before deleting:
- old /settings route
- settings shell
- settings-only components
- obsolete provider/model fields
- obsolete settings API routes

Do not delete shared runtime infrastructure.

## Verify
- old Settings is gone
- Configuration hub works
- Hermes configuration access works
- JARVIS-owned settings work
- no duplicate provider/model editor
- no secrets leak
- responsive layout works

Run all quality gates.

STOP.
