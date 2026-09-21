# JARVIS

JARVIS is a local-first personal AI operating assistant. This repository implements **Phase 12: Reliability and Polish** (Phases 1 through 11 preserved and reused).

The interface is a cinematic command center rather than a chatbot. It includes a state-driven JARVIS core, system context, activity/results/sources, a command surface, settings, and a development-only debug shell.

## Current environment

Verified on Windows with:

- Node.js 24.19.0
- npm 11.17.0
- Git 2.55.0
- Windows PowerShell 5.1
- Next.js 16.3.5
- React 19.2.8

Command Code is used to provide the headless agent provider runtime. The JARVIS app launches Command Code directly via `node` + its entry point — never through a shell. See `docs/ARCHITECTURE.md` and `docs/SECURITY.md` for the security boundaries.

## Run locally

```powershell
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment configuration

Create `.env.local`:

```env
# Phase 2: Agent Provider
JARVIS_COMMAND_CODE_ENTRY=C:\path\to\node_modules\command-code\dist\index.mjs

# Phase 4: Obsidian Integration (server-side only, never exposed to browser)
OBSIDIAN_VAULT_PATH=C:\path\to\your\ObsidianVault
```

- **Command Code Provider:** Without `JARVIS_COMMAND_CODE_ENTRY`, `/api/agent/status` reports provider as unavailable.
- **Obsidian Vault:** Without `OBSIDIAN_VAULT_PATH`, Obsidian status reports `Not configured`. When configured and valid, it reports `Available`. If the path does not exist or points to a non-directory, it reports `Unavailable` or `Invalid configuration`. The absolute vault path is never exposed to the client.

Useful commands:

```powershell
npm run test
npm run lint
npm run typecheck
npm run build
npm start
```

## What is implemented

- **Phase 1 (Visual Shell):** Cinematic JARVIS core with 7 visual states, responsive layout, trusted semantic card renderers, settings shell, and development debug shell (`/debug`).
- **Phase 2 (Agent Provider):** Server-side headless provider boundary, streaming NDJSON parser, Zod output validation, timeout, cancellation (abort), and truthful status.
- **Phase 3 (Tool Registry & Execution Loop):** Generic application-owned `ToolRegistry`, typed `JarvisTool` contracts, schema validation, permission boundaries (`read` vs `write`), tool execution lifecycle events, and real `executing` UI state.
- **Phase 4 (Obsidian Integration):** Server-side vault configuration (`OBSIDIAN_VAULT_PATH`), canonical path containment (prevents `../`, symlinks escaping), `search_vault`, `read_note`, and safe `create_note` write definition.
- **Phase 5 (Runtime Skill/Process System):**
  - **Tools vs. Skills Distinction:** Tools define *what* JARVIS can do; skills define *how* JARVIS combines tools and reasoning for recurring workflows.
  - **Automatic Skill Selection:** `selectSkill()` evaluates semantic intent naturally.
  - **Five Core Skills (`skills/<id>/SKILL.md`):** `meeting-prep`, `morning-briefing`, `capture-note`, `research`, and `loose-ends`.
- **Phase 6 (Google Workspace Integration):**
  - **Safe GWS CLI Execution:** Server-side execution layer invoking the system's authenticated GWS CLI (`JARVIS_GWS_EXECUTABLE`) using fixed argument arrays, `shell: false`, timeout bounding, and error sanitization.
  - **Five Read-Only Tools:** `search_gmail`, `read_gmail`, `get_calendar_events`, `search_drive`, and `read_drive_file` registered through `ToolRegistry`.
  - **Untrusted Content Handling:** All email, calendar, and drive content is treated strictly as data. Injected instructions can never alter system prompts or escalate permissions.
  - **Skill Upgrades:** Skills now leverage real Google Workspace data (meeting prep queries calendar/email/drive, morning briefing inspects schedules/inbox, research scans Drive docs, loose-ends checks follow-ups).
  - **Truthful Status:** Health checks report `Available`, `Not configured`, `Unauthenticated`, or `Unavailable` without leaking paths or tokens.
- **Phase 7 (Persistent Memory):**
  - **Local-First SQLite Storage:** Persistent cross-session store using Node.js native `node:sqlite` (`.jarvis/memory.db`). Zero external npm dependencies.
  - **Four Semantic Memory Tools:** `search_memory` (`read`), `list_memory` (`read`), `store_memory` (`memory`), and `delete_memory` (`memory`).
  - **Explicit Authorization Guardrails:** Casual conversation ("The weather is nice") cannot silently store memories. Only explicit user intent ("Remember that...", "Forget that...") permits writes.
  - **Secret & Credential Rejection:** Passwords, API keys (OpenAI, GitHub, AWS, Google), private cryptographic keys, and tokens are scanned and rejected before storage.
  - **Bounded Context Injection:** Relevant memories are retrieved (max 5 items, 2,000 characters) and injected into agent instructions under an untrusted `[MEMORY CONTEXT]` block.
  - **Inspection API & UI:** Server-side `/api/memory` endpoint and settings/debug panels for inspecting and deleting stored memories.
- **Phase 7.5 (Local Ollama Provider):**
  - **Second Selectable Provider:** Local Ollama running alongside Command Code under the unified `AgentProvider` contract (`src/lib/agent/providers/ollama-provider.ts`).
  - **Provider Independence:** The rest of JARVIS (AgentRuntime, ToolRegistry, all 15 tools, skills, memory, Obsidian, Google Workspace, StructuredResult) does not care which reasoning provider is active.
  - **Local-Only & Zero Cloud Accounts:** Connects strictly to local Ollama (`JARVIS_OLLAMA_BASE_URL`, default `http://localhost:11434`).
  - **Model Auto-Discovery & Health:** Discovers installed models via `/api/tags` and reports truthful status (`Available`, `Model unavailable`, `Unavailable`).
  - **Tool-Calling Adapter:** Normalizes native Ollama `tool_calls` and JSON tool calls into `AgentDecision` structures.
  - **Active Provider Management:** Switchable via `JARVIS_PROVIDER` or Settings UI (`/api/agent/provider`).
