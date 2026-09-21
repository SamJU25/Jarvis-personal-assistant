# PHASE 25 — FINAL PREFLIGHT / SECURITY / PERFORMANCE / REGRESSION

Use `MASTER_RULES.md` and `UI_GUIDE.md`.

## Objective

Create one authoritative real-system preflight.

## Core checks

- UI boot
- JARVIS server boot
- Hermes health
- stable Hermes session continuation
- multi-step Hermes run
- real Hermes event stream
- FreeLLMAPI gateway health
- automatic routing
- streaming
- tool calling
- Obsidian memory
- Obsidian skill loading
- plugin inventory
- specialist delegation
- Google capability
- web research
- browser/YouTube if enabled
- email/message/call/block capabilities if configured
- voice
- Space hold-to-talk
- time-to-first-audio
- scheduler/reminder delivery
- Telegram remote path
- confirmation
- verification
- idempotency
- cancellation
- SSE reconnect/reconciliation
- stale-run protection
- settings snapshot
- settings SSE
- settings write/apply/reverify
- no secret exposure
- no silent inference bypass
- no fake status values
- tests/lint/typecheck/build

## Performance gates

Measure real warmed runs.

Voice:
- release → final transcript
- transcript → first Hermes event
- transcript → first text delta
- transcript → first audio
- transcript → final response

Settings:
- page load → initial snapshot
- settings event → visible card update
- apply click → verified state

Agent:
- user input → first visible activity
- user input → first text delta
- tool request → tool start
- tool end → next Hermes event

Record P50/P95 where enough samples exist.

Do not pass a latency gate through fake UI timing.

## Production inference invariant

Prove:

`Browser → JARVIS → Hermes → FreeLLMAPI → upstream`

No direct browser/provider inference path.

## Real-life action checks

Where configured, execute at least:

- open Google
- search web
- open/search/play YouTube
- email send path
- Telegram message path
- reminder delivered to Telegram
- Obsidian memory write/read
- specialist delegation

Only test WhatsApp/calls/blocking when the environment exposes a supported integration.

## Security

Search logs and browser responses for credentials before declaring success.

Verify provider keys are never returned.

Verify settings write endpoints require appropriate local/authenticated access.

Verify dangerous tools remain disabled unless explicitly enabled and governed.

## Preflight output

Print:

`PASS: N`
`FAIL: N`
`WARN: N`

Exit non-zero on any critical failure.

Save a machine-readable report for later regression comparison.

Run the real preflight and fix critical failures before declaring production-ready.

STOP.
