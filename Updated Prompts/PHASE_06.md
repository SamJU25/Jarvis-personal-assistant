# PHASE 06 — CAPABILITY REGISTRY + POLICY + TRACE + IDEMPOTENCY

Use `MASTER_RULES.md`.

## Objective

Prevent `AgentRuntime` from becoming a giant switchboard as capabilities grow.

Introduce declarative capability metadata and a unified execution/trace path.

## Required metadata

Where applicable, a capability should declare:

- id
- input schema
- output schema
- risk level
- read/write class
- confirmation policy
- verification strategy
- reversible or irreversible
- timeout
- idempotency support
- audit/trace policy

Do not break existing ToolRegistry APIs unnecessarily; add the smallest coherent extension.

## Trace

Create one correlated execution trace spanning:

JARVIS session
→ Hermes run
→ skill
→ inference
→ memory
→ capability/tool
→ confirmation
→ verification
→ final result

Do not store secrets.

## Idempotency

Side-effecting operations must have a stable operation identity so safe retries do not duplicate writes.

Do not implement unsafe blanket retries.

## Verification registry

Replace growing tool-specific `if/else` verification selection with a registry/strategy mechanism where appropriate.

Existing verified behavior must remain unchanged.

## Acceptance

- existing tools still work
- confirmation still works
- verification still works
- duplicate side effects are prevented in a retry test
- trace correlation is complete
- diagnostics can display the trace
- tests/build/live preflight pass

STOP.