- **Phase 8 (Fully Local Voice):**
  - **100% Local & Offline-Capable Voice:** Local Whisper/whisper.cpp for speech-to-text (STT) and local Kokoro for text-to-speech (TTS). Zero cloud voice APIs, zero API keys, and zero external dependencies (no ElevenLabs).
  - **Project-Local Runtime Isolation:** Entire voice subsystem resides inside `.jarvis/voice/` (`whisper/`, `kokoro/`, `models/`, `runtime/`, `logs/`). Model files (`ggml-base.en.bin`, `kokoro-v0_19.onnx`, `voices-v1.0.bin`) are intentionally kept outside Git.
  - **Single Startup/Stop Workflows:** `.jarvis/voice/runtime/start-voice.ps1` and `stop-voice.ps1` launch and terminate local voice servers with health verification.
  - **Unified Reasoning Seam:** Voice input is strictly an interface layer. Both typed text and committed voice transcripts route through the identical `submitAgentRequest(message)` seam into `AgentRuntime` and the existing tools, skills, memory, and reasoning providers.
  - **Mandatory Real-Time Barge-In:** Immediate interruption of speaking turns cancels active TTS synthesis and playback, switches state to `listening`, and discards stale audio.
  - **Ephemeral Audio Privacy:** Audio captures are processed in memory only and discarded immediately after transcription; no recordings are persisted to disk or database.
  - **Voice Endpoints & Truthful Status:** `/api/voice/status`, `/api/voice/transcribe`, and `/api/voice/synthesize` reporting truthful status for Whisper, Kokoro, microphone, and speaker.
  - **Accessible Microphone Control:** Accessible mic toggle button with active listening pulse, speaking hints, and full keyboard navigation.

- **Phase 9 (Write Actions and Human Confirmation):**
  - **Application-Owned Confirmation Flow:** Intercepts write tool proposals (`create_note`, `create_google_doc`, `draft_email`). The reasoning model can only propose a write — it cannot authorize execution, claim prior approval, or bypass confirmation.
  - **Confirmation Service & Replay Protection:** Thread-safe singleton `ConfirmationService` managing pending confirmations with single-use atomic consumption (`pending` -> `consumed`), 60-second TTL expiry, and replay rejection (HTTP 409).
  - **Three Supported Write Tools:**
    - `create_note`: Obsidian note creation with directory creation and title sanitization.
    - `create_google_doc`: Google Docs creation via safe GWS CLI wrapper (`shell: false`).
    - `draft_email`: Gmail draft creation only. Strictly NO `send_email` capability exists.
  - **Dual Confirmation Channels (UI & Voice):** Visual Confirmation Preview card rendered in CenterStage with action badges, targets, previews, and accessible Confirm/Cancel buttons. Voice affirmations ("yes", "confirm", "go ahead") and cancellations ("no", "cancel", "stop") route to the confirmation boundary.
  - **Server Execution Seam:** `/api/agent/confirm` executes the exact validated parameters stored in the pending confirmation, validates outputs, and returns truthful `StructuredResult`.

