# JARVIS Architecture

## Current milestone

Phase 12 — Reliability and Polish — is implemented and verified (Phases 1 through 11 preserved and reused). The visual shell, tool registry, Obsidian vault, skill subsystem, Google Workspace integration, persistent SQLite memory, dual reasoning providers, fully local voice subsystem, confirmed write actions, formal verification, and observability diagnostics are preserved; Phase 12 hardens latency (Turn 2 thinking disabled, keep-alive enabled), introduces deterministic task fast-path (<10ms for unambiguous time queries), enables natural multi-turn conversational follow-ups with card context enrichment, hardens tool argument coercion (`z.coerce.number()`), improves note reading robustness with vault-wide basename and extension fallback, hardens card/state decision normalization, and guarantees non-blocking asynchronous voice playback. Future phases beyond Phase 12 are NOT implemented.

## Application flow

```text
[Microphone Audio] (Browser AudioCaptureManager, ephemeral in-memory)
  → /api/voice/transcribe (WhisperTransport: whisper.cpp server or CLI)
    → Committed Transcript
         │
[Typed Input] (CommandBar)
         │
         ▼
submitAgentRequest(message) (Unified submission seam)
  → /api/agent (server route)
    → src/lib/agent/ (AgentRuntime + loop controller)
      → src/lib/skills/ (SkillRegistry + semantic skill selection)
      → src/lib/agent/prompt.ts (injects selected skill process + decision rules)
      → src/lib/agent/providers/ (Active Provider: CommandCodeProvider OR OllamaProvider)
        ├── CommandCodeProvider (Node subprocess, NDJSON streaming parser, stdin prompt)
        └── OllamaProvider (Local HTTP transport, /api/chat & /api/tags, tool adapter)
          ↔ tool call request (JSON payload via tool protocol)
            → src/lib/tools/ToolRegistry
              → permission check (read allowed, memory authorized, write blocked until Phase 9)
              → src/lib/obsidian/ (path containment + safe fs scanning)
              → src/lib/google/ (safe GWS CLI wrapper, shell: false, arg arrays)
              → src/lib/memory/ (SQLite persistent storage, secret scanner, explicit intent)
            ← validated ToolResult
          → validated, sanitized AgentEvent / RunResult frames
            → Zod-validated StructuredResult
              → JarvisShell reducer
                → center core + transcript
                → activity/results/sources panel
              → StructuredResult.speech
                → /api/voice/synthesize (KokoroTTSProvider: local Kokoro HTTP API)
                  → Browser Audio Playback (CoreState: speaking)
                    (Barge-in: user speech interrupts playback immediately)
```

`JarvisShell` is the single client entry point. It owns visual state with `useReducer`. Selecting a state changes the core, transcript, response, and intelligence data together. There are no timers that pretend work is happening.

## Skill subsystem (server-side only)

- **Tools vs. Skills**: Tools define *what* JARVIS can do (`search_vault`, `read_note`, `search_gmail`, `get_calendar_events`, `search_drive`). Skills define *how* JARVIS combines tools and reasoning to perform recurring tasks (`meeting-prep`, `morning-briefing`, `capture-note`, `research`, `loose-ends`).
- **Storage**: Skills are defined as Markdown files (`skills/<skill-id>/SKILL.md`) with YAML frontmatter containing `id`, `name`, `description`, `whenToUse`, `preferredTools`, and markdown sections for `Purpose`, `Process`, `Decision Rules`, and `Expected Output`.
- **Loader**: `src/lib/skills/loader.ts` reads skill definitions from disk, validates schema compliance with Zod (`skillDefinitionSchema`), and rejects malformed files or duplicate IDs.
- **Registry**: `src/lib/skills/registry.ts` manages loaded skills in memory and exposes safe metadata (`SkillMetadata`) to the agent without exposing filesystem paths.
- **Selection**: `src/lib/skills/selector.ts` performs semantic intent matching from user input, selecting the appropriate skill automatically without requiring explicit naming or slash commands.
- **Prompt Injection**: Selected skill instructions and decision rules are injected into the agent system prompt for the turn, guiding multi-step tool usage.

## Google Workspace integration boundary (server-side only)

