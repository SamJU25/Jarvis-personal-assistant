# PHASE 13 — GEMINI LIVE REAL-TIME VOICE

GLOBAL RULES
- Work on the existing JARVIS repository. Do not rebuild it.
- Implement ONLY the numbered phase in this file. Do not continue into later phases.
- Before coding, inspect the current repository and actual Hermes checkout.
- Read JARVIS_MASTER_PROMPT.md, AGENTS.md, README.md, docs/ARCHITECTURE.md, docs/ROADMAP.md, docs/SECURITY.md, and relevant source/tests.
- Actual source code is authoritative when docs are stale.
- Do not invent Hermes APIs. Use the checked-out Hermes version and its current docs.
- Preserve working Phase 9–12 confirmation, verification, diagnostics, voice, memory, and tool boundaries unless the phase explicitly changes them.
- Never put API keys, OAuth tokens, refresh tokens, or secrets in browser/client code.
- Never claim success without actual evidence.
- Run relevant tests, lint, typecheck, build, and real runtime/browser verification.
- Report NOT VERIFIED where a dependency/device/credential prevents real verification.
- When this phase is verified, STOP. Do not implement the next phase.


Google Live API references:
https://ai.google.dev/gemini-api/docs/live-api/get-started-sdk
https://ai.google.dev/gemini-api/docs/live-api/tools

## Goal
Add an optional TRUE real-time Gemini Live mode while preserving the existing Whisper/Kokoro architecture until Live is verified.

This phase must address the current JARVIS problem where voice input waits roughly 4–5 seconds for reasoning/text completion before speech starts.
The Live path must not be implemented as speech-to-text → full model response → Kokoro TTS.

## Architecture
Normal:
JARVIS → Hermes → configured provider/model

Live:
Wake word / push-to-talk
→ JARVIS Live Gateway
→ Gemini Live WebSocket
→ streamed audio in
→ streamed native audio out
→ JARVIS presentation

Do NOT send the real-time audio turn through Hermes as an intermediate hot-path hop.
Hermes remains the normal agent backend. Gemini Live is the dedicated low-latency voice path.

## Current Gemini Live model guidance
Google currently documents:
- gemini-3.8-live as the default low-latency Live model for real-time voice
- gemini-3.8-live-extended-thinking for higher background reasoning during live interaction

Do not hard-code these model IDs permanently; discover/validate the currently supported Live model from Google documentation and configuration at implementation time.

For Extended Thinking, track `interactionStatus`/`interaction_status` and do not treat `turnComplete` alone as the end of the overall interaction. Use non-blocking function declarations for tools used by the thinking Live model.


## Real-time voice requirements
- stream microphone audio continuously in small chunks; do not wait for the entire utterance before sending
- use Gemini native audio output for Live Mode; do not route primary Live speech through Kokoro
- start playback as soon as audio arrives; do not wait for the complete final answer
- support barge-in/interruption and discard queued assistant audio immediately
- keep the Live session open for conversational turns
- keep wake-word detection local and lightweight; the wake phrase itself should not trigger a full reasoning turn
- expose LISTENING, THINKING/IN_PROGRESS, SPEAKING, INTERRUPTED, and IDLE from actual Live events
- when Extended Thinking is used, allow spoken conversational fillers while asynchronous tools/reasoning continue
- side-effecting tools still return through JARVIS confirmation/verification

## Implementation
Use the current Google GenAI SDK/API.
Use the current supported Live model from Google's documentation.
Do not hard-code obsolete model names.

Implement incrementally:
- push-to-talk
- real-time audio
- speaking/listening state
- barge-in/interruption
- mute
- connection lifecycle
- reconnect

## Security
Never expose a long-lived Gemini API key in browser code.
Use the current server-mediated or ephemeral-auth approach supported by the current Live API.

## Tool calls
Gemini Live supports function calling. Any side-effecting function must return through the JARVIS tool/permission boundary.

## Verify
Connect, speak, respond, interrupt, mute, disconnect, reconnect, tool call, denied tool call, secret safety.

Run all quality gates.

STOP.
