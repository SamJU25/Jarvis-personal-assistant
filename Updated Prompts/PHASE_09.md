# PHASE 09 — GOOGLE WORKSPACE CONSOLIDATION

Use `MASTER_RULES.md`.

## Objective

The project already contains Google Workspace functionality. Do not build another parallel implementation.

Compare current JARVIS Google capabilities with the Hermes-native Google Workspace capability available in the installed Hermes version.

## Process

1. Inventory current JARVIS Google features and tests.
2. Inventory actual Hermes Google features/toolsets/approval behavior.
3. Build a parity matrix.
4. Migrate only capabilities where Hermes is sufficient and safer for the final architecture.
5. Preserve any JARVIS-specific functionality that Hermes does not provide.
6. Remove redundant code only after live parity verification.

## Rule

Google remains an external capability, not a second agent core and not a memory source.

Do not delete working JARVIS Google code before parity is proven.

## Acceptance

- Gmail/Calendar/Drive features remain functional.
- no duplicate long-term Google implementation is left without a documented reason.
- confirmation/authorization behavior is understood and preserved.
- UI/debug events remain correct.
- tests/build/live checks pass.

STOP.
