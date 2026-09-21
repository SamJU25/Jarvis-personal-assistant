# PHASE 04 — HERMES CORE + OBSIDIAN + REAL-TIME EVENT/UI FOUNDATION

Use `MASTER_RULES.md` and `UI_GUIDE.md`.

## Objective

Turn Hermes into the actual JARVIS agent core and make the existing UI consume real live run events instead of simulating an assistant around a provider call.

Obsidian becomes the canonical durable-memory and skill source.

## Inspect first

Audit the actual local checkout and installed Hermes version:

- `src/lib/agent/`
- `src/lib/hermes/`
- `src/lib/contracts/`
- `src/lib/tools/`
- `src/lib/confirmation/`
- `src/lib/verification/`
- `src/lib/skills/`
- `src/lib/memory/`
- `src/lib/obsidian/`
- agent API routes
- existing reducer/state
- current settings UI
- debug UI
- voice client/streaming code

Verify the actual Hermes API for:
- Runs
- sessions
- SSE/events
- approvals
- stop/cancel
- skill discovery
- external skill directories

## Core refactor

Replace the current provider-centric path with:

`JARVIS → Hermes Run → Hermes owns the loop → JARVIS governed capabilities → Hermes continues → terminal state`

Do not keep a parallel TypeScript reasoning loop.

Remove the old one-tool/Turn-2 limitation from the active architecture.

## Stable sessions

Map a JARVIS conversation to one Hermes session.

Do not derive Hermes session IDs from individual request IDs.

## Real-time event foundation

Normalize Hermes lifecycle/events into the existing JARVIS event contract and reducer.

Build the server-side EventBus/dispatcher needed so one event can feed:
- main UI
- activity timeline
- settings status
- diagnostics
- trace hooks
- voice status

Do not expose hidden chain-of-thought.

## UI changes in this phase

Keep the existing visual shell.

Add the minimum functional live-state plumbing needed for:

- current run status
- current skill/tool activity
- streamed assistant text
- cancellation
- confirmation state
- live activity timeline
- real backend health snapshot

The existing Settings page may still be incomplete; do not build the full control center yet. Phase 5 will implement the Hermes/FreeLLMAPI settings surface and later phases extend it.

However, the data contracts created here must support the final `UI_GUIDE.md` design.

## Obsidian

Use `OBSIDIAN_VAULT_PATH`.

Canonical durable memory:
`AI/Memory/`

Canonical skill source:
`AI/Skills/`

Use the installed Hermes SKILL.md format.

Do not make Hermes or SQLite a second authoritative durable memory store.

## Safety

Keep the existing Tool Registry, confirmation and verification systems.

Do not enable unrestricted terminal, code execution, filesystem, browser, or computer-control tools.

Do not silently fall back to Ollama or Command Code.

## Acceptance

1. One JARVIS session maps to one Hermes session.
2. A single run can perform multiple tool steps.
3. Hermes events reach the JARVIS event stream.
4. The existing UI reducer updates from real events.
5. streamed text reaches the UI without duplication.
6. cancellation reaches the actual Hermes run.
7. Obsidian memory and skills are reachable through the intended boundary.
8. confirmation and verification remain authoritative.

## Live verification

Use the real Hermes server and real configured Obsidian vault.

Verify:
- new session
- continued session
- multi-step run
- live event stream
- streamed text
- cancellation
- Obsidian memory retrieval
- Obsidian skill discovery

Run tests, lint, typecheck, build, then live verification.

STOP.
