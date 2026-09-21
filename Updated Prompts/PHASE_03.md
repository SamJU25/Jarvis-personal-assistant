# PHASE 3 — HERMES AS THE REAL AGENT BACKEND

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


Official Hermes:
https://github.com/NousResearch/hermes-agent.git

## Goal
Move normal JARVIS execution to:
JARVIS → HermesProvider → Hermes API → Hermes Agent → configured provider/model → JARVIS

Keep the existing provider as a temporary fallback.

## Implement

### Use the Hermes Runs API for agentic lifecycle control
For long-running JARVIS agent turns, prefer the current Hermes Runs API when it fits the required behavior:
- POST /v1/runs
- GET /v1/runs/{run_id}
- GET /v1/runs/{run_id}/events (SSE)
- POST /v1/runs/{run_id}/stop
- POST /v1/runs/{run_id}/approval

Use /v1/capabilities to discover which features the running Hermes instance supports.
Do not write a private Python integration against Hermes internals when the documented HTTP API provides the required capability.

For normal multi-turn context, prefer the current stateful Hermes mechanisms such as /v1/responses with previous_response_id/conversation, or the documented session/runs APIs. Do not treat /v1/chat/completions as stateful by itself; the current documentation describes that endpoint as stateless unless the relevant session mechanism is supplied.

Create HermesProvider using the existing AgentProvider abstraction.
Support, according to current Hermes API:
- real request/response
- streaming if available
- cancellation if available
- timeout
- errors
- session continuity
- run correlation

Track:
- jarvisRunId
- taskId
- Hermes run/session IDs when available

Map real events to:
queued, planning, executing, waiting_for_approval, verifying, completed, failed, cancelled

Never simulate these with timers.

## CRITICAL HERMES TOOL BOUNDARY

### Inspect and pin the API-server toolset
The current Hermes toolset reference says the built-in hermes-api-server platform drops interactive UI tools such as computer_use, but still includes powerful tools such as file, terminal, browser, web, memory, skills, and code execution.
Do not assume the default API-server toolset is safe for JARVIS.

Use Hermes' supported per-platform tool controls (including `hermes tools` and the platform/toolset configuration available in the checked-out version) to explicitly restrict the API-server toolset.
Then verify the effective configuration with authenticated GET /v1/toolsets.

For initial Phase 3, keep the enabled capability set minimal and read-oriented. Do not enable terminal, arbitrary code execution, or general file writes merely because Hermes supports them.

Current Hermes API-server deployments can expose powerful toolsets including terminal and file operations, web, memory, and skills.

Do not expose all of them to JARVIS automatically.

Inspect the current Hermes capability/toolset configuration.
Start with an explicit minimum allowlist.
Do not expose unrestricted:
- terminal
- filesystem writes
- arbitrary code execution
- permission-policy changes

The model must not be able to expand its own permissions.

Reference:
https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/features/api-server.md

## Confirmation + verification
Keep JARVIS ownership of:
proposal → waiting_for_approval → execution → verification → completed/failed/cancelled

Model text is never proof of success.

## Runtime tests
1. Hello JARVIS
2. follow-up request
3. real read task
4. cancellation
5. provider failure
6. confirmation-protected write
7. post-write verification

## Quality
Run all project quality gates and real runtime verification.

## Completion
Real Hermes-backed conversation works; safety boundary, diagnostics, session handling, confirmation, verification, and cancellation work.
STOP.
