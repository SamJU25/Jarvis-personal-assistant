# PHASE 7 — PERSISTENT MEMORY + SESSION INTELLIGENCE

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


Hermes memory reference:
https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/features/memory.md

## Goal
Make JARVIS more personalized through controlled durable memory.

Memory = stable facts/preferences.
Session history = past conversation detail.

## Policy
Use Hermes built-in memory first.
Enable current memory write approval:
memory.write_approval = true
(or current equivalent)

Do not store every interaction.

Good memory:
- response preferences
- stable project info
- recurring workflow preferences
- explicit "remember this"

Avoid:
- temporary calculations
- transient web results
- full transcripts
- unnecessary sensitive data

## Session identity
Inspect current Hermes session/session-key mechanisms and use them correctly.
Do not mix conversation identity with durable memory identity.

## Retrieval
Retrieve only relevant memory.
Keep context bounded.

## Verify
- approved memory creation
- rejected memory
- persistence after restart
- retrieval in new session
- irrelevant-memory exclusion
- session continuity
- memory error handling

Run all quality gates.

STOP.
