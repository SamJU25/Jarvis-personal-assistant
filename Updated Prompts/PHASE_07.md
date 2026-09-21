# PHASE 07 — INTENT + ALIAS REGISTRY

Use `MASTER_RULES.md`.

## Objective

Add a reusable intent/alias layer inspired by natural command phrases used by assistants such as Mark-LIV, without turning JARVIS into a brittle keyword-matching bot.

The target routing is:

`user text/voice → normalization → deterministic intent/alias check → Hermes semantic tool/skill routing`

The alias layer is an accelerator and safety layer, not a second agent.

## Inspect first

Audit the current:

- `AgentRuntime`
- command/fast-path logic
- skill selector
- tool registry
- event contracts
- voice transcript flow
- Telegram/messaging ingress if already present
- cancellation/confirmation handlers
- any existing keyword/regex matching

Remove or consolidate duplicated hardcoded phrase checks where the new registry can safely replace them.

## Intent registry

Create one canonical registry. Each intent should define, as appropriate:

- stable intent ID
- aliases / phrases
- normalized matching rules
- channel applicability
- priority
- safety level
- confirmation requirement
- handler/capability target
- whether exact deterministic matching is allowed
- examples / non-examples

Keep the registry independent of UI and voice.

Example intent IDs may include:

- `cancel_run`
- `stop_response`
- `undo_action`
- `memory_save`
- `memory_recall`
- `reminder_create`
- `reminder_cancel`
- `focus_start`
- `focus_stop`
- `lock_target`

Do not add intents that do not have a real handler/capability.

## Matching rules

Use layered matching:

1. Normalize text.
2. Check only high-confidence deterministic aliases for safety-critical commands.
3. Use canonical aliases as hints for normal intents.
4. Fall through to Hermes when no deterministic match is sufficiently confident.

Do NOT require the user to use the exact registered phrase.

Do NOT create a giant `if/else` or regex chain.

Do NOT route every mention of words like `remember`, `stop`, `delete`, or `remind` automatically.

Examples:

- `stop`, `cancel this`, `abort that` → `cancel_run` when a cancellable run exists.
- `remember this`, `save this`, `don't forget this` → memory-save intent candidate; the model decides the content/meaning unless a safe deterministic capture rule already exists.
- `remind me tomorrow at 8` → reminder-create candidate.
- `undo that`, `revert that`, `take it back` → undo candidate only when a reversible action exists.

Ambiguous natural language must fall through to Hermes rather than being forcibly matched.

## Safety

Safety-critical aliases must never bypass authorization.

For example:

`delete that`, `send it`, `approve`, `yes`, and similar phrases must NOT independently authorize a side effect unless they are interpreted inside an active, correctly correlated confirmation context.

Model output is never authorization.

Alias matching is never authorization.

## Eventing

Emit safe events when an intent is recognized, for example:

- `intent_detected`
- `intent_routed`
- `intent_fallback`

Include intent ID and confidence/route metadata where safe.

Do not store sensitive raw user text in telemetry merely to debug alias matching.

## UI / diagnostics

The debug UI should be able to show:

`Input → intent candidate → route → handler`

Example:

`"remind me at 8" → reminder_create → scheduler`

and:

`"I remember that movie" → no deterministic match → Hermes`

Do not display internal matching heuristics as if they were model reasoning.

## Tests

Add table-driven tests for:

- direct alias
- natural alias
- punctuation/case normalization
- extra filler words
- ambiguous phrase
- false positive
- inactive capability
- missing active run
- missing reversible action
- confirmation context
- voice transcript input

Include negative tests so ordinary conversation does not trigger actions unexpectedly.

At minimum verify examples such as:

`stop`
`cancel that`
`undo that`
`remember this`
`don't forget this`
`remind me tomorrow`
`set a reminder`
`what do you remember about X`
`I don't want you to do that`
`I'm talking about the word remember, not asking you to save anything`

## Live verification

Verify through the actual JARVIS input path, not only unit tests:

1. Type an alias.
2. Speak an alias if voice is available.
3. Verify deterministic commands reach the correct handler.
4. Verify ordinary sentences with matching words do not trigger the wrong intent.
5. Verify unmatched requests reach Hermes.
6. Verify confirmation and cancellation remain intact.

## Scope stop

Do NOT implement in this phase:

- a new scheduler
- Telegram
- WhatsApp
- wake-word detection
- browser automation
- computer control
- autonomous learning
- a second agent loop

This phase only builds the reusable intent/alias routing layer.

## Done

Run tests, lint, typecheck, build, and live verification. Report exact evidence. STOP.
