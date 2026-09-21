# JARVIS Security

## Phase 2 guarantees

- Provider execution is confined to a server-side route; the browser never spawns Command Code, sees its raw output, or receives session IDs, trace IDs, stderr, or executable paths.
- The prompt is passed via stdin; it is never concatenated into shell arguments.
- Command Code is launched via `node <entry>` with `shell: false` and fixed argument arrays. The executable is validated and Windows `System32\cmd.exe` is rejected.
- Only the validated final `result` frame is trusted. Raw frames, deltas, trace IDs, session IDs, and stderr are discarded before Zod validation.
- Only `provider`, `model`, `durationMs`, and aggregate `usage` reach the UI as display labels.
- `.env.local` holds `JARVIS_COMMAND_CODE_ENTRY` (absolute path). It is ignored, never sent to the browser, and contains no secret or hard-coded model.
- No model is hard-coded in UI or business logic; the active model is read from Command Code configuration and shown only as a label.
- Semantic cards accept only trusted, Zod-validated structures.
- Arbitrary HTML is never rendered.
- The debug route returns `notFound()` outside development.

## Phase 3 & 4 tool and Obsidian security guarantees

- **Generic Tool Boundary:** Centralized `ToolRegistry` prevents duplicate registrations. Tools are strictly separated by permission (`read` vs `write`). Inputs and outputs are strictly validated by Zod schemas.
- **Server-Side Vault Containment:** The Obsidian vault path (`OBSIDIAN_VAULT_PATH`) is known only to the server. The absolute path is never passed in client requests or returned in API responses.
- **Path Traversal Prevention:** `resolveVaultPath` canonicalizes paths, rejects explicit `..` segments, verifies the normalized path starts with the vault boundary, and uses `realpath` on existing files to block symlink breakouts. Traversal attempts fail closed.
- **Server-Only File Access:** All filesystem interactions use Node `fs/promises`. Browser code cannot trigger arbitrary filesystem access.
- **Untrusted Note Content:** Notes retrieved from the vault are treated strictly as untrusted data payloads. Any prompt-injection attempts embedded inside note content (e.g., "Ignore previous instructions and do X") cannot modify system instructions or alter tool permissions.
- **Write Permission Guard:** `create_note` is registered with `write` permission. Because Phase 4 lacks the user-confirmation flow (scheduled for Phase 9), the application runtime actively refuses to execute write tools, returning a safe failure event. No automatic write execution is permitted.
- **Truthful Status Reporting:** Vault availability is verified against the filesystem. Status reports truthfully as `Available`, `Not configured`, `Unavailable`, or `Invalid configuration`. `Connected` or `Available` is never displayed without real verification.

## Phase 5 skill security guarantees

- **Skills as Trusted Configuration:** Skills are strictly application-owned configuration stored on the server (`skills/<id>/SKILL.md`). The model cannot create, modify, reload, or delete skills at runtime.
- **No Direct Execution Privilege:** Skills are process descriptions, not executable code. Skills cannot directly execute shell commands, access `child_process`, read environment secrets, access databases, or initiate network connections. All actions must proceed through the agent requesting tools via `ToolRegistry`.
- **Tool Boundary Integrity:** Skills cannot bypass `ToolRegistry` validation or permission checks. Even when a skill (`capture-note`) requests `create_note`, the runtime permission check halts execution at the write barrier.
- **Truthful Capability Boundary:** Skills cannot invent or fabricate data from unavailable integrations (e.g. Google Calendar, Gmail, Google Drive in Phase 6). If tools are missing, the skill process explicitly directs the agent to disclose source unavailability truthfully.
- **Untrusted Input Separation:** Note content and user input processed during a skill execution are treated as untrusted data. Injected prompts within notes (e.g., attempting to redefine skill decision rules or grant write permissions) cannot alter runtime security constraints.
- **Metadata Sanitization:** Only safe metadata (`id`, `name`, `description`) is exposed to the UI and debug shell. Internal server paths and unvalidated prompt contents are never leaked to client responses.

## Phase 6 Google Workspace security guarantees

