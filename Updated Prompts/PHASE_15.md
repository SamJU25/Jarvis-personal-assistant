# PHASE 15 — SCHEDULER + PROACTIVE ASSISTANT

Use `MASTER_RULES.md`.

## Objective

Add durable scheduled tasks that launch real Hermes runs under the same policy as interactive tasks.

The user should be able to say naturally:

- “Remind me tomorrow at 8 PM to finish my project.”
- “Remind me every weekday at 9 AM.”
- “Cancel that reminder.”
- “Move my reminder to 10.”

## Required

- persistent schedule
- timezone correctness
- run history
- cancellation/editing
- duplicate-run protection
- delivery/channel abstraction
- explicit channel target
- retry policy
- approval boundary

## Telegram

Telegram is the preferred first remote reminder channel if the installed Hermes version supports it.

A reminder should be able to deliver to the user’s authenticated Telegram chat/session without creating a second agent.

Do not assume a channel used to talk to JARVIS can automatically message arbitrary third parties.

## Context

Scheduled runs start in a fresh execution context when the platform behaves that way. Persist the minimum required context and retrieve durable knowledge from Obsidian rather than depending on an old conversation transcript being present.

## Safety

A scheduled task follows the same capability permissions, confirmation policy, verification rules, and idempotency rules as an interactive run.

Do not let background execution bypass user policy.

## Acceptance

Live-verify:

1. create one-time reminder
2. persist it
3. deliver through Telegram when configured
4. cancel it
5. edit/reschedule it
6. restart the server and confirm schedule persistence
7. prove no duplicate delivery
8. prove the run uses the normal Hermes/capability pipeline

STOP.
