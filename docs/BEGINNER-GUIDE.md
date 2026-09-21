# Phases 1–12 Beginner Guide

## What was built

- **Phase 1 (Visual Interface):** System context rail, animated JARVIS core, structured intelligence panel, command controls, settings, and debug shell.
- **Phase 2 (Agent Provider):** Server-side headless provider boundary connecting the shell to Command Code with NDJSON streaming and structured output validation.
- **Phase 3 (Tool Registry):** Generic `ToolRegistry`, typed `JarvisTool` contracts, safe demo tools, and multi-turn agent ↔ tool loop.
- **Phase 4 (Obsidian Integration):** Server-side Obsidian vault integration allowing JARVIS to search notes (`search_vault`), read notes (`read_note`), and prepare note creation (`create_note`) while enforcing strict canonical path containment and write permission protection.
- **Phase 5 (Runtime Skill/Process System):** Application-owned skill system with 5 core skills (`meeting-prep`, `morning-briefing`, `capture-note`, `research`, `loose-ends`), automatic semantic selection, and truthful reporting of unavailable integrations.
- **Phase 6 (Google Workspace Integration):** Server-side Google Workspace integration connecting Gmail (`search_gmail`, `read_gmail`), Calendar (`get_calendar_events`), and Drive (`search_drive`, `read_drive_file`) via safe wrappers around the machine's GWS CLI, treating external content strictly as untrusted data.
- **Phase 7 (Persistent Memory):** Server-side local SQLite persistent memory subsystem (`node:sqlite`) providing cross-session user preferences and facts (`search_memory`, `store_memory`, `list_memory`, `delete_memory`), bounded context injection, secret rejection, and explicit authorization guardrails.
- **Phase 7.5 (Local Ollama Provider):** Dual selectable reasoning provider architecture (`OllamaProvider` alongside `CommandCodeProvider`), model auto-discovery, tool-calling normalization, and provider settings selection while keeping ToolRegistry, skills, memory, and UI completely provider-independent.
- **Phase 8 (Fully Local Voice):** Fully local voice interface using local Whisper/whisper.cpp for speech-to-text (STT) and local Kokoro for text-to-speech (TTS), real-time barge-in, ephemeral in-memory audio privacy, unified `submitAgentRequest` submission seam, accessible mic controls, and zero cloud voice dependencies.
- **Phase 9 (Write Actions and Human Confirmation):** Application-owned write action and human confirmation subsystem. When the assistant proposes creating a note, a Google Doc, or an email draft, JARVIS pauses the action, creates a single-use pending confirmation card with a preview of the content, and waits for explicit human approval (interactive UI Confirm/Cancel buttons or spoken voice confirmation). Zero writes occur automatically, and emails can only be drafted, never sent.
- **Phase 10 (Formal Verification & Task Lifecycle):** Application-owned formal verification stage (`queued` → `planning` → `executing` → `waiting_for_approval` → `verifying` → `completed` | `failed` | `cancelled`). Tool execution is strictly distinguished from task completion. A task only becomes `completed` after real-world application verification succeeds (`create_note` checks on-disk vault file, `create_google_doc` checks document ID and link, `draft_email` verifies draft-only creation). Model-generated claims ("verified: true") are rejected as evidence. Stale runs and cancelled runs are protected against resurrection.
- **Phase 11 (Observability Expansion):** Complete application-owned diagnostic observability. Provides canonical Zod schemas, real millisecond execution timings, in-memory bounded execution history (last 50 runs) and event streams (last 200 events), finite failure codes, strict browser data scrubbing (blocking secrets, paths, GWS commands, and raw audio), and an enhanced read-only Debug Shell (`/debug`) displaying the 8-stage lifecycle pipeline (`RUN` → `PROVIDER` → `SKILL` → `TOOLS` → `CONFIRMATION` → `VERIFICATION` → `VOICE` → `FINAL RESULT`).
- **Phase 12 (Reliability and Polish):** End-to-end reliability hardening: ~93% latency reduction via Turn 2 `think: false` and `keep_alive: 15m`, deterministic task fast-path (<10ms for unambiguous time queries), natural multi-turn conversational follow-ups with card context enrichment (`formatAssistantTurn`), resilient tool argument coercion (`z.coerce.number()`), vault reading robustness with extension normalization and basename fallback, robust card and state normalization, non-blocking asynchronous voice playback, and zero automatic retries for write actions. Future milestones beyond Phase 12 are NOT implemented.

