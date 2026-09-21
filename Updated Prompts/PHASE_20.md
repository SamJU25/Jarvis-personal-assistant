# PHASE 20 — REMOTE CHANNELS (TELEGRAM FIRST)

Use `MASTER_RULES.md`.

## Objective

Let the same JARVIS/Hermes assistant be reachable remotely without creating another agent runtime.

Preferred first channel: Telegram.

WhatsApp is optional after Telegram is stable and only through a supported, authenticated integration.

## Architecture

```text
Telegram / WhatsApp
        ↓
channel adapter
        ↓
JARVIS session mapping
        ↓
Hermes run
        ↓
normal capability/policy/verification
```

## Requirements

- channel authentication
- per-user/session mapping
- message ordering
- rate limits
- delivery status
- cancellation where supported
- same Obsidian memory
- same skill system
- same confirmation/verification rules
- no secret leakage

A message from Telegram should not create a second “Telegram brain.”

## Continuity

Where appropriate, the remote channel should preserve the user’s assistant session identity and retrieve durable information from Obsidian.

Use safe channel-specific correlation IDs.

## Acceptance

Live-verify Telegram first:

1. inbound text
2. same Hermes/JARVIS runtime as web
3. Obsidian memory retrieval
4. skill usage
5. reminder delivery
6. outbound confirmation when required
7. safe cancellation/error
8. reconnect/session continuity

Only then consider WhatsApp.

STOP.
