# JARVIS — Personal AI Operating Assistant

[![Tests](https://img.shields.io/badge/tests-422%20passed-brightgreen.svg)](https://github.com/SamJU25/Jarvis-personal-assistant)
[![Quality Gates](https://img.shields.io/badge/quality%20gates-lint%20%7C%20types%20%7C%20build%20passing-brightgreen.svg)](https://github.com/SamJU25/Jarvis-personal-assistant)
[![Next.js](https://img.shields.io/badge/Next.js-16.3.5%20Turbopack-black.svg)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2.8-blue.svg)](https://react.dev/)
[![Node](https://img.shields.io/badge/Node.js-24.19.0-green.svg)](https://nodejs.org/)
[![Local Voice](https://img.shields.io/badge/voice-Whisper%20%2B%20Kokoro%20(Local)-orange.svg)](https://github.com/SamJU25/Jarvis-personal-assistant)
[![Hermes Agent](https://img.shields.io/badge/agent-Nous%20Hermes%200.21.3-purple.svg)](https://github.com/NousResearch/hermes-agent)

**JARVIS** is a local-first, privacy-respecting personal AI operating assistant and live control center. Designed as an ambient, cinematic command surface rather than a generic chat window, JARVIS combines agentic reasoning (Nous Hermes 0.21.3), a pinned tool security boundary, human confirmation gates for writes, application-owned deterministic verification, local voice (Whisper + Kokoro), and bi-directional integration with personal data stores (Obsidian and Google Workspace).

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
│   - Context management & summarization   - Specialist child delegations     │
└───────────────────────┬─────────────────────────────┬───────────────────────┘
                        │                             │
        Inference Path  ▼                             ▼  Capability Call
┌──────────────────────────────┐       ┌──────────────────────────────────────┐
│       FreeLLMAPI Gateway     │       │    JARVIS Governed Capability &      │
│  - model=auto routing        │       │           Policy Boundary            │
│  - Unified client auth       │       │  - Application ToolRegistry          │
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
│  - Draft-only email creation (send forbidden)    │   │  - Demo Tools & System Time  │
└─────────────────────────┬────────────────────────┘   └──────────────┬───────────────┘
                          │ Approved                                  │
                          ▼                                           │
┌──────────────────────────────────────────────────┐                  │
│             Execute Write Capability             │                  │
│  - create_note (Obsidian Vault Containment)      │                  │
│  - create_google_doc (Safe Google Workspace CLI) │                  │
│  - draft_email (Gmail Draft Only via GWS CLI)    │                  │
└─────────────────────────┬────────────────────────┘                  │
                          │                                           │
                          └─────────────────────┬─────────────────────┘
                                                │
                                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Formal Verification Registry                             │
│   - Application-owned empirical post-execution verification                 │
│   - Deterministic disk containment, stat inspection, and ID validation      │
│   - Model claims ("verified": true) strictly rejected as evidence           │
└───────────────────────────────────────┬─────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      Diagnostic & Observability Engine                      │
│   - 8-stage lifecycle telemetry pipeline (Run -> Provider -> Skill -> ...)  │
│   - Strict browser sanitization (redacting tokens, paths, audio, shell)     │
│   - performance.now() stage timing & latency profiling                      │
│   - Non-blocking local Kokoro TTS audio synthesis                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 25-Phase Master Roadmap & Status

JARVIS is built under a rigorous, 25-phase evolutionary engineering roadmap (v11 specification). Each phase enforces strict boundaries, zero architectural drift, comprehensive automated tests, and live hardware verification before proceeding.

### Completed Phases (Phases 1–3)

| Phase | Milestone | Status | Key Deliverables & Verified Behavior |
|---|---|---|---|
| **Phase 01** | **Clean Responsive Shell & Foundation** | **COMPLETED** | Removed all legacy Phase 1 sample/mock UI content; unified `JarvisShell` state machine; responsive desktop/mobile layouts; core animated visualizer; command bar and context rail seams. |
| **Phase 02** | **Hermes Provider Foundation** | **COMPLETED** | Direct server-side integration with Nous Hermes Agent API (v0.21.3); `HermesClient` with Bearer auth; health probes (`/health`, `/health/detailed`); capability discovery (`/v1/capabilities`); session continuity tracking. |
| **Phase 03** | **Pinned Tool Security Boundary & Registry** | **COMPLETED** | 17 typed `JarvisTool` specifications with Zod schemas; strict separation between read tools and write tools; 60s TTL single-use human confirmation tokens; application-owned deterministic verification strategies; verified that dangerous Hermes toolsets (terminal, code execution, unrestricted fs) remain pinned and disabled. |

---

### In Progress / Upcoming Phases (Phases 4–25 Tasks)

| Phase | Milestone | Objective & Scope |
|---|---|---|
| **Phase 04** | **Hermes Core + Obsidian + Real-Time UI/Event Foundation** | **ACTIVE NEXT** • Hermes becomes the authoritative agent core owning the reasoning loop and multi-step tool calls via `/v1/runs`. Migrates durable memory to Obsidian (`AI/Memory/`) and skills to Obsidian (`AI/Skills/`). Implements server-side SSE event bus and reactive UI state without dual-turn TS loop. |
| **Phase 05** | **Hermes + FreeLLMAPI + Functional Settings** | Connects Hermes to FreeLLMAPI gateway for automatic upstream model routing (`model=auto`). Implements functional settings UI backed by real backend snapshots (`GET /api/settings/snapshot`) and SSE (`GET /api/settings/events`) with write-only key management. |
| **Phase 06** | **Capability Registry + Policy + Trace + Idempotency** | Consolidates all tools into a unified Capability Registry with explicit execution policies, distributed trace correlation, and idempotent run submission. |
| **Phase 07** | **Intent + Alias Registry** | High-speed deterministic accelerator and safety-sensitive intent router for common command shortcuts without invoking redundant LLM reasoning. |
| **Phase 08** | **Specialist Agent Orchestration** | Enables Hermes child agent delegations and specialist sub-agents for parallel tasks under strict parent supervision. |
| **Phase 09** | **Google Workspace Consolidation** | Hardened, production-ready Gmail, Google Calendar, and Google Drive integrations via safe GWS CLI execution (`shell: false`) with strict input sanitization. |
| **Phase 10** | **Web Research + Provenance** | Grounded web search tools with source citation extraction, snippet provenance, and strict external content isolation. |
| **Phase 11** | **Advanced Obsidian Memory Retrieval** | Semantic memory search, memory graph navigation, bi-directional link traversal, and associative recall directly inside the Obsidian vault. |
| **Phase 12** | **Obsidian Skills + Controlled Learning** | Dynamic skill discovery from `AI/Skills/` using native Hermes `SKILL.md` format, enabling user-inspectable and editable skills. |
| **Phase 13** | **File + Document Intelligence** | Server-side document analysis, text/PDF extraction, and contextual document summarization within safe vault paths. |
| **Phase 14** | **Voice Experience v2 + Low-Latency Streaming** | Real-time speech-to-text streaming, sentence chunking with concurrent TTS overlap, focus-aware Space hold-to-talk (PTT), and sub-500ms time-to-first-audio. |
| **Phase 15** | **Scheduler + Proactive Assistant** | In-memory cron/timer scheduling engine, morning briefings, calendar reminders, and proactive background task notifications. |
| **Phase 16** | **Multimodal Vision** | Local multimodal image analysis, desktop screenshot inspection, and visual reasoning without cloud dependencies. |
| **Phase 17** | **Browser Automation + Media Playback** | Safe, bounded browser automation actions and YouTube playback control through dedicated, isolated browser sessions. |
| **Phase 18** | **Basic App + Communication Actions** | Desktop application launching, window focus control, system shortcuts, and local messaging primitives. |
| **Phase 19** | **Windows Computer Control & Sandbox** | Governed, sandboxed Windows system interaction with strict permission checks and rollback safeguards. |
| **Phase 20** | **Remote Channels (Telegram First)** | Telegram bot and remote messaging channel integration reusing the exact same unified JARVIS/Hermes runtime core. |
| **Phase 21** | **Undo / Recovery / Idempotency Expansion** | Comprehensive undo system for safe reversible operations, vault snapshots, and transactional action recovery. |
| **Phase 22** | **Mark-LIV-Inspired Cinematic Experience Layer** | Cinematic audiovisual animations, dynamic state visualizers, responsive audio reactive waveforms, and ambient HUD elements. |
| **Phase 23** | **Plugin / Extension Lifecycle Manager** | Declarative plugin management system for installing, enabling, disabling, and isolating third-party capabilities safely. |
| **Phase 24** | **JARVIS Control Center + Live Settings** | Full live control center with real-time health grid, capability toggles, memory visualizer, and live telemetry inspector. |
| **Phase 25** | **Final Preflight / Security / Performance / Regression** | Complete system security audit, OWASP review, latency profiling, stress testing, and final release hardening. |

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

### 3. Pinned Tool Security & Safe Capability Boundary
- **17 Registered Tools**: Obsidian vault operations (`search_vault`, `read_note`, `create_note`), Google Workspace (`search_gmail`, `read_gmail`, `get_calendar_events`, `search_drive`, `read_drive_file`, `create_google_doc`, `draft_email`), Memory (`search_memory`, `store_memory`, `list_memory`, `delete_memory`), and System tools (`get_current_time`, `search_demo_data`, `read_demo_item`).
- **Read/Write Partitioning**: Read operations execute autonomously; write operations (`create_note`, `create_google_doc`, `draft_email`) are intercepted before execution.
- **Drafts Only**: Email actions are strictly limited to `draft_email`. Sending emails is prevented by design.
- **Pinned Toolsets**: Hermes API server is verified on launch to ensure dangerous capabilities (`terminal`, `code_execution`, `raw_file_write`) are disabled.

### 4. Human Confirmation & Deterministic Verification
- **Single-Use Tokens**: Every write proposal generates a cryptographic token with a 60-second TTL. Replays and duplicate consumptions are blocked.
- **Dual Approval Channels**: Confirmations can be approved via UI Confirmation Cards or spoken voice intent ("yes, proceed", "confirm").
- **Deterministic Post-Execution Verification**: Model claims ("verified: true") are strictly ignored. Writes are verified by empirical application logic:
  - Notes: File existence and size checked on disk within canonical vault path.
  - Google Docs: Valid document ID and URL verified from GWS CLI output.
  - Emails: Confirmed as a draft in Gmail.

---

## Verification & Quality Gates

JARVIS enforces strict quality gates on every commit. The codebase maintains 100% test coverage for core paths:

```powershell
# Run the full unit and integration test suite (69 files, 422 tests)
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
│   │   ├── debug/                # 8-stage visual pipeline debug shell
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
│       ├── tools/                # Application ToolRegistry & 17 tool definitions
│       ├── verification/         # Application-owned deterministic verification engine
│       └── voice/                # Local Whisper and Kokoro client interfaces
└── tests/                        # Vitest test suite (69 test files, 422 tests)
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

Private repository. All rights reserved.
