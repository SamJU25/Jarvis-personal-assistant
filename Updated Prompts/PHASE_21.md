# PHASE 21 — UNDO / RECOVERY / IDEMPOTENCY EXPANSION

Use `MASTER_RULES.md`.

## Objective

Make consequential actions recoverable where technically possible.

Add capability metadata for:

- reversible
- undo operation
- operation ID
- evidence
- partial-failure recovery

For irreversible actions, provide truthful warnings and never fake undo.

Build on Phase 6 idempotency/trace work.

STOP after live tests of at least one reversible and one irreversible action path.