## Tools vs. Skills

- **Tools (WHAT JARVIS can do):** Primitives that perform one concrete action against an integration (e.g. `search_vault` scans files, `search_gmail` queries emails, `get_calendar_events` fetches schedule, `get_current_time` returns timestamps). Tools don't decide high-level strategy.
- **Skills (HOW JARVIS thinks and combines tools):** Multi-step process definitions that guide the agent through recurring workflows. For example, `meeting-prep` guides the agent to check calendar events, gather related emails and notes, and assemble briefing cards, while handling unavailable sources truthfully.

The user never needs to say "use the research skill". JARVIS analyzes the intent of your request and selects the right skill automatically.

## How it works

1. **User asks a question:** You type a message (e.g., "What did I write down about DeepSeek?") in the command surface.
2. **Automatic skill selection:** `src/lib/skills/selector.ts` detects the request matches the `research` skill. `AgentRuntime` emits `skill_selected` and injects the research workflow instructions into the agent's prompt.
3. **Provider generates tool call:** Either Command Code or Ollama runs on the server and decides it needs to search your vault. It requests a tool call to `search_vault` with `{ query: "DeepSeek" }`.
4. **Tool execution in ToolRegistry:** The server's `AgentRuntime` receives the tool request, checks permissions (`read`), and executes `search_vault` against your local Obsidian vault configured via `OBSIDIAN_VAULT_PATH`.
5. **Path containment & scanning:** `src/lib/obsidian/path.ts` validates that the search remains inside the vault. Note files are scanned and matching excerpts/metadata are returned as a validated `ToolResult`.
6. **Agent reads & synthesizes:** If needed, the agent calls `read_note` for complete note text. Guided by the skill's decision rules, the agent synthesizes the findings and returns a validated `StructuredResult`.
7. **UI displays result:** The core moves through `thinking` and `executing` to `idle`, rendering structured cards and source citations in the intelligence panel.

## Files to learn first

1. `src/components/jarvis/jarvis-shell.tsx` — connects state to the interface.
2. `src/lib/shell/shell-reducer.ts` — predictable state updates across core, transcript, and panels.
3. `src/lib/agent/runtime.ts` — orchestrates the multi-turn agent ↔ tool execution loop, verification lifecycle, and skill selection.
4. `src/lib/agent/providers/` — reasoning providers (`CommandCodeProvider`, `OllamaProvider`, `active-provider.ts`).
5. `src/lib/verification/service.ts` — verification service managing bounded timeouts, task tracking, and strategy execution.
6. `src/lib/verification/registry.ts` — registry mapping tool IDs to verification strategies.
7. `src/lib/skills/registry.ts` — manages registered skills and exposes safe metadata.
8. `src/lib/skills/selector.ts` — matches natural user intent to available skills.
9. `src/lib/skills/loader.ts` — validates and loads Markdown `SKILL.md` definitions.
10. `skills/` — contains markdown definitions for `meeting-prep`, `morning-briefing`, `capture-note`, `research`, and `loose-ends`.
11. `src/lib/tools/tool-registry.ts` — manages registered tools, schemas, and execution.
12. `src/lib/obsidian/tools.ts` — `search_vault`, `read_note`, and `create_note` tool definitions.
13. `src/components/cards/renderer-registry.tsx` — maps semantic data types to React components.

## What to learn from Phase 3 through Phase 10

