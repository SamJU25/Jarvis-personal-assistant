# PHASE 24 — JARVIS CONTROL CENTER + LIVE SETTINGS

Use `MASTER_RULES.md` and `UI_GUIDE.md`.

## Objective

Complete the JARVIS website's Settings/Control Center so the user can configure and monitor the system from one place.

This phase is UI + server-control integration, not a visual rewrite.

## Build the sections

1. Overview
2. Hermes Core
3. Inference Gateway / FreeLLMAPI
4. Memory / Obsidian
5. Skills
6. Plugins
7. Voice
8. Channels
9. Capabilities
10. Security
11. Diagnostics

## Current source of truth

The UI must consume live backend state from the normalized settings snapshot/event stream created in prior phases.

Do not duplicate backend truth inside component-local constants.

## Hermes page

Functional controls must be connected to real Hermes configuration/capability operations supported by the installed version.

Show:
- connected/disconnected
- version
- active session readiness
- active run count
- capabilities
- skills
- delegation
- reload/restart status

Allow safe changes where supported.

## FreeLLMAPI page

Functional controls must use the real gateway integration created in Phase 5.

Show:
- gateway health
- routing strategy
- streaming/tool calling support
- model catalog count
- current routed model/provider when verified
- p50/p95/TTFT metrics if available
- fallback count if available
- provider credentials status

Allow:
- test connection
- refresh model catalog
- test streaming
- test tool calls
- change supported routing profile

No secret values displayed.

## Memory page

Show:
- Obsidian connected state
- memory count
- index state
- last index operation
- skill directory state

Actions:
- test
- reindex
- open memory

## Skills page

Show:
- discovered skills
- enabled state
- source
- errors
- last refresh

Actions:
- refresh
- validate
- enable/disable where supported
- open skill

## Plugins page

Use Phase 23 backend.

## Voice page

Show live:
- Whisper readiness
- Kokoro readiness
- microphone
- output device
- push-to-talk binding
- barge-in
- time-to-first-audio P50/P95

Actions must execute real tests.

## Channels page

Show:
- web
- Telegram
- WhatsApp
- email
- future supported channels

Each status must be runtime-derived.

## Capabilities page

Show the actual capability manifest.

Examples:
- web search
- browser
- YouTube
- files
- email
- Telegram
- WhatsApp
- calls
- computer control

Use `enabled`, `available`, `disabled`, `not configured`, or `unsupported` explicitly.

## Security page

Show policy without exposing secrets.

Examples:
- confirmation required for writes
- message confirmation
- call confirmation
- block confirmation
- allowed file roots
- dangerous tools disabled

## Diagnostics page

Show the real live event stream and correlated trace.

Allow filtering by:
- session
- run
- tool
- skill
- capability
- channel
- status

No hidden chain-of-thought.

## Realtime requirements

The whole Settings area must subscribe to one JARVIS SSE stream.

Events update only the affected cards.

When the SSE disconnects:
- show a `Live connection lost` banner
- retry with backoff
- fetch a fresh snapshot after reconnect
- reconcile without duplicate events

Do not fall back to independent 3-second browser polling.

## UX requirements

- Preserve the existing JARVIS visual language.
- Use compact status chips.
- Use human-readable labels.
- Put advanced fields behind expandable sections.
- Provide clear Apply/Test buttons.
- Disable controls while applying.
- Show actual server errors safely.
- Never show fake success.
- Keep the default Settings page understandable to a non-developer.

## Acceptance

1. Every visible status comes from live backend state.
2. Hermes connection test works.
3. FreeLLMAPI connection test works.
4. Memory test works.
5. Skills refresh works.
6. Plugin state reflects reality.
7. Voice tests work.
8. Channel status works for configured channels.
9. Capabilities match actual runtime state.
10. Settings changes are applied and re-verified.
11. SSE live updates work.
12. reconnect/reconciliation works.
13. no secrets appear in responses/logs.

## Scope stop

Do not add new major capabilities in this phase. Wire the control center to capabilities already implemented by the roadmap.

STOP.
