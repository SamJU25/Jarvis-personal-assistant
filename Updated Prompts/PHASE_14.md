# PHASE 14 — LOW-LATENCY VOICE EXPERIENCE + TRUE HOLD-TO-TALK

Use `MASTER_RULES.md`.

## Objective

Make voice feel immediate and conversational.

The target is NOT simply “make the page show an answer faster.” The target is:

```text
Space DOWN
  → mic/listening immediately

Space UP
  → final transcript immediately
  → Hermes run immediately
  → real streamed model text
  → first complete safe sentence/clause
  → TTS immediately
  → first audible playback
  → later text/audio continue in parallel
```

The primary metric is **time-to-first-audio (TTFA)** plus total completion time.

Do not create a second voice agent.

## 1. Audit the real pipeline

Inspect actual implementations and versions for:

- microphone capture
- Space PTT
- STT/Whisper lifecycle
- transcript finalization
- Hermes request/run/event stream
- JARVIS reducer
- TTS/Kokoro lifecycle
- audio playback
- barge-in
- cancellation
- echo guard
- voice state

Measure before changing architecture.

## 2. Voice latency trace

Record monotonic timestamps for:

- `ptt_pressed_at`
- `capture_started_at`
- `ptt_released_at`
- `stt_started_at`
- `stt_completed_at`
- `hermes_run_started_at`
- `first_model_text_delta_at`
- `first_committed_sentence_at`
- `tts_started_at`
- `first_audio_ready_at`
- `first_playback_at`
- `final_response_at`
- `playback_completed_at`

Show derived timings in diagnostics.

Do not store raw audio, transcripts, prompts, tool args, or private memory just for telemetry.

## 3. Pre-warm

Where practical, keep STT and TTS ready before a voice turn.

Measure cold-start and warm-start separately.

If a safe idle-unload policy is needed, preserve it; do not permanently waste resources just to improve one benchmark.

## 4. True Space hold-to-talk

When the JARVIS page is focused:

Space DOWN:
- start listening
- prevent page scroll
- enter LISTENING
- ignore repeated keydown events

Space HELD:
- continue capture through natural pauses
- do not submit partial thoughts

Space UP:
- stop capture
- finalize one transcript
- submit exactly one agent turn

Handle safely:
- IME/composition
- focused text fields
- focus loss
- empty transcript
- duplicate key events

Do not claim browser Space PTT is a system-wide global hotkey.

## 5. Streaming STT

If the installed STT backend supports useful interim results, surface them as UI-only feedback.

Interim results must not submit agent turns.

If the current STT backend is non-streaming, do not fake streaming.

## 6. Fast vs agent lane

Keep ONE agent: Hermes.

For simple, low-risk conversational requests, a fast inference preference may be used where the configured gateway supports it.

For anything requiring:
- tools
- memory
- skills
- files
- research
- reminders
- Google
- browser actions
- messaging
- side effects

use the normal Hermes run.

This is a latency optimization, not a second brain.

## 7. Voice response policy

Voice-mode answers should normally be concise:
- answer directly
- no unnecessary preamble
- no repeated user prompt
- avoid markdown-heavy narration
- do not omit important facts

If the user asks for detail, provide detail.

## 8. Instant acknowledgement

For genuinely long-running work, the presentation layer may immediately speak a deterministic line such as:

“On it.”

“Working on that now.”

The acknowledgement:
- is not model-generated
- does not claim completion
- does not authorize a side effect
- must not invent a result

## 9. Real streaming model → TTS

Use the actual Hermes text stream:

```text
Hermes text delta
  ↓
sentence/clause buffer
  ↓
TTS queue
  ↓
audio playback
```

Start TTS from the first safe sentence/clause before the whole response finishes when the installed TTS path supports it.

Do not speak:
- hidden reasoning
- raw tool payloads
- JSON
- internal event names
- unverified side-effect claims

## 10. Continuous audio playback

Prefer one continuous playback queue.

Do not create a fresh process/connection for every sentence unless the backend requires it.

Measure inter-sentence gap.

## 11. Barge-in

If the user presses Space while JARVIS is speaking:

- cancel queued TTS
- interrupt current playback when supported
- invalidate stale audio
- switch to LISTENING
- allow the new turn to become authoritative

Use a turn/cancellation epoch or equivalent stale-result protection.

## 12. Self-echo protection

JARVIS must not answer its own TTS output.

Prefer a playback-aware echo guard over a long fixed microphone mute.

The user should be able to speak immediately after the assistant finishes.

## 13. Long-task example

For:

“Prepare my meeting brief.”

Use:

```text
user finishes
  ↓
optional instant acknowledgement
  ↓
Hermes run starts
  ↓
real skill/tool/memory work
  ↓
live JARVIS status events
  ↓
final verified answer text
  ↓
first sentence → TTS
  ↓
remaining sentences → streamed TTS queue
```

Do not speak speculative intermediate results as final facts.

## 14. UI states

Use real states:

IDLE
LISTENING
TRANSCRIBING
THINKING
WORKING
SPEAKING
INTERRUPTED
ERROR

Do not fake progress timers.

## 15. Performance gate

Create a real voice benchmark with:

- cold turn
- warmed turn
- simple conversation
- Hermes tool task
- interrupted turn

Report at least:

P50 and P95 for:
- release → transcript complete
- transcript complete → first model token
- transcript complete → first audio
- transcript complete → final response

Do not optimize until the bottleneck is measurable.

## 16. Acceptance

Live-verify:

1. hold Space → mic starts
2. pause mid-sentence → still listening
3. release Space → exactly one turn submitted
4. simple request → fast response path where configured
5. complex request → Hermes run
6. UI receives streaming text/events
7. TTS begins before final response when supported
8. barge-in stops stale audio
9. no self-echo response
10. cold/warm latency is measured
11. no fake streaming

Run tests/lint/typecheck/build and real browser/audio verification.

STOP.