- Executable path is controlled via `JARVIS_GWS_EXECUTABLE` (server-side only, never exposed to client). If unset, defaults to system `gws`.
- Safe command execution: strictly uses argument arrays and `shell: false`. No string concatenation of user/model input into shell commands.
- Five read-only tools:
  - `search_gmail` (`read`): searches user messages by query; returns normalized summaries.
  - `read_gmail` (`read`): retrieves specific email content by message ID; parses headers, decodes base64url body, and summarizes attachments.
  - `get_calendar_events` (`read`): fetches events in an ISO 8601 date range; validates start <= end; returns titles, times, locations, attendees, and descriptions.
  - `search_drive` (`read`): searches Google Drive files by query; returns file names, formats, owners, and links.
  - `read_drive_file` (`read`): reads Google Docs (exported as text) or plain text files; safely rejects binary media formats.
- Safe bounding & truncation: bodies, descriptions, and snippets are strictly bounded. Content exceeding limits is explicitly truncated with `[Content truncated...]`.
- Untrusted content: all data returned from Gmail, Calendar, and Drive is treated strictly as untrusted data. Prompt injections within emails or documents can never alter system instructions or escalate permissions.
- Health checks: `/api/agent/status` checks executable and auth state (`Available`, `Not configured`, `Unauthenticated`, `Unavailable`, `Invalid configuration`) without leaking paths or tokens.

## Persistent memory boundary (server-side only)

- Local-first persistence using Node.js built-in `node:sqlite` (`import { DatabaseSync } from 'node:sqlite'`). Stored on disk in `.jarvis/memory.db` (configurable via `JARVIS_MEMORY_DB_PATH`).
- Four semantic memory tools:
  - `search_memory` (`read`): keyword search over persistent memories, ranked by relevance and recency.
  - `list_memory` (`read`): inspect memories with optional category filtering (`preference`, `project`, `instruction`, `fact`, `reminder`).
  - `store_memory` (`memory`): persists deliberately requested user memory. Requires explicit authorization check (`isMemoryOperationAuthorized`).
  - `delete_memory` (`memory`): deletes a specific memory by ID. Requires explicit authorization check.
- Explicit authorization guard: casual conversation ("The meeting was long") or external content from notes/emails can NEVER silently persist or delete memories. Only explicit user intent ("Remember that...", "Forget that...") permits memory modification.
- Sensitive data & secret rejection: passwords, API keys (OpenAI, GitHub, AWS, Google), private keys, and JWTs are rejected before storage.
- Bounded context retrieval: before agent reasoning, `findRelevant()` extracts relevant memories (up to 5 items, max 2,000 characters), demarcating them in system instructions as untrusted data.
- Distinction from Obsidian & Google: Obsidian stores long-form, user-owned knowledge documents (`create_note` write-blocked until Phase 9). Google tools provide read-only external data. Memory stores compact assistant preferences and facts.

## Provider boundary (server-side only)

- The browser never spawns Command Code or sees its raw output.
- `/api/agent/stream` launches `node <entry>` with fixed arguments (`--output-format json`, `--permission plan`, `--no-session`). Prompts pass via stdin — never as CLI arguments.
- `src/lib/provider/ndjson-parser.ts` consumes NDJSON incrementally.
- Only the final `result` frame is trusted. Raw `run_end` state, trace IDs, session IDs, deltas, and stderr are discarded.
- Output is validated with Zod and only `provider`, `model`, `durationMs`, and aggregate `usage` reach the UI.

## Ollama provider boundary (server-side only)

- Server-side Ollama client connects exclusively to local Ollama (`JARVIS_OLLAMA_BASE_URL`, default `http://localhost:11434`). The base URL is validated server-side and arbitrary remote endpoints are prohibited.
- `src/lib/agent/providers/ollama-provider.ts` implements the unified `AgentProvider` contract.
- Model discovery: `GET /api/tags` detects installed local models dynamically, reporting truthful health status (`Available`, `Model unavailable`, `Unavailable`, `Invalid configuration`).
- Tool calling: maps `ToolRegistry` metadata to Ollama function tools. Normalizes both native `tool_calls` and structured JSON text into `AgentDecision`.
- Strict output validation: responses must conform to `StructuredResult`. Markdown code blocks are stripped, but malformed or non-compliant output fails closed.
- Provider selection: `src/lib/agent/providers/active-provider.ts` enables selecting either `CommandCodeProvider` or `OllamaProvider` via `JARVIS_PROVIDER` or the Settings UI.

