# Prompt Pack v2 — What Changed

This update was made after re-checking the current Hermes main branch and current Google Gemini Live documentation on 2026-09-21.

## Critical fixes

1. Hermes API lifecycle
- Added current Runs API endpoints and SSE lifecycle guidance.
- Added stop and approval endpoint handling.
- Clarified that Chat Completions is stateless by itself.
- Added stateful Responses/session guidance.

2. Hermes tool security
- Added deterministic /v1/toolsets and /v1/skills discovery.
- Explicitly require restricting the API-server toolset instead of assuming the default is safe.
- Added current toolset behavior from the official Hermes reference.

3. Model selection
- Added current Hermes authenticated model/provider discovery guidance.
- JARVIS must not hard-code a model list or silently substitute an unavailable model.

4. Google Gemini
- Phase 4 uses native Gemini provider configuration through Hermes.
- Free-tier/billing limitations are left to runtime verification rather than assumed.

5. Web research
- Multi-provider web research is deliberate and task-dependent, not an every-query broadcast.
- Search/extract backends are discovered from the installed Hermes version.

6. Browser
- Phase 10 first checks Hermes browser capabilities/browser-control before creating duplicate browser infrastructure.

7. Gemini Live
- Phase 13 now explicitly requires true bidirectional streaming.
- No STT -> wait -> full reasoning -> Kokoro TTS architecture for Live Mode.
- Current Google docs identify gemini-3.8-live for low-latency voice and gemini-3.8-live-extended-thinking for background reasoning with asynchronous tools.
- Phase 13 requires interruption/barge-in and streamed native audio.

8. Configuration
- Phase 16 keeps the compact JARVIS Configuration hub and makes Hermes the real configuration authority.
- Current dashboard default 127.0.0.1:9119 is documented, but the prompt still requires checking the actual configured port.
