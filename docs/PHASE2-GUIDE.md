# Phase 2: Agent Provider — Developer Guide

This guide explains what Phase 2 adds, how the provider boundary works, and how to run it safely.

## What was built

Phase 2 connects the Phase 1 visual shell to a real reasoning provider — Command Code headless mode — without rebuilding the UI. Everything from Phase 1 (shell, core, reducers, renderers, settings, debug) is preserved and reused.

New/added modules:

- `src/lib/config/` — server-side environment parsing. Reads `JARVIS_COMMAND_CODE_ENTRY` (absolute path to Command Code's `index.mjs`).
- `src/lib/run/` — validated run-result and event contracts (`RunResult`, `AgentEvent`).
- `src/lib/provider/` — provider runtime: NDJSON parser and Command Code adapter.
- `src/app/api/agent/status/` — health/auth/model label endpoint.
- `src/app/api/agent/stream/` — streaming endpoint that runs Command Code and emits sanitized NDJSON.

## How the provider boundary works

1. The browser submits a bounded message + conversation history through `/api/agent/stream`.
2. The route spawns `node <entry>` with fixed safe arguments (`--output-format json`, `--permission plan`, `--no-session`). Raw model/user input is never concatenated into shell arguments.
3. Command Code emits NDJSON events. The parser in `src/lib/provider/ndjson-parser.ts` consumes them incrementally.
4. Only the final `result` frame is trusted. Raw `run_end` state, trace IDs, session IDs, deltas, and stderr are discarded.
5. The `result` is validated with Zod against `RunResultSchema`. Only `provider`, `model`, `durationMs`, and aggregate `usage` reach the UI.
6. The client (`JarvisShell`) streams normalized `AgentEvent` objects into the existing Phase 1 reducer, driving the core states (thinking, idle, error) and the intelligence panel.

**Security boundary:**

- The `cmd` executable is validated against Windows `System32\cmd.exe` and rejected.
- Prompts enter via stdin — never as CLI arguments.
- No shell is ever used (`shell: false` / `spawn` argument arrays).
- Only validated, public-facing fields reach the UI.

## Running it

```powershell
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), type a message, and press Send.

Check the status endpoint:

```powershell
curl http://localhost:3000/api/agent/status
```

Expected: `{"available":true,"authenticated":true,"provider":"Command Code","model":"<default model>"}`

## Configuration

Create `.env.local` (keep it ignored):

```env
JARVIS_COMMAND_CODE_ENTRY=C:\Users\Sam\AppData\Local\Programs\Command Code\resources\app\node_modules\@commandcode\harness\dist\bundled/command-code/index.mjs
```

This is the absolute path to Command Code's bundled entry. Find it with:

```powershell
npm ls command-code -g    # after: npm i -g command-code
```

## Testing

```powershell
npm run test
npm run typecheck
```

Phase 2 adds provider/parser/contract tests. Phase 1 tests remain unchanged.

## What's NOT here (yet)

- No tools (Phase 3)
- No skills (Phase 5)
- No Google Workspace, Obsidian, voice, memory, writes, or verification
- Settings are not persisted; microphone/stop remain placeholders
