# PHASE 18 — BASIC APP + COMMUNICATION ACTIONS

Use `MASTER_RULES.md`.

## Objective

Make JARVIS useful for ordinary desktop/app tasks without building a giant computer-use framework.

## Target commands

- “Open Chrome.”
- “Open Spotify.” when supported by the OS/app environment.
- “Email Alex: ...”
- “Send Alex this Telegram message: ...”
- “Send Alex this WhatsApp message: ...” when supported.
- “Call Alex.” when the environment can actually initiate a call.
- “Open the dialer for Alex.” as an honest fallback when only dialing UI can be opened.
- “Block Alex.” when the connected platform supports it.
- “Unblock Alex.” when supported.

## Capability selection

Use this order:

1. Hermes-native capability if available and appropriate.
2. Existing JARVIS integration/capability.
3. Small OS/app adapter only if necessary.

Do not create a universal desktop automation engine for these commands.

## Contacts

Resolve a target to a concrete account/contact before consequential execution.

If multiple matches exist, ask the user to choose.

Never guess a recipient for a message/call/block action.

## Confirmation

Require confirmation according to current policy before:

- sending email
- sending Telegram/WhatsApp messages
- starting calls
- blocking/unblocking contacts
- other consequential changes

Show a compact confirmation summary:

Action: Send Telegram message
To: Alex
Message: ...

[Confirm] [Cancel]

## Verification

Verify the actual outcome when deterministic evidence exists.

Examples:

- provider accepted email
- message send result returned
- call initiation accepted
- block state confirmed

If the environment only opened a compose or dialer UI, report exactly that.

## Intent integration

Register natural aliases in the canonical Intent/Alias Registry, for example:

- “open Chrome” → open_app
- “email Alex …” → send_email
- “message Alex on Telegram …” → send_message_telegram
- “message Alex on WhatsApp …” → send_message_whatsapp
- “call Alex” → start_call
- “block Alex” → block_contact

Do not trigger these actions on isolated words such as “email”, “call”, “block”, or “message”.

## Telegram / WhatsApp

Inspect the installed Hermes version before implementing adapters.

Do not assume a JARVIS inbound channel grants permission to send arbitrary outbound messages to third parties.

Use authenticated, explicit outbound capability only.

## Acceptance

Live-verify only the actions actually supported by the current environment:

1. open a supported app
2. open a URL
3. send an email
4. send a Telegram message
5. send a WhatsApp message if supported
6. call/dial path if supported
7. block/unblock if supported
8. ambiguous target handling
9. confirmation rejection
10. cancellation
11. verification failure

STOP.
