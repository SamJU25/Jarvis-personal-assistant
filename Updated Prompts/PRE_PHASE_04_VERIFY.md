# PRE-PHASE 04 VERIFICATION — PHASES 1–3

Use `MASTER_RULES.md`.

## Rule

Verify only. Do not modify code.

## Phase 1

Audit and run evidence for:
- JARVIS shell
- reducer/state
- command submission seam
- responsive/state behavior
- tests/lint/typecheck/build

## Phase 2

Audit:
- existing Hermes/provider integration
- Hermes configuration
- client health
- session behavior
- existing live Hermes checks

## Phase 3

Audit:
- Tool Registry
- typed tool contracts
- permissions
- tool events
- agent API validation
- confirmation/verification boundary

## Run

- `npm test`
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- relevant existing Hermes/Phase 1–3 live verification scripts

## Report

Return:
1. PASSING
2. FAILED
3. PRESENT BUT UNVERIFIED
4. ARCHITECTURE DRIFT
5. FILES PHASE 4 MUST PRESERVE
6. WHETHER PHASE 4 IS UNBLOCKED

Do not fix failures in this verification. STOP.
