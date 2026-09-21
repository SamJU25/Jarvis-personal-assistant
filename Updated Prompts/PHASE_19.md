# PHASE 19 — WINDOWS COMPUTER CONTROL + SANDBOX

Use `MASTER_RULES.md`.

## Objective

Only after browser controls are stable, introduce governed desktop/computer capabilities.

Require:

- explicit allowlist of actions/targets
- isolated/sandboxed execution where practical
- kill switch
- timeout/cleanup
- foreground-window truth rather than guessed window identity
- confirmation for consequential actions
- deterministic verification
- full trace

Never enable unrestricted terminal/computer control merely because Hermes supports it.

STOP after security review and live controlled tests.
