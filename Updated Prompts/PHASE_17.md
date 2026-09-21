# PHASE 17 — FINAL PREFLIGHT + SECURITY + PERFORMANCE + REGRESSION

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


Official Hermes:
https://github.com/NousResearch/hermes-agent.git

Mark-LIV reference:
https://github.com/FatihMakes/Mark-LIV.git

## Goal
Verify the finished JARVIS system end-to-end. Do not add a new major feature.

## Real preflight
Create or extend a real running-system preflight harness inspired by the uploaded prompt pack's preflight idea.

Test real paths, not mocks only:
- JARVIS home
- Hermes health
- configured model/provider
- session continuity
- memory
- skills
- Google
- web
- DOCX/PPTX/XLSX/PDF
- browser
- computer tools
- messaging
- Gemini Live
- screen vision
- confirmation
- verification
- diagnostics

Keep output free of secrets/private content.
Exit non-zero on critical failure.

## Smart routing
Verify:
- simple question → no unnecessary tool/search
- current question → web
- personal Google question → Google
- personal note question → personal source
- repeated workflow → skill
- stable preference → memory
- side effect → confirmation/verification

## Security regression
Verify:
- no API keys/tokens in client
- no unrestricted Hermes terminal/file toolset
- no unrestricted shell in JARVIS
- memory writes controlled
- skill writes controlled
- model cannot change permissions
- web content cannot directly execute privileged actions
- writes require confirmation
- completion requires verification

## Performance
Measure:
- first response
- tool latency
- web latency
- Google latency
- memory latency
- final synthesis
- total turn time
- Live voice latency

Compare with the existing JARVIS Phase 12 baseline and fix meaningful regressions.

## UI regression
Verify:
- composer immediately visible
- no unwanted page-level scrolling
- internal scroll areas work
- no sample/demo data
- no "Phase 3+" etc.
- no preview-only confirmation copy
- configuration flow works
- JARVIS identity remains distinct from Hermes

Test:
1440x900
1280x800
1024x768
768x1024
390x844

## Hermes contract regression
Verify the actual current Hermes HTTP contract used by JARVIS:
- GET /health
- GET /v1/capabilities
- GET /v1/toolsets
- GET /v1/skills
- configured model/provider discovery
- /v1/runs lifecycle if JARVIS uses Runs
- /v1/runs/{id}/events SSE
- /v1/runs/{id}/stop
- /v1/runs/{id}/approval when approvals are delegated to Hermes
Do not rely on private Hermes Python internals if the documented API exposes the required behavior.

## Final quality
Run:
npm run test
npm run lint
npm run typecheck
npm run build

Perform real runtime/browser preflight.

## Documentation
Update:
- README.md
- AGENTS.md
- docs/ARCHITECTURE.md
- docs/ROADMAP.md
- docs/SECURITY.md
- docs/BEGINNER-GUIDE.md

Document actual final architecture and known limitations.

## Completion rule
Do not claim complete without evidence.
Mark anything blocked by hardware/credentials/external services as NOT VERIFIED.

STOP after final report.