## Obsidian integration boundary (server-side only)

- Vault root is set strictly via `OBSIDIAN_VAULT_PATH` environment variable. The browser never supplies or sees the absolute vault path.
- `src/lib/obsidian/path.ts` enforces strict canonical path containment. Every model-supplied path is validated against directory traversal (`../`), alternate path separators, absolute path escaping, and symlink breakout. Paths escaping the vault fail closed.
- File access uses `node:fs/promises`.
- `search_vault` (`read`): scans Markdown notes, headings, and tags, returning sanitized vault-relative paths, titles, excerpts, and timestamps.
- `read_note` (`read`): reads Markdown content and frontmatter metadata for a given vault-relative note.
- `create_note` (`write`): validates title, content, and destination folder, resolving safe filenames without overwriting existing files. Execution is strictly blocked at the runtime permission check until Phase 9 user-confirmation infrastructure exists.
- Untrusted content: note text retrieved from Obsidian is treated strictly as data, never as instructions or permission grants.

## Fully local voice subsystem (Phase 8)

- **Interface Layer Only**: Voice is strictly an interface layer and never acts as a second reasoning system. Transcribed speech enters the same `submitAgentRequest(message)` seam as typed input, ensuring tools, skills, memory injection, permissions, and provider selection remain 100% identical.
- **Local Speech-to-Text (Whisper)**:
  - Supports local whisper.cpp server (`HttpWhisperTransport`) or CLI binary (`CliWhisperTransport`).
  - Configurable via `JARVIS_WHISPER_URL`, `JARVIS_WHISPER_EXECUTABLE`, `JARVIS_WHISPER_MODEL_PATH`, `JARVIS_WHISPER_LANGUAGE`, and `JARVIS_WHISPER_THREADS`.
  - Enforces local-only base URLs (`localhost`, `127.0.0.1`).
- **Local Text-to-Speech (Kokoro)**:
  - Provider abstraction: `VoiceOutputProvider` with `KokoroTTSProvider`.
  - Connects to local Kokoro HTTP API (`POST /v1/audio/speech`).
  - Configurable via `JARVIS_KOKORO_BASE_URL`, `JARVIS_KOKORO_MODEL`, `JARVIS_KOKORO_VOICE`, and `JARVIS_KOKORO_SPEED`.
  - TTS input strictly uses validated `StructuredResult.speech`. Raw model outputs or internal prompts are never synthesized.
- **Real-Time Barge-In (`SpeechPlaybackManager`)**:
  - Stopping playback immediately aborts active fetch controllers, pauses and clears audio elements, and invalidates active playback tokens.
  - Interrupted turns immediately switch state from `speaking` to `listening`.
  - Late-arriving audio buffers from cancelled requests are discarded and never played.
- **Ephemeral Audio Privacy**:
  - Browser microphone captures are buffered in memory only during transcription.
  - Zero disk storage, zero database persistence, and zero logging of raw audio.
- **Echo Cancellation & Protection**:
  - Browser constraints `{ echoCancellation: true, noiseSuppression: true, autoGainControl: true }`.
  - Audio playback and microphone recording are coordinated to prevent JARVIS responding to its own voice.

## Main boundaries

- `src/app/page.tsx` is a small server route that renders `JarvisShell`.
- `src/app/api/agent/status/` — provider health/auth/model and integration statuses.
- `src/app/api/agent` — streaming endpoint; returns sanitized NDJSON.
- `src/app/api/agent/provider` — active provider reading and switching endpoint.
- `src/app/api/voice/status` — voice subsystem status (Whisper, Kokoro, mic, speaker).
- `src/app/api/voice/transcribe` — ephemeral audio transcription endpoint.
- `src/app/api/voice/synthesize` — speech synthesis endpoint returning audio stream.
- `src/components/jarvis/jarvis-shell.tsx` is the client orchestrator.
- `src/components/jarvis/jarvis-core.tsx` renders geometry based only on `CoreState`.
- `src/components/jarvis/intelligence-panel.tsx` switches between activity, results, and sources.
- `src/components/cards/renderer-registry.tsx` maps validated card types to trusted React markup.
- `src/lib/mock/scenarios.ts` is the only source of Phase 1 demonstration content.
- `src/lib/skills/` implements skill loading, schema validation, registry, and semantic selection.
- `src/lib/tools/` implements the generic application-owned `ToolRegistry`.
- `src/lib/obsidian/` implements vault configuration, path containment, and note search/read operations.
- `src/lib/agent/` implements `AgentRuntime`, managing the multi-turn agent ↔ tool loop.
- `src/lib/voice/` implements Whisper transports, Kokoro TTS provider, client audio managers, and status checking.

