# PHASE 22 — REAL-LIFE ASSISTANT EXPERIENCE LAYER

Use `MASTER_RULES.md`.

## Objective

Make JARVIS feel like one dependable assistant rather than a collection of disconnected features.

Use Mark-LIV as UX inspiration only. Do not copy code, assets, prompts, or proprietary implementation.

## Priorities

1. runtime self-knowledge
2. fast visible state
3. instant acknowledgement for long work
4. conversation/session resume
5. memory UI
6. skill UI
7. active-task surface
8. safe undo affordances
9. clear capability availability
10. voice state clarity

## Runtime self-knowledge

JARVIS should truthfully report:
- core runtime
- inference gateway state
- memory source
- skill source
- voice availability
- Telegram availability
- Google availability
- browser availability
- computer-control availability

Values must come from runtime/configuration, not hardcoded claims.

## Simplicity

Do not turn JARVIS into an IDE dashboard.

Common personal-assistant actions should stay one or two steps from the user’s natural request.

## Memory UI

Show what durable memory exists and where it lives in Obsidian. Review/removal must use governed operations.

## Skill UI

Show enabled/available Obsidian-backed skills and safe management actions.

## Active task

Show a compact live state:

Listening
Thinking
Working
Waiting for approval
Speaking
Completed
Failed
Cancelled

## Acceptance

Live-verify:

1. capability self-status
2. memory review
3. skill review
4. active-task state
5. long-task acknowledgement
6. session resume
7. safe undo affordance where supported

STOP.