- **Phase 10 (Formal Verification and Task Lifecycle):**
  - **Formal Task Lifecycle:** Explicit lifecycle progression: `queued` → `planning` → `executing` → `waiting_for_approval` → `verifying` → `completed` | `failed` | `cancelled`. Tool execution completion is strictly distinguished from task completion.
  - **Application-Owned Verification Layer:** All verification occurs in server-side application code (`src/lib/verification/`). Model natural-language assertions (e.g., `"verified": true`, `"success": true`) are rejected as proof.
  - **Strategy Pattern & VerificationRegistry:** Pluggable `VerificationStrategy` interface mapped by tool:
    - `create_note`: Checks on-disk file existence via `fs.stat()`, vault containment via `resolveVaultPath()`, and content matching.
    - `create_google_doc`: Validates normalized result for non-empty `documentId`, matching title, and safe link.
    - `draft_email`: Enforces draft-only safety constraints (strictly rejects sent messages), validates `draftId`, recipient, and subject.
    - Read tools: Direct schema and structural output verification.
  - **Bounded Execution & Stale-Run Protection:** 5,000ms bounded verification timeout, in-memory `TaskTracker`, and race protection preventing late verification results from older runs from modifying or resurrecting newer runs.
  - **Cancelled Run Preservation:** Interrupted or cancelled runs cannot be resurrected or marked completed by late tool or verification outcomes.
  - **Truthful Status & Spoken Explanations:** Verification failures transition task state to `failed` and speak truthful failure summaries ("I couldn't verify that the note was created") rather than false successes.

- **Phase 11 (Observability Expansion):**
  - **Canonical Diagnostic Model:** Zod-validated contracts (`src/lib/contracts/diagnostics.ts`) defining diagnostic levels, event types, task run states, outcomes, finite failure codes, timings, and bounded snapshots.
  - **Application-Owned Diagnostic Service:** Singleton `DiagnosticService` (`src/lib/diagnostics/service.ts`) capturing structured diagnostic events, maintaining active runs, storing bounded recent execution history (max 50 runs, FIFO eviction), maintaining recent event log (max 200 events, FIFO eviction), and recording voice transaction timings without audio persistence.
  - **Real Execution Timings:** Accurate wall-clock millisecond timing measurements (`performance.now()`) across complete runs, reasoning providers, skills, tools, confirmation delays, verification strategies, voice transcription, and voice synthesis.
  - **Finite Failure Classification:** 17 stable, application-owned failure categories (`provider_unavailable`, `tool_permission_denied`, `verification_failed`, `stale_run`, etc.) rejecting arbitrary model-invented error codes.
  - **Strict Browser Sanitization Boundary:** Server-side sanitization (`src/lib/diagnostics/sanitizer.ts`) redacting API keys, Bearer tokens, passwords, absolute filesystem paths (Windows & Unix), raw GWS commands, and raw audio before serialization to the browser.
  - **Enhanced Read-Only Debug Shell (`/debug`):** Interactive, read-only developer dashboard displaying the active 8-stage lifecycle pipeline (`RUN` → `PROVIDER` → `SKILL` → `TOOLS` → `CONFIRMATION` → `VERIFICATION` → `VOICE` → `FINAL RESULT`), live event stream with level filtering, totals metrics banner, bounded execution history, and Phase 8 voice telemetry. Strictly devoid of any state-mutating controls.

- **Phase 12 (Reliability and Polish):**
  - **Latency Optimization & Hardening:** Fixed 40+ second reasoning delay by disabling unneeded thinking tokens (`think: false`) during Turn 2 synthesis and setting keep-alive (`keep_alive: 15m`), cutting simple read latencies from ~45s to ~2.4–3.0s (~93% reduction).
  - **Deterministic Task Fast-Path:** Safe, unambiguous queries (e.g., local time queries) are detected and resolved directly via deterministic tool execution and formal verification in <10ms, eliminating redundant model round-trips.
  - **Natural Multi-Turn Conversation:** Assistant turns in conversation history are enriched with structured summaries of cards and retrieved sources (`formatAssistantTurn`), enabling seamless follow-up questions ("Summarize that in three bullets") without prompt bloat.
  - **Tool Argument Coercion & Vault Robustness:** String-to-number coercion (`z.coerce.number()`) across Obsidian, Google Workspace, and Memory tools prevents small LLM format deviations from failing execution. `readVaultNote` adds extension normalization and vault-wide basename fallback.
  - **Robust Decision Normalization:** Safe fallback for unrecognized card types into valid `generic` cards, and comprehensive mapping of model state values (`incomplete`, `done`, `pending`) to canonical lifecycle states.
  - **Voice Robustness:** Asynchronous non-blocking TTS architecture ensures speech failures never invalidate successful agent results. Real-time barge-in immediately interrupts playback.

