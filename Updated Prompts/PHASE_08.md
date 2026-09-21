# PHASE 8 — SKILLS + CONTROLLED LEARNING

GLOBAL RULES
- Work on the existing JARVIS repository. Do not rebuild it.
- Implement ONLY the numbered phase in this file. Do not continue into later phases.
- Before coding, inspect the current repository and actual Hermes checkout.
- Read JARVIS_MASTER_PROMPT.md, AGENTS.md, README.md, docs/ARCHITECTURE.md, docs/ROADMAP.md, docs/SECURITY.md, and relevant source/tests.
- Actual source code is authoritative when docs are stale.
- Do not invent Hermes APIs. Use the checked-out Hermes version and its current docs.
- Preserve working Phase 9–12 confirmation, verification, diagnostics, voice, memory, and tool boundaries unless the phase explicitly changes them.
- Never put API keys, OAuth tokens, refresh tokens, or secrets in browser/client code.
- Never claim success without actual evidence.
- Run relevant tests, lint, typecheck, build, and real runtime/browser verification.
- Report NOT VERIFIED where a dependency/device/credential prevents real verification.
- When this phase is verified, STOP. Do not implement the next phase.


Hermes skills reference:
https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/features/skills.md

## Goal
Let JARVIS improve at repeatable workflows without unrestricted self-modification.

Memory = WHAT.
Skills = HOW.

## Safety
Enable:
skills.write_approval = true
(or current equivalent)

Do not allow the agent to:
- edit JARVIS source
- alter security policy
- grant itself tools
- expand permissions
- silently rewrite active skills

## Skill creation
Create a skill only when a workflow is:
- non-trivial
- reusable
- stable
- useful

Workflow:
discover → propose → user approval → save → reuse

## Corrections
A stable preference belongs in memory.
A procedural rule belongs in a skill.
Avoid needless duplication.

## Verify
- skill proposal
- approve
- reject
- reuse
- modify after user correction
- delete approval
- no skill explosion

Run all quality gates.

STOP.
