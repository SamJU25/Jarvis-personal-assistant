# PHASE 08 — SPECIALIST AGENT ORCHESTRATION

Use `MASTER_RULES.md` and `UI_GUIDE.md`.

## Objective

Let the Hermes core delegate suitable work to specialist child agents instead of forcing one agent to perform every task alone.

Use Hermes's supported delegation mechanism from the installed version. Do not build a second agent engine.

## Target architecture

```text
JARVIS
  ↓
HERMES CORE
  ├─ direct execution for simple tasks
  └─ delegation when beneficial
        ├─ research specialist
        ├─ coding specialist
        ├─ memory/knowledge specialist
        ├─ productivity specialist
        └─ temporary task-specific specialist
```

## Inspect first

Inspect the installed Hermes implementation for:

- delegation / child-agent tool
- child-agent lifecycle
- parallel delegation limits
- model override support
- tool/skill inheritance
- child-agent session isolation
- cancellation
- result aggregation

Do not invent delegation APIs.

## JARVIS specialist registry

Create a small declarative registry for reusable specialist roles without creating separate agent runtimes.

Each specialist definition may include:

- stable ID
- display name
- role/instructions
- preferred routing profile if supported
- allowed skills
- allowed capabilities/tools
- maximum execution time
- concurrency limit
- whether it is user-visible

Initial roles:

- `research`
- `coding`
- `productivity`
- `memory`
- `communications`

Only add a role when it has a real use in the installed capability set.

## Delegation policy

Keep it simple.

Direct Hermes execution for:

- simple questions
- small tool calls
- deterministic commands
- quick conversational requests

Delegate when:

- the task naturally separates into independent subtasks
- parallel research is useful
- a specialist tool/skill boundary gives a better result
- the main agent would otherwise become unnecessarily complex

Do not delegate merely to make the UI look sophisticated.

## Temporary specialists

Support task-scoped specialist creation where Hermes supports it.

Example:

`"Create a specialist to inspect this repository's architecture."`

The temporary specialist must have:

- explicit objective
- bounded tools/capabilities
- bounded lifetime
- explicit output contract
- no access beyond the parent task's authorization

Do not persist a temporary specialist as a permanent service.

## Context

Children do not automatically inherit the entire parent conversation unless Hermes does so natively.

Pass only what the child needs:

- task objective
- relevant context
- relevant memory references
- relevant files/data
- required skill
- output expectations
- constraints

Do not duplicate the entire parent transcript unnecessarily.

## Parallelism

Use Hermes's supported parallel delegation when useful.

All child runs must remain correlated to the parent:

- JARVIS session ID
- JARVIS parent run ID
- Hermes parent run ID
- child run ID
- specialist ID

## Cancellation

Cancelling the parent task must cancel child work where the Hermes version supports it.

A stale child result must never resurrect a cancelled parent run.

## UI

Only show specialists when delegation actually occurs.

Example:

```text
HERMES
├─ Research Specialist    ✓
├─ Memory Specialist      ✓
└─ Synthesis              ●
```

Do not expose private chain-of-thought.

Show safe lifecycle data only.

Settings should expose the specialist registry as read-only status initially; later phases may add simple enable/disable controls.

## FreeLLMAPI integration

Do not choose concrete upstream models in JARVIS.

If a routing profile is supported, the specialist may request a high-level profile such as fast/reasoning/coding.

FreeLLMAPI remains the actual provider/model router in the later production architecture.

## Acceptance tests

1. Simple task runs directly without delegation.
2. Delegatable task creates a specialist.
3. Two independent specialists can run concurrently when supported.
4. Parent receives structured child results.
5. Parent synthesizes the final response.
6. Child tool permissions do not exceed parent permissions.
7. Parent cancellation stops child work.
8. No stale child result updates a cancelled parent.
9. Specialist activity appears in the live event stream.
10. Existing confirmation/verification still apply to child-triggered side effects.

## Scope stop

Do NOT implement:

- a new agent framework
- permanent autonomous agents outside Hermes
- specialist chat UIs
- recursive unbounded delegation
- autonomous specialist self-creation without a bounded parent task

## Done

Run tests, lint, typecheck, build, and live delegation verification. Report exact evidence. STOP.