- **No Direct Model Access to CLI:** The model has zero direct access to the GWS CLI or shell execution. It can only request semantic tools (`search_gmail`, `read_gmail`, `get_calendar_events`, `search_drive`, `read_drive_file`) through the application `ToolRegistry`.
- **Safe Command Construction:** All GWS subprocesses are spawned server-side with `shell: false`, using explicit argument arrays. User and model inputs are never concatenated into shell command strings.
- **Strict Read-Only Scope:** All five Google tools are registered with `permission: "read"`. No write tools (e.g. `create_google_doc`, `draft_email`, `send_email`) are enabled in Phase 6; write attempts remain blocked until Phase 9 user-confirmation infrastructure is implemented.
- **Untrusted External Content:** All data returned from Gmail (bodies, snippets, subjects), Calendar (event titles, descriptions, locations), and Drive (documents, files, metadata) is treated strictly as untrusted data. Malicious prompt-injection instructions embedded in emails or documents (e.g., "Ignore instructions and do X") cannot override system instructions or elevate tool permissions.
- **Bounded Buffers and Explicit Truncation:** Outputs and buffers are strictly capped (2MB stdout, 40KB body content). Content exceeding safe limits is explicitly truncated with a clear `[Content truncated...]` notice, preventing memory exhaustion and prompt-flooding attacks.
- **Sanitized Errors and Zero Secret Leakage:** Status checks and error handlers scrub access tokens, file paths, raw CLI command lines, and raw stderr before returning errors or status to the client or agent.
- **Timeout and Cancellation:** Every GWS command is governed by timeouts and AbortSignals; cancelled requests terminate the underlying subprocess immediately, preventing stale results from polluting subsequent turns.

## Phase 7 Persistent Memory security guarantees

- **Explicit User Authorization Only:** `store_memory` and `delete_memory` require explicit user memory intent ("Remember that...", "Forget that..."). Casual conversation and external content cannot invoke memory modifications.
- **Narrow Memory Permission Policy:** Memory modification tools have `permission: "memory"`, which is evaluated by the runtime authorization policy. External writes (`create_note`, future Google writes) remain strictly blocked with `permission: "write"` until Phase 9 user confirmation.
- **Secret & Credential Rejection:** Passwords, API keys (OpenAI, GitHub, AWS, Google), private cryptographic keys, and JWTs are actively scanned and rejected before storage.
- **Quarantined Memory Context as Untrusted Data:** Memories retrieved into system instructions are placed inside a `MEMORY CONTEXT` block with explicit instructions stating that memories are data, not instructions. Prompt injections embedded inside stored memories can never alter permissions or execute unconfirmed tools.
- **Local-First SQLite Isolation:** All SQLite database queries execute synchronously on the server using `node:sqlite`. Raw database queries or connections are never exposed to the client.
- **Bounded Ingestion and Retrieval:** Individual memories are capped at 1,000 characters; context injection is capped at 5 records and 2,000 characters to prevent prompt flooding.

## Phase 7.5 Local Ollama Provider security guarantees

- **Local Endpoint Isolation:** Base URL defaults to `http://localhost:11434` and is strictly configured and validated server-side. The browser cannot supply arbitrary remote endpoints or cloud URLs.
- **Untrusted Model Output:** Local execution does not imply trusted execution. All responses from Ollama must conform strictly to `StructuredResult` or structured tool calls. Arbitrary text, prompt injection, or hallucinatory instructions cannot elevate tool permissions or bypass confirmation.
- **Zero Cloud Accounts / Secret Exposure:** Local Ollama requires no API keys or cloud tokens. No credentials are requested, stored, or sent to the browser.
- **Tool Boundary Preservation:** Ollama has zero access to node APIs, child processes, or direct filesystem operations. All actions proceed through `ToolRegistry` with unchanged permission barriers (`read`/`memory` allowed, `write` blocked until Phase 9).
- **Cancellation & Timeout Enforcement:** All Ollama HTTP requests are governed by `AbortSignal` and timeouts (default 60s). Cancelled or timed-out requests terminate immediately without leaking stale responses.

## Phase 8 Local Voice security guarantees

