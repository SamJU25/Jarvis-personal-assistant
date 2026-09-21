# PHASE 6 — MULTI-PROVIDER WEB RESEARCH

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


Hermes:
https://github.com/NousResearch/hermes-agent.git

## Goal
Give JARVIS current web research using Hermes web tools, with optional deliberate multi-provider research.

Hermes web reference:
https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/features/web-search.md

## Important
Hermes natively selects a configured web backend for web_search/web_extract. Do not assume a single Hermes setting broadcasts every query to every provider.

## Native path

### Provider discovery rule
The list below is illustrative only. The installed Hermes version is authoritative.
At runtime, discover configured/available search backends from the current Hermes configuration and capability/toolset surface rather than assuming every named provider exists.

Use current Hermes-supported backends where configured, such as:
- DDGS
- SearXNG
- Brave
- Tavily
- Exa
- Parallel
- other backends supported by the installed version

Prefer free/self-hosted options initially.

## Multi-provider research
Implement an optional JARVIS research orchestrator ONLY for research tasks:
- fan out to 2–3 configured providers in parallel
- normalize results
- deduplicate by canonical URL
- detect source agreement/disagreement
- choose relevant pages for extraction
- pass evidence to Hermes for synthesis

Do not query every provider for trivial questions.

Do not treat mirrored copies of one source as independent evidence.
If providers disagree, preserve the disagreement.

## Smart routing
Use web for:
- current information
- news
- fresh technical info
- external research
- unknown facts
- current comparisons

Do not use web unnecessarily for:
- personal Gmail/Calendar/Drive/Obsidian
- deterministic questions

## UI
Show only real:
- search events
- extraction events
- source URLs/titles
- errors
- empty states

## Verify
- single-provider search
- multi-provider research
- deduplication
- extraction
- conflicting sources
- failure/no backend
- question that should not search

Run all quality gates.

STOP.
