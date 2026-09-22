# Phase 11 — Advanced Obsidian Memory Retrieval

> Status: **COMPLETE.** Canonical Markdown stays in Obsidian; the retrieval
> index is derived and rebuildable; retrieval is keyword-first with an explicit
> trace.

## What changed

### 1. Derived retrieval index (`src/lib/obsidian/memory-index.ts`, NEW)

An in-memory index caches parsed frontmatter+body per memory file, keyed by
vault path and fingerprinted by `mtimeMs` + `size`:

- **Freshness / change detection** — every retrieval stats each file; only
  changed or new files are re-read and re-parsed. Deleted files are dropped
  from the index automatically.
- **Derived/rebuildable** — `invalidateMemoryIndex()` drops the cache; the
  next retrieval rebuilds it from canonical files. Writes and deletes through
  `storeObsidianMemory` / `deleteObsidianMemory` invalidate the index
  immediately.
- **Bounded** — `MAX_INDEX_FILES` (500) caps scan work; non-`.md` files are
  ignored.
- **Never authoritative** — the index holds no data that isn't derived from
  canonical Markdown; it can be deleted at any time with zero data loss.

### 2. Keyword-first scored retrieval with trace (`src/lib/obsidian/memory.ts`)

- `searchObsidianMemoryWithTrace()` returns per-match `score`, `matchedTerms`,
  and `signals` (`exact_title`, `exact_content`, `title_word`, `tag_word`,
  `category_word`, `content_word`), so retrieval traces show which notes
  influenced the answer and why.
- Exact phrase matches rank above loose word hits; a small deterministic
  freshness boost (notes updated < 7 / < 30 days) breaks ties without touching
  canonical data.
- `searchObsidianMemory()` now delegates to the traced path, so plain and
  traced retrieval share one ranking implementation.
- **Semantic/hybrid retrieval**: intentionally not added — no embedding
  infrastructure requirement is demonstrated in this milestone (MASTER_RULES:
  smallest coherent change, YAGNI). The trace interface leaves the seam open
  for a justified hybrid pass later.

### 3. Source/path metadata in context + diagnostics

- `formatObsidianMemoryContext()` now annotates each injected line with the
  vault-relative path: `- [category] Title (AI/Memory/…): content`.
- `MemoryDiagnostic` gained optional `sourcePaths` (bounded, ≤10); the runtime
  records the paths of notes injected for each run, visible in the Debug
  Shell's memory stage.

### Acceptance coverage

- **Changing a note changes retrieval results without a second canonical
  store** — proven by `memory-index.test.ts`: edits are re-parsed on the next
  retrieval via freshness detection; deletions disappear immediately.
- **Retrieval traces show which notes influenced the answer** — proven by
  `memory-trace.test.ts` (scores/terms/signals) plus path-annotated context
  and `sourcePaths` diagnostics.

## Files

| File | Change |
|------|--------|
| `src/lib/obsidian/memory-parse.ts` | NEW — shared frontmatter parser (extracted, pure) |
| `src/lib/obsidian/memory-index.ts` | NEW — derived index with freshness detection |
| `src/lib/obsidian/memory.ts` | Index-backed listing; traced search; invalidation on write/delete; path-annotated context |
| `src/lib/contracts/diagnostics.ts` | `sourcePaths` added to memory diagnostic |
| `src/lib/agent/runtime.ts` | Uses traced retrieval; records matched paths |
| `tests/obsidian/memory-index.test.ts` | NEW — 6 tests (cache reuse, freshness, deletion, rebuild, bounds, filtering) |
| `tests/obsidian/memory-trace.test.ts` | NEW — 4 tests (trace fields, ranking, parity, empty query) |
| `tests/obsidian/memory.test.ts` | Updated context-format assertion for path metadata |

## Completion report

1. **Summary**: Retrieval scales beyond naive full re-scans via a derived,
   freshness-checked index; ranking stays keyword-first with an explicit
   per-note trace; no second canonical store introduced.
2. **Files changed/created/removed**: see table above.
3. **Architecture impact**: Additive seam (parse → index → traced retrieval);
   all existing tool/skill/memory APIs unchanged in behavior.
4. **Automated checks**: `vitest tests/obsidian` 48/48 (8 files);
   `tests/agent + obsidian + diagnostics` 185/185; `tsc --noEmit` clean;
   `eslint .` 0 errors (2 pre-existing warnings only); `next build` succeeded.
5. **Live checks**: VERIFIED — `scripts/verify-phase11-live.ts` ran against the
   real configured vault (`F:\Jarvis\Jarvis Memory`, set via
   `OBSIDIAN_VAULT_PATH` in `.env.local`): store → traced retrieval (score,
   terms, signals) → path-annotated context → canonical edit picked up by
   freshness detection → deletion removed from retrieval. All six steps
   passed; the verification note was deleted afterward (vault left clean).
6. **Unresolved issues**: None introduced.
7. **Exact next phase**: `PHASE_12.md` — Obsidian Skills + Controlled Learning.