- **Provider independence:** JARVIS can reason using Command Code or local Ollama without changing how tools execute, how notes are read, or how memory is stored.
- **Data flow separation:** The model requests tools by name and JSON arguments; it never touches files directly or receives unrestricted shell access.
- **Skills as process instructions:** Skills are markdown documents (`SKILL.md`) that guide the LLM's reasoning and tool sequencing. They cannot run code directly.
- **Truthful reporting:** If a provider or integration is unavailable (e.g. Ollama daemon not running, Google Calendar unauthenticated), the system reports it truthfully rather than hallucinating.
- **Path containment:** On Windows and POSIX alike, model-supplied paths must be canonicalized and confirmed to be inside the allowed root. Traversal attempts fail closed.
- **Human confirmation for write actions:** The assistant can never execute write actions on its own. When a write action is proposed, JARVIS pauses the action, creates a confirmation card with preview details, and requires explicit user confirmation via UI or voice. Confirmations are single-use tokens with a 60-second expiration.
- **Drafts only for emails:** The assistant cannot send emails (`send_email` does not exist); it can only create drafts in Gmail (`draft_email`).
- **Execution is not verification:** Tool completion does not equal task completion. Phase 10 introduces a formal verification stage where application code inspects real evidence (e.g. file existence on disk, valid document IDs) before marking a task complete.
- **The model is not the judge:** The LLM cannot declare that an action was verified. Only application code performs verification and decides the final status.
- **Untrusted data:** Notes, emails, memories, and model outputs are untrusted data. Injected instructions like "Ignore previous instructions" are treated strictly as passive data, never executed as instructions.
- **Persistent memory vs conversation context:** Conversation context is short-lived and bounded to the active session. Persistent memory is stored in local SQLite (`.jarvis/memory.db`) and survives restarts, holding intentionally remembered preferences and facts.
- **Obsidian notes vs memory:** Obsidian stores user-owned long-form markdown documents. Memory stores compact assistant preferences and guidelines. "Take a note" drafts an Obsidian note; "Remember that..." stores assistant memory.
- **Voice as an interface layer:** Voice does not replace or fork `AgentRuntime`. Spoken words are transcribed by Whisper into text, which enters the exact same `submitAgentRequest(message)` function as typed input. All skills, tools, and memory rules remain identical.
- **Barge-in:** When JARVIS speaks via Kokoro TTS, you can immediately interrupt by clicking the mic or speaking. JARVIS halts audio playback instantly, aborts speech generation, and begins listening.
- **Audio privacy:** Audio from your microphone is processed strictly in memory and discarded immediately after transcription. No audio recordings are saved to disk or written to the memory database.

## Run and test

```powershell
npm install
npm run dev
```

Open `http://localhost:3000`.

Run quality checks:

```powershell
npm run test
npm run lint
npm run typecheck
npm run build
```

## Common beginner problems

- **Voice status shows "Unavailable" or "Not configured":** Local Whisper or Kokoro server is not running on localhost. To start the local voice subsystem:
  - Run `.\.jarvis\voice\runtime\start-voice.ps1` from the project root. This starts Whisper on port 8080 and Kokoro on port 8880 and confirms both endpoints are healthy.
  - To stop the voice services, run `.\.jarvis\voice\runtime\stop-voice.ps1`.
  - Typed text reasoning remains 100% available even if voice servers are offline.
- **Ollama status shows "Unavailable":** Ollama is not running on `http://localhost:11434`. Start the Ollama application or run `ollama serve`. JARVIS gracefully falls back to Command Code.
- **Ollama status shows "Model unavailable":** No models are downloaded in Ollama, or the configured model is not installed. Download a model using `ollama pull llama3.2` or update `JARVIS_OLLAMA_MODEL` in `.env.local`.
- **"Cannot store memory: Content contains sensitive information":** JARVIS actively blocks storing passwords, API keys, private keys, or tokens in persistent memory to prevent credential leakage.
- **Microphone permission denied:** The browser blocked microphone access. Click the lock/permission icon in your browser address bar to allow microphone access for `http://localhost:3000`.
- **Casual conversation does not store memory:** This is intentional. Saying "The meeting was long" will not create a memory. You must explicitly say "Remember that..." or "Save this preference: ...".
- **Google Workspace status shows "Not configured":** The GWS CLI is not installed or `JARVIS_GWS_EXECUTABLE` is not configured in `.env.local`. JARVIS continues working with local Obsidian notes and memory.
- **Google Workspace status shows "Unauthenticated":** Authenticate your GWS CLI outside JARVIS by running `gws auth login`. JARVIS never collects credentials through the UI.
- **Google write tools (creating Docs, sending emails) are not available:** This is intentional. Phase 6 implements read-only access. Write tools require the user confirmation mechanism scheduled for Phase 9.
- **`create_note` does not write files:** This is intentional. `create_note` is registered with `write` permission and is safely blocked by the runtime until Phase 9 user confirmation is implemented.
- **Obsidian status shows "Not configured":** Set `OBSIDIAN_VAULT_PATH` in `.env.local` to the absolute path of your Obsidian vault, then restart the server.
- **Obsidian status shows "Unavailable":** The configured directory does not exist or cannot be read. Confirm the path in `.env.local`.
- **Provider not available:** Confirm `JARVIS_COMMAND_CODE_ENTRY` in `.env.local` points to Command Code's `index.mjs`.