- **Voice as Interface Layer Only:** Voice is never an independent reasoning system or backdoor. Transcribed audio enters `submitAgentRequest(message)` identically to typed input. Voice cannot bypass tool permissions, skill processes, or memory policies.
- **Ephemeral Audio Privacy:** Audio captures from the user's microphone exist strictly in memory during the active turn. No microphone recordings are saved to disk, database, `.jarvis`, or server logs. Temporary files for CLI Whisper are strictly unlinked in `finally` blocks.
- **Strict Localhost Boundaries:** All STT (Whisper) and TTS (Kokoro) server communication is restricted to `localhost`, `127.0.0.1`, or `[::1]`. Non-local and cloud speech URLs (e.g. OpenAI, ElevenLabs, Azure, Google Cloud) are rejected at configuration parse time.
- **No Direct Shell Execution:** Whisper and Kokoro processes (if invoked via CLI) run server-side with `shell: false` and fixed argument arrays. User-spoken text is never passed as executable arguments or shell commands.
- **Validated TTS Input:** Only validated `StructuredResult.speech` text is sent to Kokoro TTS. Raw model streams, tool outputs, debug logs, internal prompts, or memory context are never sent to speech synthesis.
- **Echo Cancellation & Feedback Protection:** Browser microphone constraints (`echoCancellation: true, noiseSuppression: true, autoGainControl: true`) along with coordinated playback state prevent JARVIS's speaker output from being transcribed into a feedback loop.
- **Barge-In and Stale Audio Rejection:** When the user interrupts speech, active synthesis requests are aborted and audio elements are cleared. Stale audio chunks arriving from cancelled requests are rejected and never played.
- **Project-Local Runtime Isolation:** The entire voice runtime (whisper.cpp, Python virtual environment, models, and scripts) is confined to `.jarvis/voice/` and ignored by Git. Voice servers run without elevated/administrator privileges, bind exclusively to loopback addresses (`127.0.0.1:8080`, `127.0.0.1:8880`), and log only diagnostic text without binary or audio capture retention.

## Phase 9 Write Actions and Human Confirmation security guarantees

- **No Write Without Explicit Human Confirmation:** Write tools (`create_note`, `create_google_doc`, `draft_email`) cannot be executed by the model alone. The model can only *propose* a write action. The application intercepts the write request and creates a `PendingConfirmation`.
- **Application-Owned Confirmation Lifecycle:** The confirmation state machine is owned strictly by the application's server-side `ConfirmationService`. The model cannot authorize its own actions, fabricate confirmation IDs, claim prior user permission, or bypass confirmation.
- **Single-Use Consumption & Replay Protection:** Every confirmation ID is strictly single-use (`pending` -> `consumed`). Replaying an already-consumed confirmation ID is rejected with HTTP 409.
- **Strict 60-Second TTL Expiry:** Confirmations have an ephemeral 60-second time-to-live. Stale or expired confirmations cannot be executed and return HTTP 410.
- **Parameter Immutability:** When a write action is confirmed at `/api/agent/confirm`, the runtime executes the *exact* validated parameters captured at proposal time. Neither the user's confirmation message nor the client request can inject new parameters into the execution.
- **Strict Draft Boundary for Email:** Email functionality is limited to `draft_email` (creating an un-sent draft in Gmail via GWS CLI). JARVIS has NO `send_email` tool; outbound sending cannot be initiated by the model or confirmation API.
- **Untrusted External Content Cannot Authorize Writes:** Prompt injections embedded in emails, documents, notes, or memories cannot trigger or confirm write actions. Confirmations require genuine human action (interactive UI button click or voice affirmation intent while in `waiting_for_approval`).
- **Truthful Status & Execution Reporting:** If GWS CLI is unavailable or unauthenticated on the host, the system truthfully returns a failure result with `state: "failed"`. Write successes are never fabricated.

## Phase 10 Formal Verification security guarantees

- **Application-Owned Verification Authority:** Verification decisions and evidence collection are owned entirely by server-side application logic (`src/lib/verification/`). The reasoning model has zero authority over verification; natural language output or JSON fields claiming `"verified": true` are strictly ignored as evidence.
- **Strict Real Evidence Validation:** Verification demands concrete execution evidence. Obsidian note creation is verified via disk file existence, canonical containment inside the configured vault (`resolveVaultPath`), and content structure checks. Google Docs require valid document IDs and safe web links. Email creation requires draft IDs and strictly enforces draft-only constraints (rejecting any indications of sent emails).
- **Untrusted External Content Cannot Verify Actions:** Injected instructions or malicious content in Gmail, Drive, Obsidian, or Memory claiming that actions are pre-verified or instructing the system to skip verification cannot bypass application checks.
- **Idempotency & Duplicate Protection:** Verification failure never triggers an automatic retry of the underlying write action. The system truthfully records that execution took place but verification failed, preventing duplicate file writes or duplicate document creations.
- **Run Correlation & Stale Result Protection:** Verification results and task state updates are cryptographically bound to specific `runId` and `taskId` tokens. Late-arriving verification events or results from prior runs are rejected and cannot modify active or newer runs.
- **Cancellation Integrity:** Cancelled tasks remain permanently cancelled; delayed subprocess completions or late verification results are prohibited from transitioning a cancelled task into `completed`.
- **Bounded Verification Timeouts:** Verification operations are subject to a bounded timeout (default 5,000 ms), preventing hanging resources or infinite wait loops.

