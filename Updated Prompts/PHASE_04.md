# PHASE 4 — GOOGLE AI STUDIO / GEMINI THROUGH HERMES

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
Add Google AI Studio Gemini as a provider through Hermes. Do not hard-code Gemini into JARVIS.

## Inspect current Hermes Gemini provider
Verify current provider configuration and environment variable names from the checked-out Hermes version.
Current Hermes docs list Google/Gemini support and GOOGLE_API_KEY/GEMINI_API_KEY.

Reference:
https://github.com/NousResearch/hermes-agent/blob/main/website/docs/integrations/providers.md

## Implement

### User-selectable provider and model
Hermes currently supports authenticated provider/model selection at the API level. The current API documentation exposes `/api/model/options` for a richer authenticated model/provider picker and supports `provider`, `model`, and `model_options` on `/v1/runs`, `/v1/responses`, and other request paths.

JARVIS must NEVER hard-code a fixed Gemini model list.
Discover available/configured models from the running Hermes instance or the Hermes Dashboard.
When a user chooses a model/provider, pass the exact configured provider/model to Hermes or delegate configuration to Hermes as appropriate.
Never silently substitute a nearby model if the requested model is unavailable.

Configure Hermes for Gemini.

Keep Gemini API credentials:
- server-side
- outside browser bundles
- out of logs

JARVIS must remain provider-agnostic:
JARVIS → Hermes → configured provider/model

## Verify
- real Gemini request through Hermes
- model selection
- provider failure
- timeout
- diagnostics
- latency

Do not replace Ollama.
Do not implement Gemini Live here.

Run all quality gates.

STOP.
