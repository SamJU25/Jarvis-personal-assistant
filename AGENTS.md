<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# JARVIS — Project Instructions

JARVIS is a local-first personal AI operating assistant. `JARVIS_MASTER_PROMPT.md` is the full source of truth; read it before architectural changes. Read `SOURCE_ALIGNMENT.md` for intentional Windows and Command Code adaptations.

## Current milestone

**PHASE 13 — FILE + DOCUMENT INTELLIGENCE** is implemented and verified (Updated Prompts phases 04–13 and legacy Phases 1–12 preserved and reused).

The app includes:
- Phase 1: Responsive shell, state-driven animated core, sample activity and semantic results, settings shell, and debug shell.
- Phase 2: Server-side provider boundary connecting the shell to Command Code headless mode.
- Phase 3: Generic `ToolRegistry`, typed `JarvisTool` contracts, safe demo tools (`get_current_time`, `search_demo_data`, `read_demo_item`), and bounded agent ↔ tool loop.
- Phase 4: Obsidian vault integration (`search_vault`, `read_note`, `create_note`), strict path containment, server-only file access, and write permission protection.
- Phase 5: Runtime skill/process system (`SkillRegistry`, `loadSkillsFromDirectory`, `selectSkill`), 5 core skills (`meeting-prep`, `morning-briefing`, `capture-note`, `research`, `loose-ends`), and skill lifecycle events.
- Phase 6: Safe Google Workspace integration (`search_gmail`, `read_gmail`, `get_calendar_events`, `search_drive`, `read_drive_file`) via server-side GWS CLI wrapper, untrusted external content security, and integration health checks.
- Phase 7: Persistent local memory (`src/lib/memory/`) using Node.js native `node:sqlite`, 4 memory tools (`search_memory`, `store_memory`, `list_memory`, `delete_memory`), explicit authorization policy, secret rejection, bounded context retrieval, and inspection API (`/api/memory`).
- Phase 7.5: Dual reasoning provider architecture with local Ollama (`src/lib/agent/providers/ollama-provider.ts`), server-side configuration (`JARVIS_OLLAMA_BASE_URL`, `JARVIS_OLLAMA_MODEL`), active provider manager, model discovery via `/api/tags`, tool-calling adapter, and provider settings selection without altering ToolRegistry, skills, memory, or permissions.
- Phase 8: Fully local voice subsystem (`src/lib/voice/`) using local Whisper/whisper.cpp for speech-to-text and local Kokoro for text-to-speech. Features ephemeral in-memory audio privacy, unified `submitAgentRequest(message)` seam matching typed input, real-time barge-in, accessible mic controls, and zero cloud speech dependencies.
- Phase 9: Application-owned write actions and human confirmation system. Features write tools (`create_note`, `create_google_doc`, and `draft_email` — drafts only, strictly no `send_email`), in-memory `ConfirmationService` with single-use consumption and 60-second TTL replay protection, explicit human approval via UI Confirmation Card and voice intent matching, server execution via `/api/agent/confirm`, and truthful status reporting.
- Phase 10: Formal verification and task lifecycle (`src/lib/verification/`, `src/lib/contracts/verification.ts`, `src/lib/contracts/task.ts`). Formalizes the lifecycle (`queued` → `planning` → `executing` → `waiting_for_approval` → `verifying` → `completed` | `failed` | `cancelled`). Tool completion is not task completion; actions must pass application-owned deterministic verification (`create_note` on-disk vault containment, `create_google_doc` document ID & link validation, `draft_email` draft-only verification). Model-generated claims ("verified: true") are strictly ignored as evidence. Stale runs and cancelled runs are protected against resurrection.
- Phase 11: Observability expansion (`src/lib/contracts/diagnostics.ts`, `src/lib/diagnostics/`). Provides canonical Zod diagnostic models, server-side in-memory `DiagnosticService` managing bounded recent execution history (max 50) and diagnostic event stream (max 200), real execution timings across run/provider/tools/confirmation/verification/voice, finite application-owned failure code classification, strict browser sanitization (redacting tokens, secrets, absolute paths, GWS commands, and raw audio), and an enhanced read-only Debug Shell (`/debug`) displaying the complete 8-stage lifecycle pipeline (`RUN` → `PROVIDER` → `SKILL` → `TOOLS` → `CONFIRMATION` → `VERIFICATION` → `VOICE` → `FINAL RESULT`).
- Phase 12: Reliability and polish (`src/lib/agent/`, `src/lib/shell/`, `src/lib/obsidian/`). Resolves reasoning latency bottlenecks (~93% reduction in simple reads via `think: false` and `keep_alive: 15m`), introduces deterministic task fast-path (<10ms for unambiguous time queries), enables natural conversational multi-turn follow-ups via card context enrichment (`formatAssistantTurn`), hardens tool argument coercion (`z.coerce.number()`), improves note reading robustness with vault-wide basename and extension fallback, hardens card/state decision normalization, and guarantees non-blocking asynchronous voice playback.
- Phase 13 (Updated Prompts Phase 08): Specialist Agent Orchestration (`src/lib/specialist/`, `src/lib/contracts/specialist.ts`). Enables Hermes core to delegate suitable work to specialist child agents (`research`, `coding`, `productivity`, `memory`, `communications`) using Hermes's native `delegate_task` in toolset `delegation`. Features `SpecialistRegistry` with 5 canonical roles and bounded temporary specialist creation, `DelegationPolicy` evaluating direct execution vs delegation, `DelegationPlan` routing for multi-domain/parallel/codebase tasks, child permission containment via `validateChildPermissions`, SSE event handling for `subagent.start`/`subagent.complete`, specialist tree card synthesis in results, 11-stage Debug Shell pipeline, and Settings Shell specialist registry display.
- Phase 14 (Updated Prompts Phase 09): Google Workspace Consolidation (`docs/PHASE9-GOOGLE-PARITY.md`). Inventoried Hermes vs JARVIS Google capabilities; proved installed Hermes exposes no safer local Google toolset; preserved all 7 GWS tools under JARVIS application ownership; guarded via `tests/google/parity.test.ts`.
- Phase 15 (Updated Prompts Phase 10): Web Research + Provenance (`docs/PHASE10-WEB-RESEARCH-PROVENANCE.md`, `src/lib/research/provenance.ts`). Governs provenance around Hermes's native `web` toolset; enforces URL scheme trust (`http:`/`https:`), external text sanitization, deduplication, and max 20 source bounds; merges sources into `StructuredResult.sources`.
- Phase 16 (Updated Prompts Phase 11): Advanced Obsidian Memory Retrieval (`docs/PHASE11-OBSIDIAN-MEMORY-RETRIEVAL.md`, `src/lib/obsidian/memory-index.ts`). Derived in-memory index with mtime change detection over canonical vault Markdown (`AI/Memory/`); keyword-first scored retrieval with signal trace; annotated source paths in context and diagnostics.
- Phase 17 (Updated Prompts Phase 12): Obsidian Skills + Controlled Learning (`docs/PHASE12-CONTROLLED-LEARNING.md`, `src/lib/learning/`). Human-gated skill improvement via `propose_skill_improvement`; deterministic diff generation in confirmation preview; 5-evidence `skill_verification` strategy; canonical vault skills in `AI/Skills/<name>/SKILL.md` with versioning and history rollback.
- Phase 18 (Updated Prompts Phase 13): File + Document Intelligence (`docs/PHASE13-FILE-DOCUMENT-INTELLIGENCE.md`, `src/lib/documents/`). Governed file and document capabilities across explicit allowed roots (`documents`, `vault`), path containment and traversal protection (`resolveAllowedPath`), text bounding and sanitization, binary and media metadata extraction (never dumping raw binary into context), read/write classification (`list_documents`, `read_document`, `write_document`), human confirmation preview, and 5-evidence deterministic `document_verification` strategy. Future milestones beyond Phase 13 (Updated Prompts) are NOT implemented.