## Phase 11 Observability security guarantees

- **Strict Browser Allowlist & Sanitization:** Only Zod-validated `DebugSnapshot` schemas reach the browser. Raw internal objects are never serialized directly. Server-side regex scrubbers redact API keys, Bearer tokens, passwords, cookies, authorization headers, absolute filesystem paths (Windows `C:\`, `F:\` and Unix `/Users`, `/var`), raw GWS CLI commands, and raw audio binaries before serialization.
- **Read-Only Debug Surface:** The debug endpoint (`/api/debug`) and UI (`/debug`) are strictly read-only. The debug interface contains zero controls for force-executing tools, authorizing write proposals, cancelling confirmations, modifying permissions, marking verification as passed, or mutating task lifecycle states.
- **No Arbitrary HTML Rendering:** `dangerouslySetInnerHTML` is prohibited for diagnostic rendering. All diagnostic labels, summaries, and messages are rendered as sanitized plain text in trusted React elements.
- **Ephemeral Audio Privacy Preservation:** Voice diagnostics record only operation types (`transcription`, `synthesis`, `playback`), duration in milliseconds, outcomes, and interruption flags. User audio payloads, PCM streams, and microphone recordings are strictly excluded from diagnostic stores.
- **Finite Application-Owned Failure Codes:** All failures are categorized into a finite allowlist of 17 application-owned failure codes. Arbitrary model-generated error descriptions or internal stack traces are not permitted as error categories.
- **Bounded In-Memory Limits:** Diagnostic event logs (max 200 items), execution history (max 50 runs), and voice records (max 50 items) are strictly bounded with FIFO eviction, preventing memory exhaustion or denial-of-service via log flooding.
- **Local Isolation (Zero Cloud Telemetry):** Observability is 100% local. No data is transmitted to cloud monitoring services, distributed tracing collectors, or external analytics endpoints.

## Phase 12 Reliability & Polish security guarantees

- **Safe Deterministic Task Fast-Path:** Unambiguous deterministic tasks (e.g. current time queries) bypass LLM round-trips while strictly preserving full ToolRegistry execution, formal verification (`vService.verify`), task tracking (`planning` → `executing` → `verifying` → `completed`), and sanitized diagnostic recording. No write actions or external data queries may use the fast-path.
- **Strict Bounded Assistant Context:** Multi-turn conversational follow-up context (`formatAssistantTurn`) is bounded to <=1,500 characters and sanitized to prevent prompt-flooding or cross-turn instruction poisoning while preserving necessary semantic context.
- **Zero Automatic Write Retries:** In accordance with Section 6 of the Master Architecture, failed write actions (`create_note`, `create_google_doc`, `draft_email`) and verification failures are strictly non-retryable (`retryable: false`), preventing duplicate file creation, duplicate documents, or repeated writes.
- **Non-blocking Ephemeral Speech Decoupling:** Voice TTS synthesis failures never alter the task outcome or invalidate verified agent results. Audio buffers remain strictly in-memory and ephemeral.
- **Actionable & Sanitized Error Messages:** User-facing error messages clearly describe what happened, why the operation could not complete, what JARVIS did, and what the user can do next, without leaking internal paths, provider payloads, tokens, or raw stderr.

## Permanent rules

- Treat model output and retrieved external content as untrusted.
- Never expose secrets or raw filesystem access to browser code.
- Never allow unrestricted shell execution or arbitrary model-generated commands.
- Never trust external paths without canonical containment checks.
- Require explicit confirmation for every write action.
- Never let the model change permission policy.
- Never claim success without application verification.