## State model

The core states are `idle`, `listening`, `thinking`, `executing`, `speaking`, `confirmation`, and `error`. The reducer maps real provider, tool, and voice lifecycle events to these states:
- `listening` while the microphone is actively capturing user speech.
- `thinking` while the agent reasons.
- `executing` while a tool (e.g. `search_vault`, `read_note`) runs.
- `speaking` while Kokoro-generated audio is playing in the browser.
- `idle` on completion, playback finished, or cancellation.
- `error` on failure or timeout.

Barge-in allows transition from `speaking` directly to `listening`.

## Semantic rendering

Structured result cards use a Zod discriminated union. Each type has its own payload and rendering hierarchy. This prevents arbitrary HTML and avoids forcing meetings, emails, notes, and research into one generic component. Note sources reference vault-relative paths safe for client-side display.

## Routes

- `/` — main shell
- `/settings` — settings shell (shows sanitized provider, Obsidian, Google Workspace, Memory, and Voice status)
- `/debug` — development-only shell showing capability/status; `notFound()` in production
- `/api/agent` — provider request stream
- `/api/agent/provider` — active provider reading and switching endpoint
- `/api/agent/status` — provider, Obsidian, Google Workspace, Memory, and Voice health/status
- `/api/memory` — persistent memory inspection and deletion endpoint
- `/api/voice/status` — voice subsystem status inspection
- `/api/voice/transcribe` — audio chunk transcription endpoint
- `/api/voice/synthesize` — speech audio synthesis endpoint

## Local Voice Subsystem (Phase 8)

JARVIS features a 100% local, offline-capable voice architecture with zero external speech APIs (no ElevenLabs, no cloud STT/TTS).

```
[User Mic]
    │
    ▼ (WebM/WAV in memory)
[JARVIS Shell] ──POST /api/voice/transcribe──► [whisper-server (127.0.0.1:8080)]
                                                         │
                                               (ggml-base.en.bin)
                                                         │
                                                         ▼
                                                    [Transcript]
                                                         │
                                                         ▼
                                                 [AgentRuntime]
                                                         │
                                          (Tools, Skills, Memory, Provider)
                                                         │
                                                         ▼
                                                [StructuredResult]
                                                         │
                                                         ▼
[User Speaker] ◄──POST /api/voice/synthesize── [Kokoro TTS (127.0.0.1:8880)]
   (Audio WAV)                                           │
                                                (kokoro-onnx, am_adam)
```

### Directory Isolation (`.jarvis/voice/`)
All voice binaries, virtual environments, models, and scripts are strictly isolated inside `.jarvis/voice/`:
- `whisper/` — `whisper.cpp` release binaries (`whisper-server.exe`, `whisper-cli.exe`, `ggml-cpu-haswell.dll`).
- `kokoro/` — Isolated Python 3.13 virtual environment (`.venv/`) with FastAPI, Uvicorn, and `kokoro-onnx`.
- `models/` — Local models kept strictly outside Git:
  - `models/ggml-base.en.bin` (~141 MB Whisper base English model).
  - `models/kokoro/kokoro-v0_19.onnx` (~310 MB Kokoro ONNX model).
  - `models/kokoro/voices-v1.0.bin` (~28 MB Kokoro 54-voice pack including `am_adam`).
- `runtime/` — Management scripts (`start-voice.ps1`, `stop-voice.ps1`, `start-whisper.ps1`, `start-kokoro.ps1`, `stop-whisper.ps1`, `stop-kokoro.ps1`).
- `logs/` — Runtime output logs (`whisper.log`, `kokoro.log`).

