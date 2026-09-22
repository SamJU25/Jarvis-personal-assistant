# JARVIS — Personal AI Operating Assistant

[![Tests](https://img.shields.io/badge/tests-612%20passed-brightgreen.svg)](https://github.com/SamJU25/Jarvis-personal-assistant)
[![Quality Gates](https://img.shields.io/badge/quality%20gates-lint%20%7C%20types%20%7C%20build%20passing-brightgreen.svg)](https://github.com/SamJU25/Jarvis-personal-assistant)
[![Next.js](https://img.shields.io/badge/Next.js-16.3.5%20Turbopack-black.svg)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2.8-blue.svg)](https://react.dev/)
[![Node](https://img.shields.io/badge/Node.js-24.19.0-green.svg)](https://nodejs.org/)
[![Local Voice](https://img.shields.io/badge/voice-Whisper%20%2B%20Kokoro%20(Local)-orange.svg)](https://github.com/SamJU25/Jarvis-personal-assistant)
[![Hermes Agent](https://img.shields.io/badge/agent-Nous%20Hermes%200.21.3-purple.svg)](https://github.com/NousResearch/hermes-agent)

**JARVIS** is a local-first, privacy-respecting personal AI operating assistant and live control center. Designed as an ambient, cinematic command surface rather than a generic chat window, JARVIS combines agentic reasoning (Nous Hermes 0.21.3), a pinned tool security boundary, human confirmation gates for writes, application-owned deterministic verification, local voice (Whisper + Kokoro), bi-directional integration with personal data stores (Obsidian and Google Workspace), and a modular subagent architecture with 11 specialized child agents.

---

## Architecture & System Topology

The system enforces strict boundaries between product experience, agent reasoning, inference routing, and system execution:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       JARVIS Channels & UI Surface                          │
│     (Next.js App Router, Tailwind CSS, Framer Motion, SSE Event Client)     │
│   - Cinematic CenterStage Core           - Command Bar (Text + PTT Voice)   │
│   - Live Context Rail & Activity Stream  - Reactive Control Center Settings │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                User Request (Typed text or Local Voice STT)
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           JARVIS Agent Gateway                              │
│   - Session Continuity Mapping           - Deterministic Fast-Path (<10ms)  │
│   - Server-Side SSE Event Stream         - Request Lifecycle & Cancellation │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                             HERMES AGENT CORE                               │
│              (Runs / Sessions / Reasoning / Skills / Delegation)            │
│   - Native multi-step agent loop         - Pinned safe tool execution       │
│   - Context management & summarization   - 11 Specialist child delegations  │
└───────────────────────┬─────────────────────────────┬───────────────────────┘
                        │                             │
        Inference Path  ▼                             ▼  Capability Call
┌──────────────────────────────┐       ┌──────────────────────────────────────┐
│       FreeLLMAPI Gateway     │       │    JARVIS Governed Capability &      │
│  - model=auto routing        │       │           Policy Boundary            │
│  - Unified client auth       │       │  - 21 Application-Owned Tools        │
│  - Upstream provider balance │       │  - Strict Argument Coercion (Zod)    │
│  (Local Ollama Fallback)     │       │  - Dangerous Toolset Pinning Check   │
└──────────────────────────────┘       └──────────────────┬───────────────────┘
                                                          │
                                            Is Tool a Write Operation?
                                                   /              \
                                             [YES]                  [NO]
                                               /                      \
                                              ▼                        ▼
┌──────────────────────────────────────────────────┐   ┌──────────────────────────────┐
│             Human Confirmation Gate              │   │     Direct Tool Execution    │
│  - Cryptographic single-use token generation     │   │  - Obsidian Read / Search    │
│  - 60-second TTL replay attack rejection         │   │  - Gmail / Calendar / Drive  │
│  - Explicit dual approval (UI Card or Voice)     │   │  - Obsidian Memory Retrieval │
│  - Draft-only email creation (send forbidden)    │   │  - Governed Document Reading │
│  - Governed write_document preview               │   │  - Demo Tools & System Time  │
└─────────────────────────┬────────────────────────┘   └──────────────┬───────────────┘
                          │ Approved                                  │
                          ▼                                           │
┌──────────────────────────────────────────────────┐                  │
│             Execute Write Capability             │                  │
│  - create_note (Obsidian Vault Containment)      │                  │
│  - create_google_doc (Safe Google Workspace CLI) │                  │
│  - draft_email (Gmail Draft Only via GWS CLI)    │                  │
│  - write_document (Allowed Path Containment)     │                  │
│  - propose_skill_improvement (Controlled Learning│                  │
└─────────────────────────┬────────────────────────┘                  │
                          │                                           │
                          └─────────────────────┬─────────────────────┘
                                                │
                                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Formal Verification Registry                             │
│   - Application-owned empirical post-execution verification                 │
│   - Deterministic disk containment, stat inspection, and ID validation      │
│   - 5-evidence document verification (path, existence, size, SHA-256)       │
│   - Model claims ("verified": true) strictly rejected as evidence           │
└───────────────────────────────────────┬─────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      Diagnostic & Observability Engine                      │
│   - 11-stage lifecycle telemetry pipeline (Run -> ... -> Specialist -> ...) │
│   - Strict browser sanitization (redacting tokens, paths, audio, shell)     │
│   - performance.now() stage timing & latency profiling                      │
│   - Non-blocking local Kokoro TTS audio synthesis                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Architecture History: Built From Scratch & Evolutionary Upgrades

JARVIS was engineered across two foundational eras:
1. **The Ground-Up Construction (Phases 1–12)**: How JARVIS was designed, architected, and built from an empty repository into a fully functioning, local-first operating assistant.
2. **The Modern Subagent & Intelligence Era (Updated Prompts Phases 01–25)**: How JARVIS migrated to the Nous Hermes multi-agent core, specialist child delegations, advanced memory retrieval, controlled learning, and file intelligence.

---

### Part 1: How JARVIS Was Built From Scratch (Foundational Phases 1–12)

| Milestone | Foundation Built From Scratch | Architectural Deliverables & Boundaries |
|---|---|---|
| **Phase 1** | **Cinematic Shell & State Machine** | Built the Next.js App Router shell with Tailwind CSS, Framer Motion, and a unified `JarvisShell` reducer. Created the CenterStage animated visualizer, live context rail, command bar, and sample activity stream. |
| **Phase 2** | **Provider Boundary & Headless Execution** | Designed the server-side provider boundary connecting JARVIS to Command Code headless execution with bounded role-aware conversations and NDJSON streaming. |
| **Phase 3** | **Generic Tool Registry & Capability Boundary** | Created the application-owned `ToolRegistry`, typed `JarvisTool` contracts with Zod validation, safe demo tools (`get_current_time`, `search_demo_data`), and turn-bounded tool loops. |
| **Phase 4** | **Obsidian Vault Integration** | Implemented server-only vault access (`search_vault`, `read_note`, `create_note`) with strict canonical path containment, read-only guarantees, and symlink traversal protection. |
| **Phase 5** | **Runtime Skill & Process Engine** | Created `SkillRegistry`, dynamic skill loader, and 5 foundational workflows (`morning-briefing`, `meeting-prep`, `capture-note`, `research`, `loose-ends`). |
| **Phase 6** | **Safe Google Workspace Integration** | Integrated server-side GWS CLI wrapper with safe process execution (`shell: false`), read tools (`search_gmail`, `get_calendar_events`, `search_drive`), and untrusted external content sanitization. |
| **Phase 7** | **Persistent Local Memory (SQLite)** | Built durable server-side memory using Node.js native `node:sqlite`, 4 memory tools (`search_memory`, `store_memory`, etc.), bounded retrieval, and secret credential rejection. |
| **Phase 7.5**| **Dual Reasoning Architecture (Local Ollama)** | Added local Ollama integration (`qwen3.5:4b`), runtime model discovery via `/api/tags`, JSON tool adapter, and seamless provider fallback without cloud dependencies. |
| **Phase 8** | **Fully Local Voice Subsystem** | Built zero-cloud local voice pipeline using offline `whisper.cpp` (STT) and neural `Kokoro-82M` (TTS) with ephemeral RAM-only audio and real-time barge-in. |
| **Phase 9** | **Human Confirmation Gate for Writes** | Established application-owned confirmation tracking with single-use cryptographic tokens (60s TTL) and drafts-only email creation (`draft_email`). Model cannot authorize writes. |
| **Phase 10**| **Deterministic Formal Verification** | Enforced that tool execution is NOT task completion. Created deterministic on-disk verification strategies (`note_verification`, `doc_verification`) that empirically verify file sizes, checksums, and containment. Model self-claims ("verified: true") are strictly rejected. |
| **Phase 11**| **Observability & Diagnostic Engine** | Expanded to an 11-stage telemetry pipeline, server-side `DiagnosticService` ring buffer, nanosecond latency timings, and full Debug Shell (`/debug`). |
| **Phase 12**| **Reliability & Multi-Turn Polish** | Added deterministic task fast-paths (<10ms for unambiguous queries), multi-turn card normalization (`formatAssistantTurn`), and non-blocking asynchronous audio synthesis. |

---

### Part 2: The Modern Evolutionary Upgrades (Updated Prompts Phases 01–25)

| Phase | Milestone | Status | Key Deliverables & Verified Behavior |
|---|---|---|---|
| **Phase 01** | **Clean Shell & Boundary Separation** | **COMPLETED** | Cleaned legacy mock UI; established unified reactive shell state machine and responsive desktop/mobile layouts. |
| **Phase 02** | **Nous Hermes Core Integration** | **COMPLETED** | Connected server-side runtime directly to Nous Hermes Agent v0.21.3 API via Bearer auth, health probes, and session continuity. |
| **Phase 03** | **Pinned Dangerous Toolsets** | **COMPLETED** | Pinned dangerous toolsets (`terminal`, `code_execution`, unrestricted fs); enforced 17 typed application-owned tools. |
| **Phase 04** | **Hermes Core Reasoning Loop** | **COMPLETED** | Hermes became authoritative multi-step agent core owning the reasoning loop and SSE event stream via `/v1/runs`. |
| **Phase 05** | **FreeLLMAPI & Functional Settings** | **COMPLETED** | Connected FreeLLMAPI gateway for intelligent upstream routing (`model=auto`) and functional key management with write-only inputs. |
| **Phase 06** | **Capability Registry & Trace Correlation** | **COMPLETED** | Unified tools into Capability Registry with idempotent execution tracking and correlation IDs. |
| **Phase 07** | **Intent & Alias Registry** | **COMPLETED** | High-speed regex accelerator and safety-sensitive intent router bypassing redundant LLM reasoning. |
| **Phase 08** | **Specialist Agent Orchestration** | **COMPLETED** | Implemented Hermes child delegation via `delegate_task` (`delegation` toolset). Established 11 domain specialists, child permission containment, and specialist tree card synthesis. |
| **Phase 09** | **Google Workspace Consolidation** | **COMPLETED** | Exhaustive parity check between JARVIS and Hermes Google capabilities; preserved all 7 application-owned GWS tools under strict application control. |
| **Phase 10** | **Web Research + Grounded Provenance** | **COMPLETED** | Governed provenance around Hermes's native `web` toolset; URL scheme verification, text sanitization, and deduplicated source citations. |
| **Phase 11** | **Advanced Obsidian Memory Retrieval** | **COMPLETED** | Scored retrieval index over canonical Markdown notes (`AI/Memory/`) with mtime change detection and signal tracing. |
| **Phase 12** | **Obsidian Skills + Controlled Learning** | **COMPLETED** | Human-gated skill improvement via `propose_skill_improvement`, deterministic unified diff previews, and vault skill versioning (`AI/Skills/`). |
| **Phase 13** | **File + Document Intelligence** | **COMPLETED** | Governed file operations across explicit allowed roots (`documents`, `vault`). Traversal-safe containment, safe binary metadata extraction, 21 registered tools (`list_documents`, `read_document`, `write_document`), and 5-evidence deterministic `document_verification`. |
| **Phase 14** | **Voice Experience v2 + Low-Latency Streaming** | **ACTIVE NEXT** | Real-time speech-to-text streaming, sentence chunking with concurrent TTS overlap, focus-aware Space hold-to-talk (PTT), and sub-500ms time-to-first-audio. |
| **Phase 15** | **Scheduler + Proactive Assistant** | UPCOMING | In-memory cron/timer scheduling engine, morning briefings, calendar reminders, and proactive background task notifications. |
| **Phase 16** | **Multimodal Vision** | UPCOMING | Local multimodal image analysis, desktop screenshot inspection, and visual reasoning without cloud dependencies. |
| **Phase 17** | **Browser Automation + Media Playback** | UPCOMING | Safe, bounded browser automation actions via sandboxed subagent and YouTube playback control through dedicated, isolated browser sessions. |
| **Phase 18** | **Basic App + Communication Actions** | UPCOMING | Desktop application launching, window focus control, system shortcuts, and local messaging primitives. |
| **Phase 19** | **Windows Computer Control & Sandbox** | UPCOMING | Governed, sandboxed Windows system interaction with strict permission checks and rollback safeguards. |
| **Phase 20** | **Remote Channels (Telegram First)** | UPCOMING | Telegram bot and remote messaging channel integration reusing the exact same unified JARVIS/Hermes runtime core. |
| **Phase 21** | **Undo / Recovery / Idempotency Expansion** | UPCOMING | Comprehensive undo system for safe reversible operations, vault snapshots, and transactional action recovery. |
| **Phase 22** | **Mark-LIV-Inspired Cinematic Layer** | UPCOMING | Cinematic audiovisual animations, dynamic state visualizers, responsive audio reactive waveforms, and ambient HUD elements. |
| **Phase 23** | **Plugin / Extension Lifecycle Manager** | UPCOMING | Declarative plugin management system for installing, enabling, disabling, and isolating third-party capabilities safely. |
| **Phase 24** | **JARVIS Control Center + Live Settings** | UPCOMING | Full live control center with real-time health grid, capability toggles, memory visualizer, and live telemetry inspector. |
| **Phase 25** | **Final Preflight / Security / Performance** | UPCOMING | Complete system security audit, OWASP review, latency profiling, stress testing, and final release hardening. |

---

## Core Capabilities & Subsystems

### 1. Dual-Reasoning Engine with Hermes & Ollama
- **Primary Agent Core**: Nous Hermes Agent (`0.21.3`) operating as a local server agent (`http://127.0.0.1:8642`) with native support for multi-step runs, tool calling, and session continuity.
- **Local Fallback**: Ollama (`qwen3.5:4b`) running with native JSON schema enforcement, `think: false`, and `keep_alive: 15m` for ultra-fast fallback responses.
- **Deterministic Fast-Path**: Direct regex-accelerated resolver for unambiguous system queries (e.g. system time) executing in `<10ms` without provider roundtrips.

### 2. Fully Local Voice Pipeline (Whisper + Kokoro)
- **Speech-to-Text (STT)**: Offline `whisper.cpp` running locally on port 8080.
- **Text-to-Speech (TTS)**: Offline `Kokoro-82M` ONNX neural speech synthesizer running locally on port 8880.
- **Privacy Guarantee**: Audio buffers exist only ephemerally in RAM during active transcription/synthesis. Zero audio is stored to disk or uploaded to any third-party cloud.
- **Barge-in Support**: Speaking or pressing the stop button instantly interrupts active speech playback.

### 3. Pinned Tool Security & Governed Capability Boundary
- **21 Application-Owned Tools**:
  - *Obsidian Vault*: `search_vault`, `read_note`, `create_note`.
  - *Governed Documents & Files*: `list_documents`, `read_document`, `write_document` (contained to allowed roots `documents`, `vault`).
  - *Google Workspace*: `search_gmail`, `read_gmail`, `get_calendar_events`, `search_drive`, `read_drive_file`, `create_google_doc`, `draft_email`.
  - *Persistent SQLite Memory*: `search_memory`, `store_memory`, `list_memory`, `delete_memory`.
  - *System & Demo*: `get_current_time`, `search_demo_data`, `read_demo_item`.
- **Read/Write Partitioning**: Read operations execute autonomously; write operations (`create_note`, `create_google_doc`, `draft_email`, `write_document`, `propose_skill_improvement`) are intercepted before execution.
- **Drafts Only**: Email actions are strictly limited to `draft_email`. Sending emails is prevented by design.
- **Pinned Toolsets**: Hermes API server is verified on launch to ensure dangerous capabilities (`terminal`, `code_execution`, `raw_file_write`) are disabled.

### 4. Human Confirmation & Deterministic Verification
- **Single-Use Tokens**: Every write proposal generates a cryptographic token with a 60-second TTL. Replays and duplicate consumptions are blocked.
- **Dual Approval Channels**: Confirmations can be approved via UI Confirmation Cards or spoken voice intent ("yes, proceed", "confirm").
- **Deterministic Post-Execution Verification**: Model claims ("verified: true") are strictly ignored. Writes are verified by empirical application logic:
  - Notes: File existence and size checked on disk within canonical vault path.
  - Documents: 5-evidence verification (execution, root containment, on-disk existence, file size, SHA-256 hash match).
  - Google Docs: Valid document ID and URL verified from GWS CLI output.
  - Emails: Confirmed as a draft in Gmail.

### 5. Modular Subagent Architecture (11 Dedicated Specialists)
To eliminate prompt bloat and prevent context overload on the main orchestrator, JARVIS delegates domain-specific work across **11 focused Hermes Specialist Subagents**:
- **`frontend`**: Frontend & UI/UX (React, Next.js App Router, Tailwind, Remotion, UI/UX Pro Max).
- **`backend`**: Backend & Systems (REST/GraphQL APIs, Auth patterns, PostgreSQL/SQLite, Go, Kotlin, TypeScript).
- **`quality`**: Testing, Debugging & QA (Systematic debugging, TDD, profiling, Web Vitals, Security audits).
- **`architecture`**: Architecture & Planning (Socratic brainstorming, Excalidraw diagrams, Graphify, Vercel deployments).
- **`academic`**: Academic & Assignment Suite (Thesis structuring, literature reviews, CS lab reports, IEEE/APA citations, rubric auditing).
- **`marketing`**: Product Launch & Growth (Product Hunt/Show HN playbooks, copywriting, social media distribution, technical SEO).
- **`research`**: Deep vault and document retrieval, Google Drive search, knowledge synthesis.
- **`coding`**: General code inspection and refactoring.
- **`productivity`**: Calendar, daily briefings, agenda planning, loose ends.
- **`memory`**: Persistent SQLite memories and Obsidian vault lookup.
- **`communications`**: Gmail correspondence and email drafting.

---

## Verification & Quality Gates

JARVIS enforces strict quality gates on every commit. The codebase maintains 100% test coverage for core paths:

```powershell
# Run the full unit and integration test suite (100 files, 612 tests)
npm test

# Run code style & linting checks (ESLint 9)
npm run lint

# Run strict TypeScript compiler checks
npm run typecheck

# Build the production Turbopack bundle
npm run build
```

### Live Runtime Verification Suite

To verify the live backend against the running Hermes API server, local voice engines, and disk storage:

```powershell
# Verify live Hermes client health, capabilities, and auth rejection
npx tsx scripts/verify-hermes-live.ts

# Verify end-to-end multi-step tool execution, confirmation, and on-disk verification
npx tsx scripts/verify-phase3-live.ts
```

*Verification Results (Verified 2026-09-22):*
- `[Check 0]`: Hermes toolsets pinned (`web`, `session_search`, `clarify` active; `terminal` & `execute` disabled).
- `[Test 1]`: Conversational greeting answered successfully.
- `[Test 2]`: Multi-turn context and memory continuity preserved.
- `[Test 3]`: Read tool (`get_current_time`) executed and formatted.
- `[Test 4]`: Request cancellation via `AbortSignal` safely handled.
- `[Test 5]`: Provider configuration failure gracefully caught.
- `[Test 6]`: Write tool proposal intercepted by human confirmation gate.
- `[Test 7]`: Post-write note created and verified on disk within vault containment.

---

## Getting Started

### 1. Prerequisites
- **Node.js**: `v24.19.0+`
- **Python**: `3.10+` (for Hermes API Server and local Kokoro/Whisper voice runtime)
- **Git**: For version control

### 2. Installation
```powershell
git clone https://github.com/SamJU25/Jarvis-personal-assistant.git
cd Jarvis-personal-assistant
npm install
```

### 3. Environment Setup
Create a `.env.local` file in the root directory (refer to `.env.example`):

```env
# Agent Provider
JARVIS_PROVIDER=hermes

# Hermes API Server
HERMES_API_URL=http://127.0.0.1:8642
HERMES_API_KEY=your-hermes-api-key-32ch-min
HERMES_TIMEOUT_MS=60000

# Local Ollama Fallback
JARVIS_OLLAMA_BASE_URL=http://localhost:11434
JARVIS_OLLAMA_MODEL=qwen3.5:4b
JARVIS_OLLAMA_KEEP_ALIVE=15m
JARVIS_OLLAMA_THINK=false

# Obsidian Vault Path
OBSIDIAN_VAULT_PATH=F:\Your\Obsidian\Vault

# Google Workspace CLI
JARVIS_GWS_EXECUTABLE=gws

# Local Voice Services
JARVIS_WHISPER_BASE_URL=http://127.0.0.1:8080
JARVIS_WHISPER_LANGUAGE=en
JARVIS_KOKORO_BASE_URL=http://127.0.0.1:8880
JARVIS_KOKORO_MODEL=kokoro
JARVIS_KOKORO_VOICE=am_adam
JARVIS_KOKORO_SPEED=1.0
```

### 4. Running the Local Services

#### Local Voice Subsystem (Whisper + Kokoro)
```powershell
.\.jarvis\voice\runtime\start-voice.ps1
```
- Whisper STT Health: `http://127.0.0.1:8080/health`
- Kokoro TTS Health: `http://127.0.0.1:8880/health`

#### Hermes API Server
```powershell
cd ..\hermes-agent
.\.venv\Scripts\activate
python run_api_server_test.py
```
- Hermes Health: `http://127.0.0.1:8642/health`

#### Launch JARVIS
```powershell
# Development server:
npm run dev

# Production build & start:
npm run build
npm start
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Repository Structure

```text
f:\Jarvis\
├── Updated Prompts/              # 25-Phase implementation prompts & specifications (v11)
│   ├── MASTER_RULES.md           # Binding rules for scope, security, and verification
│   ├── UI_GUIDE.md               # Binding UX/UI live control center guidelines
│   ├── START_HERE.md             # Execution entry point
│   ├── PRE_PHASE_04_VERIFY.md    # Verification gate for Phases 1–3
│   └── PHASE_01.md - PHASE_25.md # Granular step-by-step phase specifications
├── docs/                         # Architecture, roadmap, and alignment specifications
├── public/                       # Static assets and icons
├── scripts/                      # Verification and test runners
│   ├── verify-hermes-live.ts     # Live Hermes client and capabilities verification
│   └── verify-phase3-live.ts     # End-to-end tool execution & confirmation test suite
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── api/agent/            # Agent runtime, streaming, confirmation, provider APIs
│   │   ├── api/debug/            # Diagnostic telemetry API
│   │   ├── api/memory/           # Memory inspection API
│   │   ├── api/voice/            # STT transcription and TTS synthesis endpoints
│   │   ├── debug/                # 11-stage visual pipeline debug shell
│   │   ├── settings/             # System settings & provider configuration shell
│   │   ├── layout.tsx            # Root HTML & layout
│   │   └── page.tsx              # Cinematic Assistant Shell
│   ├── components/
│   │   ├── activity/             # Timeline and live event feeds
│   │   ├── cards/                # Semantic card renderers (Email, Meeting, Doc, Note)
│   │   ├── confirmations/        # Confirmation preview card UI
│   │   ├── debug/                # Diagnostic visualizers & stage monitors
│   │   └── jarvis/               # CenterStage animated core, command bar, context rail
│   └── lib/
│       ├── agent/                # Agent runtime, prompts, and provider implementations
│       │   └── providers/        # HermesProvider, OllamaProvider, CommandCodeProvider
│       ├── confirmation/         # ConfirmationService, single-use token lifecycle
│       ├── contracts/            # Zod validation schemas & TypeScript contracts
│       ├── diagnostics/          # Telemetry service and browser sanitization
│       ├── google/               # GWS CLI wrapper, data normalizers, Google tools
│       ├── hermes/               # HermesClient, config, endpoints, error classes
│       ├── memory/               # Native SQLite store, secret filter, access policy
│       ├── obsidian/             # Vault containment, path normalization, note tools
│       ├── shell/                # State machine & shell reducer
│       ├── skills/               # Skill registry, markdown loader, semantic selector
│       ├── specialist/           # Specialist registry, delegation policy, permission containment
│       ├── tools/                # Application ToolRegistry & 17 tool definitions
│       ├── verification/         # Application-owned deterministic verification engine
│       └── voice/                # Local Whisper and Kokoro client interfaces
└── tests/                        # Vitest test suite (87 test files, 524 tests)
```

---

## Security, Privacy & Honesty Commitments

1. **Zero Secret Leaks**: Credentials, API keys, tokens, and cookies are strictly server-side and never returned to browser clients or logged. Settings inputs for credentials are write-only.
2. **Local Audio Privacy**: Microphone audio is transcribed purely in-memory. Audio streams are discarded immediately upon transcription. No microphone recordings are ever saved to disk or external cloud servers.
3. **Strict Confirmation for Side Effects**: The AI model cannot self-authorize write actions or bypass human confirmation. All file modifications, Google Docs creations, and email drafts require explicit user approval.
4. **Draft-Only Email Policy**: JARVIS is strictly prohibited from autonomously sending emails (`draft_email` only).
5. **Deterministic Verification Over Model Claims**: Model output asserting `"verified": true` is treated as unverified text. Actions are verified only through application-owned inspection of disk state, external IDs, and real filesystem artifacts.
6. **No Arbitrary Shell Execution**: Tools execute with explicit argument arrays and `shell: false`. Arbitrary terminal/code execution tools in Hermes are verified to be permanently disabled.
7. **Truthful Telemetry**: The UI never presents fake progress or hardcoded "connected" badges. If an integration is offline, it is honestly reported as `Unavailable`.

---

## License

This project is source-available under a [Non-Commercial License](LICENSE). You are free to use, modify, and share it for personal, educational, and research purposes. **Commercial use is not permitted.** See the [LICENSE](LICENSE) file for details.