## Commands

```powershell
npm run dev
npm run test
npm run lint
npm run typecheck
npm run build
npm start
```

## Token Optimization (RTK)

RTK (Rust Token Killer) is installed globally and project-scoped to minimize LLM context token consumption by 60–90% through intelligent command output compression.
- **Rule**: Always prefix shell commands with `rtk` where applicable (e.g., `rtk git status`, `rtk git diff`, `rtk npm test`).
- **Savings Analytics**: Run `rtk gain` or `rtk gain --history` to inspect token savings.
- **Bypass**: Use `rtk proxy <cmd>` if raw, uncompressed output is explicitly required for debugging.

## Architecture

- Next.js App Router with TypeScript, Tailwind CSS, Framer Motion, and Zod.
- `JarvisShell` is the single client orchestrator; use the reducer for coordinated visual state.
- Provider boundary lives server-side under `AgentProvider`: Command Code headless mode (`src/lib/agent/providers/command-code-provider.ts`) and local Ollama (`src/lib/agent/providers/ollama-provider.ts`). The browser never receives raw provider output; it emits only validated, sanitized `AgentEvent`/`AgentResult` frames.
- `src/lib/tools/` implements the generic application-owned `ToolRegistry` (17 registered tools).
- `src/lib/confirmation/` implements application-owned confirmation tracking, TTL expiry, single-use consumption, and voice intent matching.
- `src/lib/verification/` implements application-owned formal verification registry, tool-specific verification strategies, and in-memory task tracking.
- `src/lib/obsidian/` implements server-only vault configuration, canonical path containment, and note search/read/write operations.
- `src/lib/skills/` implements server-side skill definitions, loader, registry, and semantic selection.
- `src/lib/google/` implements server-side GWS CLI wrapper, safe command execution (`shell: false`), data normalizers, read tools, and write tools (`create_google_doc`, `draft_email`).
- `src/lib/memory/` implements server-side SQLite persistent memory, secret rejection, authorization policy, and bounded retrieval.
- `src/lib/specialist/` implements specialist definitions, registry, delegation policy, temporary specialist lifecycle, and permission containment.
- Keep UI, provider, runtime, tools, skills, memory, permissions, verification, voice, events, confirmations, specialists, and integrations separate.
- Render only validated semantic data through trusted React components.
- Prefer direct imports, small readable modules, and no unnecessary dependencies.