### Barge-In & Cancellation
When the user speaks or clicks the microphone during JARVIS speech (`state.coreState === "speaking"`):
1. `SpeechPlaybackManager.stopPlayback()` immediately pauses the audio element, sets `currentTime = 0`, revokes blob URLs, and aborts any active synthesis fetch request.
2. The active run ID is cleared, ensuring late synthesis responses are immediately discarded.
3. The shell transitions from `speaking` to `listening` via `bargeInTriggered`.
4. The microphone begins recording new input; the previous turn's audio never resumes.

### Ephemeral Privacy
Audio data is strictly processed in memory buffers. Zero recording files are created or stored on disk or in the database during voice interactions. Whisper and Kokoro communicate exclusively across loopback sockets (`127.0.0.1`).

## Write Actions and Human Confirmation Subsystem (Phase 9)

Phase 9 implements an application-owned confirmation lifecycle where the reasoning model may only propose write actions, and execution requires explicit human authorization.

```text
[User Request] (e.g. "Take a note: ...", "Draft email to ...")
      │
      ▼
[AgentRuntime Turn 1]
      │
      ▼
[Model Proposes Write Tool] (create_note, create_google_doc, draft_email)
      │
      ▼
[Runtime Intercepts Tool Call]
      │── Validate tool arguments against Zod input schema
      │── Create PendingConfirmation (status: "pending", 60s TTL)
      │── Emit confirmation_required event & SSE frame
      │── ToolResult: failure (permission "write" requires confirmation)
      │
      ▼
[AgentRuntime Turn 2]
      │── Synthesize explanation with state: "waiting_for_approval"
      ▼
[JarvisShell Visual Core]
      │── CoreState: "confirmation" (pulsing amber ring)
      │── CenterStage renders ConfirmationPreview card
      │    - Action badge (CREATE NOTE, CREATE GOOGLE DOC, DRAFT EMAIL)
      │    - Target path / recipient / document title
      │    - Summary & preview content
      │    - Accessible "Confirm" & "Cancel" buttons
      │
      ├── User clicks "Confirm" OR speaks affirmative ("yes", "confirm", "proceed")
      │    │
      │    ▼
      │   POST /api/agent/confirm { confirmationId, action: "confirm" }
      │    │
      │    ├── ConfirmationService.authorize(id) (status: "pending" -> "consumed")
      │    ├── Replay protection: already consumed -> HTTP 409
      │    ├── TTL expiry: past 60s -> HTTP 410
      │    ├── Execute exact validated parameters via ToolRegistry
      │    └── Return StructuredResult with state: "complete"
      │
      └── User clicks "Cancel" OR speaks negative ("no", "cancel", "abort")
           │
           ▼
          POST /api/agent/confirm { confirmationId, action: "cancel" }
           │
           ├── ConfirmationService.cancel(id) (status: "pending" -> "cancelled")
           └── Discard proposal without executing any write action
```

### Supported Write Tools
1. `create_note`: Obsidian note creation inside vault (`OBSIDIAN_VAULT_PATH`). Sanitizes title to safe filesystem characters, creates directories recursively, and prevents accidental file overwrites.
2. `create_google_doc`: Google Docs creation via safe GWS CLI wrapper (`shell: false`).
3. `draft_email`: Gmail draft creation via GWS CLI. Strictly creates drafts; never sends emails.

### Protection Rules
- **Application Authority:** The model cannot grant write permission, claim prior approval, or bypass confirmation.
- **Single-Use Consumption:** Confirmations are atomic single-use tokens (`pending` -> `consumed`). Replays fail with HTTP 409.
- **Strict TTL:** Ephemeral 60-second time-to-live prevents stale actions from being approved minutes or hours later.

## Formal Verification & Task Lifecycle Subsystem (Phase 10)

Phase 10 introduces an application-owned formal verification stage into the task lifecycle:

```text
UNDERSTAND → PLAN → EXECUTE → VERIFY → COMPLETE
```

