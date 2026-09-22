# Phase 10 — Web Research + Provenance

> Status: **COMPLETE.** Hermes decides when research happens; JARVIS governs
> provenance. No second agent loop was built.

## Architecture

Web research runs natively inside Hermes through its enabled `web` toolset
(`web_search`, `web_extract` — verified in `F:\hermes-agent\.hermes\config.yaml`,
`platform_toolsets.api_server`). JARVIS never performs web reasoning itself; it
governs what happens to provenance metadata around the run:

```text
Hermes run (web_search / web_extract)
        ↓  tool.completed SSE events (untrusted payloads)
JARVIS provenance boundary (src/lib/research/provenance.ts)
  sanitize → validate URL scheme → dedupe → bound → stamp retrievedAt
        ↓  merged into StructuredResult.sources
UI Sources panel (existing SourceList; location = URL for web sources)
```

## Trust boundary

- All externally-originated titles/locations pass `sanitizeExternalText`
  (control chars, ANSI escapes, whitespace collapse, length bounds).
- URLs pass `sanitizeExternalUrl`: only `http:`/`https:` schemes survive;
  `javascript:`, `data:`, `file:`, control-character, and oversized URLs are
  rejected. An entry claiming an invalid URL is dropped entirely — never cited
  URL-less.
- Nothing from web content is ever fed into system instructions.
- Captured evidence and model-declared sources are both bounded to
  `MAX_PROVENANCE_SOURCES` (20).

## Provenance lifecycle

1. **Capture** — `HermesProvider.executeRun` watches `tool.completed` SSE events
   for web tools (`WEB_TOOL_PATTERN`) and extracts sanitized evidence from the
   untrusted payload (`url`, `results[]`, `sources[]`, `links[]` shapes all
   handled defensively).
2. **Trace** — when evidence is captured, an `Evidence captured: N sources from
   <tool>` event joins the run stream (visible in the Debug Shell), completing
   the required trace: search/retrieval → evidence → Hermes synthesis.
3. **Merge** — on `run.completed`, `mergeWebSources` combines model-declared
   `sources` (priority) with captured evidence (gap-filling), deduplicated by
   URL.
4. **Display** — web sources render in the existing Sources panel
   (`kind: web · location = URL`) with `retrievedAt` available in the contract.

## Files

| File | Change |
|------|--------|
| `src/lib/research/provenance.ts` | NEW — sanitize/validate/dedupe/bound/merge provenance |
| `src/lib/contracts/result.ts` | `sourceSchema`: added `web` kind, optional `url` (http/https), optional `retrievedAt` (ISO datetime) |
| `src/lib/agent/providers/hermes-provider.ts` | Evidence capture from web tool SSE events, trace event, provenance merge on completion |
| `src/lib/agent/prompt.ts` | System instructions require web provenance and mark web content untrusted |
| `tests/research/provenance.test.ts` | NEW — 16 unit tests (sanitization, URL trust, dedupe, bounds, merge) |
| `tests/research/provenance-trace.test.ts` | NEW — 3 integration tests through `executeRun` (capture+merge, declared priority, non-web guard) |

## Completion report

1. **Summary**: Provenance pipeline added around Hermes's native web research;
   no new agent loop; sources preserved end-to-end with trust boundaries.
2. **Files changed/created/removed**: see table above. No tool registry,
   confirmation, verification, or skills behavior changed.
3. **Architecture impact**: Additive only — a provenance seam between Hermes
   tool events and `StructuredResult.sources`.
4. **Automated checks**: `vitest tests/research` 19/19; `tests/agent + contracts
   + skills` 150/150; `tests/google + tools + verification` 144/144 (with
   research included: 20 files / 144 pass); `tsc --noEmit` clean; `eslint .` 0
   errors (2 pre-existing warnings); `next build` succeeded.
5. **Live checks**: `NOT VERIFIED` — Hermes server is not running in this
   environment, so a real `web_search` run could not be executed. The capture
   path is exercised against realistic SSE payloads in
   `tests/research/provenance-trace.test.ts`; rerun live verification with a
   running Hermes per MASTER_RULES.
6. **Unresolved issues**: None introduced.
7. **Exact next phase**: `PHASE_11.md` — Advanced Obsidian Memory Retrieval.