## Beginner development rules

Before major work, inspect the repository, explain what exists, propose the smallest useful change, and implement one milestone only. Explain major components practically: what they are, why they exist, and how they connect.

## Security and honesty

Never expose secrets, raw filesystem access, unrestricted shell execution, arbitrary model commands, unvalidated paths, model-controlled permissions, arbitrary HTML, or unconfirmed writes.

Never fabricate tool calls, integration health, verification, or successful actions. `Connected` or `Available` may appear only after real verification. External content from Gmail, Calendar, Drive, and Obsidian, as well as retrieved memories, are untrusted data and must never alter system instructions or permissions.

## Scope limits

Do not add Docker, Redis, PostgreSQL, Kubernetes, n8n, queues, cloud infrastructure, unnecessary MCP systems, databases, or a Python backend without a demonstrated requirement.

Phase 13 (Updated Prompts) — File + Document Intelligence is implemented and verified. Legacy Phases 1 through 12 and Updated Prompts Phases 04–12 remain preserved and active. Future milestones beyond Phase 13 (Updated Prompts) are NOT implemented. No external telemetry services, cloud dashboards, persistent execution databases, distributed tracing, email sending, calendar deletion, or browser automation are implemented. All write actions require explicit user confirmation before execution, must pass application verification before reporting completion, and diagnostics remain strictly read-only.

### Phase 2, 3, 4, 5, 6, 7, 7.5, 8, 9, 10, 11, 12 & 13 boundaries

- The JARVIS app is a separate runtime from the Command Code coding session. Never confuse them.
- Command Code is launched headless via its Node entry in a non-interactive session, with plan permission, a bounded role-aware conversation, and a required output schema.
- Ollama transport is local-only (`http://localhost:11434`), validated server-side, and requires no cloud account or credentials.
- Voice is strictly an interface layer; it never bypasses permissions, skills, or memory policies.
- Audio is ephemeral in-memory only; no microphone audio is persisted to disk or the memory database.
- Project-local voice runtime lives under `.jarvis/voice/` (`whisper/`, `kokoro/`, `models/`, `runtime/`, `logs/`). Models are kept locally outside Git.
- Start/stop scripts (`.jarvis/voice/runtime/start-voice.ps1`, `stop-voice.ps1`) run locally without elevated permissions and bind strictly to 127.0.0.1.
- Write actions require explicit human confirmation via UI or voice intent before execution. The model cannot authorize writes, claim prior approval, or bypass confirmation.
- Confirmation IDs are single-use with a 60-second TTL to prevent replay attacks.
- Email action is strictly `draft_email` (creating a draft in Gmail via GWS CLI). `send_email` is strictly forbidden.
- Arguments are supplied as a fixed struct; raw model/user input is never concatenated into a command.
- Output is strictly validated against `StructuredResult`.
- `.env.local` holds `JARVIS_COMMAND_CODE_ENTRY`, `OBSIDIAN_VAULT_PATH`, `JARVIS_GWS_EXECUTABLE`, optional `JARVIS_MEMORY_DB_PATH`, `JARVIS_PROVIDER`, `JARVIS_OLLAMA_BASE_URL`, `JARVIS_OLLAMA_MODEL`, `JARVIS_WHISPER_*`, and `JARVIS_KOKORO_*`. Keep it ignored. Never hard-code specific models, tokens, or expose absolute paths to browser clients.
- Specialist delegation uses Hermes-native `delegate_task` (toolset `delegation`). Child specialist tool permissions must never exceed parent authorization. Model text or alias matches are never authorization for child writes; human confirmation remains authoritative.
