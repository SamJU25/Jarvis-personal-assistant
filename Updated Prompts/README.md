# JARVIS + Hermes Antigravity Prompt Pack v11

## What this pack is

An Antigravity-optimized, one-phase-at-a-time implementation pack for the current JARVIS project.

The pack is designed around these final ownership rules:

```text
JARVIS UI / Channels
        ↓
JARVIS Agent Gateway
        ↓
HERMES CORE
  sessions / runs / reasoning / skills / delegation
        ↓
JARVIS capability + policy boundary
        ↓
Obsidian / Google / Web / Files / Apps

Inference:
HERMES → FreeLLMAPI → automatic provider/model routing
```

## Critical UI rule

The JARVIS website remains the normal user control surface.

Do not make the user open Hermes Dashboard or FreeLLMAPI Dashboard for ordinary JARVIS operation.

JARVIS Settings must show the real runtime state and provide safe supported controls.

The browser talks only to JARVIS server APIs.

```text
Browser
  ↓
JARVIS server
  ├─ Hermes adapter
  ├─ FreeLLMAPI adapter
  ├─ Obsidian adapter
  ├─ Plugin adapter
  └─ health/event supervisor
```

## Real-time rule

Do not build settings as a static read-only status page.

Use:

`GET /api/settings/snapshot`
`GET /api/settings/events` (SSE)

with normalized `SystemStatusSnapshot` and `SettingsEvent` contracts.

The browser subscribes once and updates only affected components.

## Phase order

01 — completed reference
02 — completed reference
03 — completed reference
04 — Hermes Core + Obsidian + Real-Time UI/Event Foundation
05 — Hermes + FreeLLMAPI + Functional Settings Configuration
06 — Capability Registry + Policy + Trace + Idempotency
07 — Intent + Alias Registry
08 — Specialist Agent Orchestration
09 — Google Workspace Consolidation
10 — Web Research + Provenance
11 — Advanced Obsidian Memory Retrieval
12 — Obsidian Skills + Controlled Learning
13 — File + Document Intelligence
14 — Voice Experience v2 + Low-Latency Voice + Space PTT
15 — Scheduler + Proactive Assistant
16 — Vision
17 — Browser Automation + Google/YouTube basic actions
18 — Basic App + Communication Actions
19 — Windows Computer Control + Sandbox
20 — Remote Channels (Telegram first)
21 — Undo / Recovery / Idempotency Expansion
22 — Mark-LIV-Inspired Experience Layer
23 — Plugin / Extension Manager
24 — JARVIS Control Center + Live Settings
25 — Final Preflight / Security / Performance / Regression

## Important existing project decisions

- Hermes is the actual agent core.
- Obsidian is canonical durable memory.
- Obsidian `AI/Skills/` is the canonical skill source.
- FreeLLMAPI is the inference gateway; it owns upstream model routing.
- JARVIS remains the product/control plane.
- JARVIS Tool/Capability Registry remains the controlled execution boundary.
- Confirmation remains authorization.
- Verification remains evidence of side effects.
- The UI receives real Hermes/JARVIS events.
- Voice is optimized for time-to-first-audio, not fake speed animations.
- Intent aliases accelerate common phrases without becoming a second agent.
- Specialist agents are Hermes child agents/delegations, not separate assistant runtimes.
- Simple actions use direct capabilities; no giant RPA planner.

## Security

Never paste real secrets into Antigravity prompts.

FreeLLMAPI currently supports encrypted provider keys, a unified client key, `model=auto` routing, streaming, tool calling, and declarative startup config. Its current project documentation also states that it is intended for personal experimentation and not as a stable production inference substrate. Treat it as an interchangeable gateway boundary, not a lifetime infrastructure dependency.

## How to use

1. Run `PRE_PHASE_04_VERIFY.md` with NO code changes.
2. If the gate is acceptable, run `PHASE_04.md` only.
3. Use `PHASE_04_HANDOFF.md`.
4. Continue one phase at a time.
5. Never paste the whole pack into one Antigravity run.
6. Use `COMPLETION_REPORT_TEMPLATE.md` for every phase.

## UI source of truth

Read `UI_GUIDE.md` before touching UI.

The UI guide is binding for:
- Settings information architecture
- Hermes configuration surface
- FreeLLMAPI control surface
- live status
- SSE synchronization
- plugin state
- memory/skills state
- voice state
- channel state
- capability state
- security presentation
- diagnostics

## References

JARVIS:
https://github.com/SamJU25/Jarvis-personal-assistant

Hermes:
https://github.com/NousResearch/hermes-agent

FreeLLMAPI:
https://github.com/tashfeenahmed/freellmapi

OpenJarvis:
https://github.com/open-jarvis/OpenJarvis

Mark-LIV:
https://github.com/FatihMakes/Mark-LIV