### Local Voice Runtime Management

```powershell
# Start both Whisper STT (8080) and Kokoro TTS (8880) with health checks
.\.jarvis\voice\runtime\start-voice.ps1

# Stop local voice runtime
.\.jarvis\voice\runtime\stop-voice.ps1
```

- **Hardware Requirements:** 4+ CPU cores, 8GB+ RAM. Tested on Windows x64. Whisper and Kokoro run completely offline on CPU with minimal footprint (<350MB RAM combined).
- **Troubleshooting:**
  - If ports 8080 or 8880 are occupied, check logs in `.jarvis/voice/logs/`.
  - Check service endpoints directly: `http://127.0.0.1:8080/health` (Whisper) and `http://127.0.0.1:8880/health` (Kokoro).

## What is mocked / restricted

- Everything under `src/lib/mock/` is Phase 1 sample presentation data used only for the initial idle preview.
- Browser automation and terminal execution are not implemented.
- Email sending is strictly prohibited; only `draft_email` (creating a draft in Gmail) is supported.
- Calendar event deletion/modification is not implemented.
- Automatic write execution is blocked; every write action requires explicit human confirmation via `/api/agent/confirm`.
- Formal verification means application-level empirical verification (file existence, schema conformity, returned entity IDs); it is not a mathematical theorem prover.
- Diagnostics and observability are visibility-only; `/debug` cannot force execution, bypass confirmation, or alter permissions.
- Phase 12 (Reliability & Polish) is complete. Future phases after Phase 12 are NOT implemented. No persistent execution databases, distributed tracing, or external cloud telemetry services exist.

## Project map

- `skills/` — human and model-readable skill workflow definitions (`meeting-prep`, `morning-briefing`, `capture-note`, `research`, `loose-ends`)
- `src/app/` — App Router routes (`/`, `/settings`, `/debug`) and API endpoints (`/api/agent`, `/api/agent/confirm`, `/api/agent/provider`, `/api/agent/status`, `/api/debug`, `/api/memory`, `/api/voice/*`)
- `src/components/jarvis/` — shell orchestrator, animated core, command surface, and intelligence panel
- `src/components/debug/` — read-only debug shell, lifecycle pipeline visualizer, execution history, and event stream
- `src/components/cards/` — trusted semantic renderer registry (meeting, email, note, research, confirmation, etc.)
- `src/components/activity/` — tool, provider, and skill activity status presentation
- `src/lib/contracts/` — typed schemas and boundaries (tools, skills, results, agent API, provider, confirmation, verification, task, diagnostics)
- `src/lib/agent/` — server-side `AgentRuntime`, loop orchestration, system prompts, status inspection
- `src/lib/agent/providers/` — reasoning providers: `CommandCodeProvider`, `OllamaProvider`, transport adapters, active provider registry
- `src/lib/skills/` — skill loader, centralized `SkillRegistry`, and semantic `selectSkill`
- `src/lib/tools/` — generic application `ToolRegistry` and demo tools
- `src/lib/confirmation/` — confirmation service, TTL tracking, voice confirmation intent matching
- `src/lib/verification/` — application-owned verification registry, service, and tool-specific strategies
- `src/lib/diagnostics/` — application-owned diagnostic service, sanitization boundary, structured logger, and in-memory stores
- `src/lib/memory/` — local SQLite memory store, secret scanner, authorization policy, service, and tools
- `src/lib/obsidian/` — server-only vault config, path containment, scanner/reader, and tool definitions
- `src/lib/google/` — safe GWS CLI wrapper, normalizers, and read/write tools
- `src/lib/voice/` — fully local Whisper STT and Kokoro TTS integration, ephemeral audio handling
- `src/lib/shell/` — visual application state and reducer
- `tests/` — unit, integration, security, confirmation, verification, and diagnostics test suites

Read `JARVIS_MASTER_PROMPT.md` for the complete product vision and `AGENTS.md` for active development rules.


