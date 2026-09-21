# PHASE 2 — HERMES FOUNDATION

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


Official Hermes repository:
https://github.com/NousResearch/hermes-agent.git

## Goal
Install and verify Hermes as a separate local backend. Do not make Hermes the primary JARVIS agent yet.

## Hermes checkout
Preferred layout:
parent/
  JARVIS/
  hermes-agent/

If ../hermes-agent already exists, verify it is NousResearch/hermes-agent and reuse it.
Otherwise:
git clone https://github.com/NousResearch/hermes-agent.git ../hermes-agent

Record the Hermes commit/version used.

## Inspect current Hermes

### Current API facts to verify against the checkout
The current official Hermes API-server documentation exposes:
- GET /health
- GET /health/detailed
- GET /v1/capabilities
- GET /v1/toolsets
- GET /v1/skills
- POST /v1/chat/completions
- POST /v1/responses
- POST /v1/runs
- GET /v1/runs/{run_id}
- GET /v1/runs/{run_id}/events
- POST /v1/runs/{run_id}/stop
- POST /v1/runs/{run_id}/approval

The current documented defaults are API_SERVER_PORT=8642 and API_SERVER_HOST=127.0.0.1, with API_SERVER_KEY required. Treat these as the current baseline, but still verify the installed checkout before hard-coding anything.

Determine from the actual checkout:
- install/start command
- current gateway command (`hermes gateway`)
- gateway/API command
- API URL/port
- dashboard URL/port
- API authentication/key behavior
- config location
- Windows requirements

Current Hermes docs describe an OpenAI-compatible API server; verify the actual installed version instead of assuming old values.

## JARVIS implementation
Create a server-side HermesClient for:
- health/status
- authenticated request
- response validation
- timeout
- connection failure
- malformed response

Do not call Hermes directly from React.
Do not expose Hermes credentials to the client.

Do not enable the full Hermes toolset yet.

## Preserve
Keep current:
- AgentProvider / AgentRuntime
- OllamaProvider
- Google and Obsidian integrations
- voice
- confirmation
- verification
- diagnostics
- tools

## Tests
Add automated tests for:
- health success/failure
- auth failure
- request success
- malformed response
- timeout
- unavailable Hermes

Perform one real local Hermes API check.

## Quality
Run:
npm run test
npm run lint
npm run typecheck
npm run build

## Completion
Hermes runs, JARVIS reaches it, tests/build pass, and the real API check passes.
STOP.
