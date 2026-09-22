# Phase 12 — Obsidian Skills + Controlled Learning

> Status: **COMPLETE.** JARVIS improves reusable procedures only through a
> human-gated pipeline. No autonomous skill mutation exists.

## Flow

```text
Observed successful workflow (or explicit user request)
        ↓  model proposes skill + rationale + full SKILL.md
buildProposal  — diff preview computed, NOTHING written
        ↓  runtime intercepts write-class call
Human-readable diff preview + rationale in confirmation card
        ↓  explicit human approval (single-use, 60s TTL)
applyProposal  — history snapshot, write canonical SKILL.md, re-read verify
        ↓  skill_verification strategy (evidence, not model claims)
Result card + source citation → Hermes discovers the new version next run
```

## Enforcement points

| Rule | Mechanism |
|------|-----------|
| Model output never writes silently | `propose_skill_improvement` is `write` + `confirmationPolicy: "explicit"`; runtime intercepts before execution |
| Human sees what changes | `buildConfirmationDetails` renders a bounded unified-style diff against the canonical vault copy |
| Versioning | Automatic patch bump; `version:` field rewritten into the file |
| Rollback | Previous version archived at `AI/Skills/<name>/history/<v>.md`; `rollbackSkill` restores through the same confirmed path |
| Write correctness | `applyProposal` re-reads the file and compares the SHA-256 hash of what it wrote |
| Discovery correctness | `skill_verification` re-reads canonical content, checks hash + version, confirms the history archive, and re-runs vault skill discovery — a malformed write **fails** (proven live) |
| Layout containment | Verification rejects any path outside `AI/Skills/<slug>/SKILL.md`; the skill-name schema is path-safe by construction |

## Files

| File | Change |
|------|--------|
| `src/lib/contracts/learning.ts` | NEW — proposal/diff/write-result/tool-input contracts |
| `src/lib/learning/diff.ts` | NEW — deterministic bounded LCS line diff |
| `src/lib/learning/service.ts` | NEW — proposal builder (no write), applier, history, rollback |
| `src/lib/learning/tools.ts` | NEW — `propose_skill_improvement` capability |
| `src/lib/verification/strategies/skill-verification.ts` | NEW — 5-check evidence strategy |
| `src/lib/verification/registry.ts` | `skill_verification` + tool-id alias registered |
| `src/lib/confirmation/service.ts` | `UPDATE SKILL` confirmation with diff preview |
| `src/lib/tools/demo-tools.ts` | Tool registered (capabilities 17 → 18) |
| `src/app/api/agent/confirm/route.ts` | Success/failure result formatting for skill updates |
| `tests/learning/` | NEW — 4 files, 25 tests (diff/service/tool/verification) |
| `scripts/verify-phase12-live.ts` | NEW — live E2E on the real vault |
| Tool-count assertions | Updated 17 → 18 (capability-registry, tool-registry, tool-loop) |

## Completion report

1. **Summary**: Controlled-learning pipeline built on top of the existing
   Phase 9/10 confirmation+verification machinery: proposal → diff preview →
   human approval → verified write → discovery → rollback support.
2. **Files changed/created/removed**: see table above.
3. **Architecture impact**: One new capability (`propose_skill_improvement`),
   one new verification strategy, one new confirmation branch. No agent-loop,
   skill-selection, memory, or provider behavior changed.
4. **Automated checks**: `vitest tests/learning` 25/25;
   `learning+tools+verification+confirmation+obsidian+skills` 201/201;
   `agent+contracts+diagnostics+app+memory` 192/192;
   `tsc --noEmit` clean; `eslint .` 0 errors (2 pre-existing warnings);
   `next build` succeeded.
5. **Live checks**: VERIFIED — `scripts/verify-phase12-live.ts` ran the full
   pipeline against the real vault (`F:\Jarvis\Jarvis Memory`):
   proposal-without-writes → apply → 3-evidence strategy pass → discovery of
   v1.0.1 → rollback to original content (vault left pristine). Also proved
   the strategy rejects a malformed write. Hermes itself was not running, so
   downstream Hermes-side discovery was proven at vault-discovery level.
6. **Unresolved issues**: None introduced.
7. **Exact next phase**: `PHASE_13.md` — File + Document Intelligence.