### Lifecycle States
Tasks move through an explicit state machine (`src/lib/contracts/task.ts`):
- `queued`: Request received and awaiting reasoning turn.
- `planning`: Agent reasoning, selecting skills, and preparing tool calls.
- `executing`: Tool execution in progress (`tool_started`).
- `waiting_for_approval`: Write action intercepted; waiting for human confirmation (`confirmation_required`).
- `verifying`: Tool finished execution; application running real-world verification (`verification_started`).
- `completed`: Task verification succeeded (`verification_completed` with `passed`).
- `failed`: Tool execution, output validation, or verification failed (`failed`).
- `cancelled`: User cancelled active turn via stop button or voice barge-in (`cancelled`).

### Key Verification Rules
1. **Tool Execution ≠ Task Completion:** A tool returning without an exception is merely execution, not proof of completion. Completion is only granted after verification passes.
2. **Application Ownership:** Verification code is owned 100% by application logic (`src/lib/verification/`). The reasoning model has zero authority over verification; model claims such as `"verified": true` or `"success": true` are ignored as evidence.
3. **Deterministic Real Evidence:**
   - `create_note`: Verifies the note file exists on disk inside the configured vault using `fs.stat()`, canonical path containment (`resolveVaultPath`), and non-empty content matching expected title/header.
   - `create_google_doc`: Verifies normalized GWS output contains a valid `documentId`, expected title, and safe Google Docs link.
   - `draft_email`: Verifies normalized GWS draft output contains a valid `draftId`, matching recipient and subject, and strictly enforces draft-only status (confirming no outbound email was sent).
   - Read tools: Validates output structure and schema compliance.
4. **Idempotency & No Duplicate Writes:** Verification failure never triggers an automatic retry of the underlying write action. The failure is reported truthfully.
5. **Run Correlation & Stale-Run Protection:** Verification results are tied to `runId` and `taskId`. Late-arriving events or results from older runs cannot overwrite the state of a newer active run.
6. **Cancellation Integrity:** Cancelled tasks cannot be resurrected into `completed` by delayed subprocess completions or late verification results.
7. **Truthful Spoken Reporting:** When verification fails, JARVIS's spoken response and UI cards communicate the failure honestly ("I couldn't verify that the note was created"), preventing false success statements.

## Observability Subsystem & Diagnostic Pipeline (Phase 11)

Phase 11 adds comprehensive diagnostic observability across the application runtime without mutating task state, authorizing actions, or introducing cloud dependencies.

```text
[Runtime / Integration / Voice Operations]
       │
       ▼
DiagnosticService (Singleton In-Memory Store)
       │── records run lifecycle (start, state changes, completions)
       │── records provider, skill, tool, confirmation, verification timings
       │── records ephemeral voice operations (zero audio persistence)
       │── maintains bounded event log (max 200 items, FIFO)
       │── maintains bounded execution history (max 50 runs, FIFO)
       ▼
Sanitization Boundary (src/lib/diagnostics/sanitizer.ts)
       │── redacts API keys, Bearer tokens, passwords, cookies
       │── redacts absolute filesystem paths (Windows C:\, F:\, Unix /Users, /var)
       │── redacts raw GWS CLI commands and sensitive argument strings
       │── truncates safe summaries (label <= 120, detail <= 500 chars)
       ▼
Debug Data Route (/api/debug)
       │── Zod validation against debugSnapshotSchema
       │── Cache-Control: no-store, private
       ▼
Debug Shell UI (/debug)
       │── 8-Stage Pipeline: RUN → PROVIDER → SKILL → TOOLS → CONFIRMATION → VERIFICATION → VOICE → FINAL RESULT
       │── Bounded Execution History (50 past runs with runId, duration, state, failure summaries)
       │── Filterable Structured Event Stream (200 recent events)
       │── Read-only: zero state mutation or execution controls
```

### Key Observability Rules
1. **Visibility Only:** Diagnostics are strictly read-only. Debug APIs cannot execute tools, confirm write proposals, cancel actions, change permissions, or mark verification passed.
2. **Deterministic Durations:** Real elapsed milliseconds (`performance.now()`) are captured for provider calls, tool executions, verification checks, and voice operations. Zero placeholder values are used.
3. **Finite Failure Taxonomy:** 17 application-owned failure categories ensure structured, predictable error reporting without exposing raw stack traces or internal errors to users.
4. **Local Privacy:** No telemetry is sent to cloud services, third-party trackers, or analytics endpoints. Voice audio is ephemeral and never persisted in diagnostic logs.
