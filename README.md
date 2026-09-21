# JARVIS — Personal AI Operating Assistant

[![Tests](https://img.shields.io/badge/tests-422%20passed-brightgreen.svg)]()
[![Quality Gates](https://img.shields.io/badge/quality%20gates-lint%20%7C%20types%20%7C%20build%20passing-brightgreen.svg)]()
[![Next.js](https://img.shields.io/badge/Next.js-16.3.5%20Turbopack-black.svg)]()
[![React](https://img.shields.io/badge/React-19.2.8-blue.svg)]()
[![Node](https://img.shields.io/badge/Node.js-24.19.0-green.svg)]()
[![Local Voice](https://img.shields.io/badge/voice-Whisper%20%2B%20Kokoro%20(Local)-orange.svg)]()
[![Hermes Agent](https://img.shields.io/badge/agent-Nous%20Hermes%200.21.3-purple.svg)]()

**JARVIS** is a local-first, privacy-respecting personal AI operating assistant designed as a cinematic, high-performance command center rather than a simple chat interface. It combines multi-provider agent reasoning, a pinned tool security boundary, human confirmation gates for writes, application-owned deterministic verification, local SQLite memory, Obsidian and Google Workspace integrations, and an entirely local voice pipeline.

---

## Architecture Overview

```
                      ┌──────────────────────────────────────────────┐
                      │             JARVIS Command Shell             │
                      │  (Next.js App Router, Tailwind, Framer Mot)  │
                      └──────────────────────┬───────────────────────┘
                                             │
                       User Input (Typed or Voice Transcribed)
                                             │
                                             ▼
                      ┌──────────────────────────────────────────────┐
                      │              AgentRuntime (Server)           │
                      │  - Skill Selection & Workflow Orchestration  │
                      │  - Untrusted Memory & Context Injection      │
                      │  - Multi-Turn Conversation History Formatter │
                      │  - Deterministic Fast-Path (<10ms Queries)   │
                      └──────────────────────┬───────────────────────┘
                                             │
                       Selectable Reasoning Provider Boundary
                                             │
          ┌──────────────────────────────────┼──────────────────────────────────┐
          ▼                                  ▼                                  ▼
┌──────────────────┐               ┌──────────────────┐               ┌──────────────────┐
│  HermesProvider  │ (Default)     │  OllamaProvider  │ (Fallback)    │CommandCodeProvide│
│  - Hermes API    │               │  - Local Ollama  │               │  - Headless Node │
│  - Runs/SSE API  │               │  - qwen3.5:4b    │               │  - Non-interact. │
│  - Session Track │               │  - Native Tools  │               │  - Plan Permiss. │
│  - Pinned Tools  │               │  - GPU/CPU Accel │               │  - Bounded Conv. │
└─────────┬────────┘               └─────────┬────────┘               └─────────┬────────┘
          │                                  │                                  │
          └──────────────────────────────────┼──────────────────────────────────┘
                                             │
                             Decision & Action Proposal
                                             │
                                             ▼
                      ┌──────────────────────────────────────────────┐
                      │           Tool Registry & Permissions        │
                      │  - 17 Typed JarvisTool Specifications        │
                      │  - Read Operations: Direct Execution         │
                      │  - Write Operations: Intercepted & Gated     │
                      └──────────────────────┬───────────────────────┘
                                             │
                                 Is Action a Write Operation?
                                       /           \
                                 [YES]               [NO]
                                   /                   \
                                  ▼                     ▼
          ┌─────────────────────────────────┐   ┌──────────────────────────────┐
          │     Human Confirmation Gate     │   │     Direct Tool Execution    │
          │  - Single-use Token Generation  │   │  - Obsidian Read / Search    │
          │  - 60s TTL Expiry Replay Reject │   │  - Gmail / Calendar / Drive  │
          │  - Dual Approval (UI Card/Voice)│   │  - Local Memory Search/Read  │
          │  - Strict Draft-Only for Email  │   │  - System Time & Demo Tools  │
          └────────────────┬────────────────┘   └──────────────┬───────────────┘
                           │ Approved                          │
                           ▼                                   │
          ┌─────────────────────────────────┐                  │
          │     Execute Write Operation     │                  │
          │  - create_note                  │                  │
          │  - create_google_doc            │                  │
          │  - draft_email                  │                  │
          └────────────────┬────────────────┘                  │
                           │                                   │
                           └─────────────────┬─────────────────┘
                                             │
                                             ▼
                      ┌──────────────────────────────────────────────┐
                      │         Formal Verification Registry         │
                      │  - Application-Owned Empirical Checks        │
                      │  - On-Disk Containment & fs.stat Validation  │
                      │  - Document ID & Live Draft Validation       │
                      │  - Model Claims ("verified": true) REJECTED  │
                      └──────────────────────┬───────────────────────┘
                                             │
                                  Task Lifecycle Complete
                                             │
                                             ▼
                      ┌──────────────────────────────────────────────┐
                      │     Diagnostic & Observability Engine        │
                      │  - 8-Stage Lifecycle Telemetry Pipeline      │
                      │  - Redaction of Keys, Tokens, Paths, Audio   │
                      │  - Accurate performance.now() Stage Timings  │
                      │  - Non-Blocking Local TTS Speech Synthesis   │
                      └──────────────────────────────────────────────┘
```

---

## Core Capabilities

### 1. Multi-Provider Agent Architecture
- **Hermes Agent (`HermesProvider`)**: Primary agent runtime connecting to the checked-out official Nous Research Hermes API Server (`v0.21.3`) at `http://127.0.0.1:8642`. Supports the Runs API (`POST /v1/runs`), Chat Completions, Responses API, session tracking via `X-Hermes-Session-Id`, and live `AbortSignal` cancellation.
- **Local Ollama (`OllamaProvider`)**: High-performance local reasoning provider connecting directly to Ollama at `http://localhost:11434` with `qwen3.5:4b` (or custom models). Automatically discovered and serves as an instant fallback when Hermes is offline.
- **Command Code (`CommandCodeProvider`)**: Headless Command Code provider using plan permissions in a bounded conversation loop.
- **Runtime Provider Switching**: Change the active provider via `.env.local` (`JARVIS_PROVIDER`), settings API (`/api/agent/provider`), or the settings interface.

### 2. Pinned Hermes Tool Safety Boundary
To prevent autonomous agents from running unrestricted destructive commands, Hermes's API-server toolset is pinned and strictly enforced:
- **Enabled (Read-Oriented Only)**: `web`, `clarify`, `session_search`
- **Disabled (Zero Host Risk)**: `terminal`, `code_execution`, `file`, `computer_use`, `delegation`
- **Runtime Enforcement**: Automatically verified via authenticated `GET /v1/toolsets` before execution.

### 3. Application-Owned Write Actions & Human Confirmation
- **Strict Human-in-the-Loop**: The agent cannot execute writes autonomously or claim prior approval.
- **Supported Write Operations**:
  - `create_note`: Obsidian note creation with vault path containment.
  - `create_google_doc`: Google Drive document creation via safe GWS CLI.
  - `draft_email`: Gmail draft creation only. **Sending emails is strictly forbidden.**
- **Replay Protection**: Cryptographic confirmation tokens (`conf-...`) feature single-use atomic consumption and a 60-second Time-To-Live (TTL).
- **Dual Approval Modalities**: Users can confirm or cancel through visual Confirmation Preview Cards in the UI or natural voice commands ("confirm", "proceed", "cancel").

### 4. Deterministic Formal Verification
- **Evidence Over Assertions**: The system never accepts model claims (e.g. `"verified": true` or `"note created"`) as proof.
- **Deterministic Strategies**:
  - `CreateNoteVerificationStrategy`: Validates on-disk file existence via `fs.stat`, verifies vault containment without path traversal, and confirms content integrity.
  - `CreateGoogleDocVerificationStrategy`: Verifies non-empty document IDs, title matches, and safe URL schemes.
  - `DraftEmailVerificationStrategy`: Validates draft-only existence in Gmail and rejects sent messages.
- **Task Lifecycle**: Formal state progression (`queued` → `planning` → `executing` → `waiting_for_approval` → `verifying` → `completed` | `failed` | `cancelled`).

### 5. 100% Local Voice Pipeline
- **Speech-to-Text (STT)**: Local Whisper (`whisper.cpp` high-performance server) on `http://127.0.0.1:8080` with the `ggml-base.en.bin` model.
- **Text-to-Speech (TTS)**: Local Kokoro FastAPI server on `http://127.0.0.1:8880` utilizing the `am_adam` male voice (`kokoro-v0_19.onnx`).
- **Privacy First**: Audio is processed entirely in memory. Raw audio is never saved to disk or persistent storage.
- **Real-Time Barge-In**: User speech interrupts assistant voice playback instantly and resets the visual core to listening state.
- **Zero Cloud APIs**: No dependencies on ElevenLabs, OpenAI Audio, or cloud services.

### 6. Persistent Local Memory
- **Native SQLite Store**: Cross-session persistent storage using Node.js built-in `node:sqlite` (`.jarvis/memory.db`).
- **Secret Rejection**: Automatic regex and entropy scanning rejects passwords, private keys, and API tokens before storage.
- **Explicit Authorization**: Casual conversation is never silently stored. Writes require explicit user intent ("Remember that...", "Store this...").
- **Bounded Context Injection**: Top semantic matches (max 5 items, 2,000 characters) are retrieved and injected as untrusted reference context.

### 7. Integrations
- **Obsidian Vault**: Local Markdown vault search, note reading, and note creation with strict directory traversal protection.
- **Google Workspace (GWS CLI)**: Server-side execution layer invoking Google Workspace CLI (`search_gmail`, `read_gmail`, `get_calendar_events`, `search_drive`, `read_drive_file`, `create_google_doc`, `draft_email`) with `shell: false` argument pinning. External content is strictly treated as untrusted data.
- **Skills System**: 5 core reusable workflows: `meeting-prep`, `morning-briefing`, `capture-note`, `research`, and `loose-ends`.

### 8. Observability & Debug Shell (`/debug`)
- **8-Stage Pipeline**: Real-time visualization of `RUN` → `PROVIDER` → `SKILL` → `TOOLS` → `CONFIRMATION` → `VERIFICATION` → `VOICE` → `FINAL RESULT`.
- **Sanitization Barrier**: Server-side redactor strips Bearer tokens, passwords, absolute disk paths, raw GWS commands, and audio data from telemetry.
- **Read-Only**: Debug shell cannot trigger side-effects, mutate state, or bypass security boundaries.

---

## Verified Environment

Tested and verified on Windows 11 with:
- **Node.js**: `v24.19.0`
- **npm**: `11.17.0`
- **Next.js**: `16.3.5` (Turbopack)
- **React**: `19.2.8`
- **TypeScript**: `5.x`
- **Python**: `3.11.16` (in `.jarvis/voice/kokoro/.venv` and `f:\hermes-agent\.venv`)
- **Ollama**: `v0.5.x+` with model `qwen3.5:4b`
- **Hermes Agent**: `0.21.3` (Commit `5bb314f`)

---

## Getting Started

### 1. Installation

Clone the repository and install dependencies:

```powershell
git clone https://github.com/SamJU25/Jarvis-personal-assistant.git
cd Jarvis-personal-assistant
npm install
```

### 2. Environment Configuration

Create a `.env.local` file in the root directory (based on `.env.example`):

```env
# Provider Configuration
JARVIS_PROVIDER=hermes
JARVIS_OLLAMA_BASE_URL=http://localhost:11434
JARVIS_OLLAMA_MODEL=qwen3.5:4b
JARVIS_OLLAMA_KEEP_ALIVE=15m
JARVIS_OLLAMA_THINK=false
JARVIS_AGENT_TIMEOUT_MS=60000

# Hermes Configuration
HERMES_API_URL=http://127.0.0.1:8642
HERMES_API_KEY=your-hermes-api-key-32ch-min
HERMES_TIMEOUT_MS=60000

# Obsidian Vault (Local server path)
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

> [!NOTE]
> `.env.local` is strictly ignored by Git to prevent leaking local paths or keys.

---

### 3. Starting Local Services

#### Local Voice Subsystem (Whisper + Kokoro)
Start both voice engines via PowerShell:

```powershell
.\.jarvis\voice\runtime\start-voice.ps1
```

To stop voice servers:
```powershell
.\.jarvis\voice\runtime\stop-voice.ps1
```

Health check endpoints:
- Whisper STT: `http://127.0.0.1:8080/health`
- Kokoro TTS: `http://127.0.0.1:8880/health`

#### Hermes API Server
In the adjacent `hermes-agent` directory:

```powershell
cd ..\hermes-agent
.\.venv\Scripts\activate
python run_api_server_test.py
```

Health check endpoints:
- Hermes Health: `http://127.0.0.1:8642/health`
- Hermes Toolsets: `http://127.0.0.1:8642/v1/toolsets`

---

### 4. Running JARVIS

Development mode:
```powershell
npm run dev
```

Production build and launch:
```powershell
npm run build
npm start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Verification & Quality Gates

JARVIS enforces strict quality gates. Every release and milestone passes all unit, integration, linting, typechecking, and live verification suites:

### Automated Test Suite
```powershell
npm run test
```
*Result: 69 test files passed, 422 unit and integration tests passing.*

### Code Quality & Types
```powershell
npm run lint         # 0 errors, 0 warnings
npm run typecheck    # 0 TypeScript compilation errors
npm run build        # Successful Next.js 16 Turbopack production build
```

### Live Runtime Verification
Verify all 7 end-to-end runtime operations against the real Hermes API server and local Ollama:

```powershell
npx tsx scripts/verify-phase3-live.ts
```

Output:
- `[Check 0]`: Pinned Hermes toolsets verified via `GET /v1/toolsets` (Zero dangerous tools enabled).
- `[Test 1]`: Hello JARVIS conversational greeting verified.
- `[Test 2]`: Follow-up query with session context continuity verified.
- `[Test 3]`: Real read task execution (`get_current_time`) verified.
- `[Test 4]`: Request cancellation via `AbortSignal` verified.
- `[Test 5]`: Provider failure handling and graceful degradation verified.
- `[Test 6]`: Write tool proposal human confirmation token creation verified.
- `[Test 7]`: Post-write empirical verification on disk passed.

---

## Project Structure

```text
f:\Jarvis\
├── .agents/                      # Agent workflow configurations & skills
├── .commandcode/                 # Command Code runtime metadata
├── .env.example                  # Secret-free environment template
├── .gitignore                    # Strict exclusions for databases, models, envs
├── .jarvis/                      # Local storage and voice runtime
│   ├── memory.db                 # Local SQLite database (ignored by git)
│   └── voice/                    # Offline voice subsystem
│       ├── kokoro/               # Kokoro TTS server & ONNX models
│       ├── whisper/              # Whisper.cpp binary & GGML models
│       └── runtime/              # start-voice.ps1 & stop-voice.ps1
├── docs/                         # Architecture, roadmap, security docs
├── public/                       # Static public assets
├── scripts/                      # Verification and test runners
│   └── verify-phase3-live.ts     # End-to-end live runtime verification suite
├── skills/                       # Skill markdown workflow definitions
│   ├── capture-note/
│   ├── loose-ends/
│   ├── meeting-prep/
│   ├── morning-briefing/
│   └── research/
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── api/                  # Server-side API routes
│   │   │   ├── agent/            # /api/agent, /confirm, /provider, /status
│   │   │   ├── debug/            # /api/debug
│   │   │   ├── memory/           # /api/memory
│   │   │   └── voice/            # /api/voice/* (transcribe, synthesize)
│   │   ├── debug/                # Enhanced Debug Shell UI
│   │   ├── settings/             # Settings Shell UI
│   │   ├── layout.tsx            # Application root layout
│   │   └── page.tsx              # Homepage / Cinematic Shell
│   ├── components/
│   │   ├── activity/             # Activity stream & timeline components
│   │   ├── cards/                # Semantic card renderers (Email, Meeting, Doc)
│   │   ├── confirmations/        # Confirmation preview card UI
│   │   ├── debug/                # Pipeline stages & telemetry visualizers
│   │   └── jarvis/               # Animated core, command bar, context rail
│   └── lib/
│       ├── agent/                # AgentRuntime, prompts, providers
│       │   └── providers/        # HermesProvider, OllamaProvider, CommandCodeProvider
│       ├── confirmation/         # ConfirmationService, single-use token logic
│       ├── contracts/            # Zod contracts & type definitions
│       ├── diagnostics/          # DiagnosticService, sanitization boundary
│       ├── google/               # GWS CLI wrapper, normalizers, tools
│       ├── hermes/               # HermesClient, config, error hierarchy
│       ├── memory/               # SQLite memory store, policy, secret rejection
│       ├── obsidian/             # Vault containment, path resolution, tools
│       ├── shell/                # State machine & shell reducer
│       ├── skills/               # Skill registry, loader, selector
│       ├── tools/                # Application ToolRegistry & definitions
│       ├── verification/         # Deterministic verification strategies
│       └── voice/                # Whisper & Kokoro audio client wrappers
└── tests/                        # Comprehensive test suite (422 tests)
```

---

## Security & Privacy Commitments

1. **Local-First & Offline Privacy**: All microphone audio is transcribed locally via Whisper, processed in memory, and immediately cleared. No recordings or voice transcripts are transmitted to external clouds.
2. **Credential & Secret Protection**: Persistent memory automatically scans and rejects API keys, passwords, and private certificates. Diagnostics redact all credentials, absolute paths, and system commands.
3. **No Unconfirmed Writes**: Autonomously modifying files, creating Google Docs, or drafting emails without explicit human approval is strictly prevented by architectural design.
4. **No Arbitrary Shell Execution**: The application interacts with external integrations exclusively via explicit argument arrays with `shell: false`. Arbitrary model-directed bash/terminal commands are completely disabled.
5. **Truthful Telemetry**: The UI never fabricates success. If an integration or service is unavailable, it honestly displays its real operational status.

---

## License

Private repository. All rights reserved.
