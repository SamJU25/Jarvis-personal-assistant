# JARVIS UI GUIDE — LIVE CONTROL CENTER

This document is a binding product/UX specification for Antigravity when implementing or modifying the JARVIS website.

## 1. Product rule

JARVIS should feel like one personal assistant, not a collection of dashboards.

The UI should be cinematic and simple on the main surface, but the Settings/Control Center should expose real system state and real controls.

Do not build an IDE-style control plane.

Prefer:
- clear cards
- compact status chips
- one action per card
- progressive disclosure
- real-time status
- obvious failure states

Avoid:
- giant configuration tables as the default
- model pickers in the main assistant
- fake progress
- duplicated admin screens
- read-only values presented as configurable

## 2. Existing shell to preserve

Keep and extend the existing JARVIS visual language and components where practical:

- `JarvisShell`
- `CenterStage`
- `CommandBar`
- `ContextRail`
- `IntelligencePanel`
- mobile Assistant / Intelligence / System navigation
- existing confirmation cards
- existing debug shell

Do not replace the visual identity just to implement the control center.

## 3. Main Assistant surface

The default home view should remain simple:

```text
JARVIS

[ live activity / current task ]

"What can I do for you?"

        [ microphone ]
     Hold Space to talk

Hermes ●   Memory ●   Voice ●
```

When active, replace generic copy with real safe activity:

```text
🧠 Understanding request
🧩 Skill: Meeting Prep
🧠 Memory: searching Obsidian
📅 Calendar: reading
📧 Gmail: searching
✍️ Preparing response
```

Only show a row when the corresponding real event occurs.

## 4. Settings information architecture

Settings should use this structure:

```text
Settings
├── Overview
├── Hermes Core
├── Inference Gateway
├── Memory
├── Skills
├── Plugins
├── Voice
├── Channels
├── Capabilities
├── Security
└── Diagnostics
```

On desktop use a left section rail and content pane.
On mobile use the existing tab/navigation pattern.

## 5. Settings Overview

The Overview is a live health dashboard, not a static list.

Example:

```text
SYSTEM STATUS

Hermes Core          ● Connected
Inference Gateway    ● Healthy
Obsidian             ● Connected
Skills               ● Ready
Voice                ● Ready
Telegram             ● Connected
Google               ● Connected
Browser              ○ Disabled
Computer Control     ○ Disabled
```

Each card must include:
- current status
- concise explanation
- `lastCheckedAt`
- source/backend name when safe
- action if available

Statuses:
- connected
- degraded
- unavailable
- disabled
- not configured
- applying
- error

Do not render `Connected` unless the backend probe confirmed it.

## 6. Hermes Core settings

Show:

```text
HERMES CORE
Status: ● Connected
Version: <verified runtime version>
Gateway: <server endpoint label, never credentials>
Session: Ready
Runs: Ready
Delegation: Enabled/Disabled
Capabilities: <count>
Skills: <count>
```

Actions:
- Test Connection
- Refresh Capabilities
- Refresh Models
- View Active Session (safe metadata only)
- Advanced Hermes settings

If a setting requires a Hermes restart/reload, say so before applying.

Do not guess at a live-reload capability.

## 7. Inference Gateway settings

This is the FreeLLMAPI control surface.

Normal view:

```text
INFERENCE GATEWAY

Gateway: FreeLLMAPI
Status: ● Healthy
Base URL: http://127.0.0.1:3001/v1
Routing: Automatic
Strategy: Balanced
Streaming: ● Available
Tool Calling: ● Available
Current Routed Model: <if verified>
Current Routed Provider: <if verified>
Last Request: <time>
TTFT: <time>
```

Actions:
- Test Gateway
- Refresh Models
- Test Streaming
- Test Tool Calling
- Refresh Routing Status

Do not require the user to select a concrete model for everyday use.

Advanced view may expose:
- routing profile
- gateway URL
- unified API key (write-only)
- timeout
- strict gateway mode
- optional secondary gateway

Provider keys are managed behind a dedicated `Provider Credentials` dialog.

## 8. Provider credentials UX

Never show the actual stored key.

Display:

```text
Google     ● Configured
Groq       ● Configured
Mistral    ○ Not configured
```

When editing:

```text
API key
[ Enter new key ]

[ Save securely ]
```

After save:

```text
● Saved
● Health check passed
Last checked: <time>
```

If the installed FreeLLMAPI version exposes a supported management API, use it.
If not, use its supported declarative startup configuration safely on the server side and perform an explicit reload/restart if required.
Never pretend an edit was applied live when the gateway has not reloaded it.

## 9. Obsidian Memory settings

Show:

```text
MEMORY

Store: Obsidian
Status: ● Connected
Vault: <redacted label, not absolute path>
Memory files: <count if verified>
Index: ● Ready / Rebuilding
Last sync/reindex: <time>
```

Actions:
- Test Vault
- Reindex Memory
- Open Memory UI
- Create Memory Test

Do not display the full absolute filesystem path to the browser.

## 10. Skills settings

Show:

```text
SKILLS

Source: Obsidian / AI/Skills
Discovered: 18
Loaded this session: 3
Errors: 0
```

List:
- name
- description
- enabled/disabled
- source
- last discovered
- current version/hash if available

Actions:
- Refresh Skills
- Enable/Disable where supported
- Open skill
- Validate skill

Do not expose hidden instruction content in normal cards.

## 11. Plugins settings

Show installed plugins as compact cards:

```text
Obsidian       ● Enabled
Telegram       ● Enabled
Google         ● Enabled
Browser        ○ Disabled
```

Each plugin may show:
- status
- version
- tools count
- skills count
- permissions summary
- last health check

Actions:
- Enable/Disable
- Test
- Open details
- Refresh

Never grant a plugin permissions merely because it was installed.

## 12. Voice settings

Show real runtime values:

```text
VOICE
STT: Whisper          ● Ready
TTS: Kokoro           ● Ready
Microphone            ● Available
Speaker               ● Available
Push-to-talk          ● Space
Barge-in              ● Enabled
First-audio P50       0.9s
First-audio P95       1.4s
```

Actions:
- Test microphone
- Test speaker
- Test STT
- Test TTS
- Select voice
- Select input/output device

Do not store raw audio just for diagnostics.

## 13. Channels

Show:

```text
TELEGRAM     ● Connected
WHATSAPP     ○ Not configured
EMAIL        ● Connected
WEB          ● Connected
```

Actions:
- Connect
- Disconnect
- Test channel
- View safe session status

Channel configuration must reuse the same Hermes/JARVIS runtime.

## 14. Capabilities

Show what JARVIS can actually do:

```text
Memory             ✓
Skills             ✓
Web Search         ✓
Browser            ✓
YouTube            ✓
Files              ✓
Email              ✓
Telegram           ✓
WhatsApp           ○
Calls              ○
Computer Control   ○ Disabled
```

The UI must derive these states from the runtime capability manifest.

## 15. Security settings

Show policy, not secrets:

```text
CONFIRMATION
Writes: Required
External messages: Required
Calls: Required
Blocks: Required

FILE ACCESS
Allowed roots: <safe labels>

DANGEROUS HERMES TOOLS
Terminal: Disabled
Code execution: Disabled
Unrestricted filesystem: Disabled
Computer control: Disabled
```

Do not display secret values.

## 16. Diagnostics

The Debug/Diagnostics UI must be live.

Preferred architecture:

```text
Hermes SSE + backend probes
          ↓
      JARVIS EventBus
          ↓
 ┌────────┼─────────┐
 UI     Trace     Diagnostics
```

Display a timeline such as:

```text
12:03:01 RUN_STARTED
12:03:01 SESSION_RESUMED
12:03:01 SKILL_SELECTED meeting-prep
12:03:02 MEMORY_SEARCH_STARTED
12:03:02 MEMORY_SEARCH_COMPLETED
12:03:03 TOOL_STARTED get_calendar_events
12:03:03 TOOL_COMPLETED get_calendar_events
12:03:04 ASSISTANT_TEXT_DELTA
12:03:04 TTS_SENTENCE_STARTED
12:03:05 RUN_COMPLETED
```

No 3-second browser polling as the primary live mechanism.

## 17. Live settings state architecture

The website must use a normalized server state model.

Recommended contracts:

`SystemStatusSnapshot`
- revision
- generatedAt
- hermes
- inference
- memory
- skills
- plugins
- voice
- channels
- capabilities
- security

`SettingsEvent`
- eventId
- revision
- timestamp
- domain
- type
- status
- safe payload

Use Zod validation for both.

## 18. Realtime transport

Preferred endpoints (adapt names to the existing repo if needed):

`GET /api/settings/snapshot`
`GET /api/settings/events` (SSE)

Domain write/test endpoints may follow the existing API conventions, for example:

`POST /api/settings/hermes/test`
`PATCH /api/settings/hermes`
`POST /api/settings/inference/test`
`PATCH /api/settings/inference`
`POST /api/settings/memory/test`
`POST /api/settings/skills/refresh`
`POST /api/settings/plugins/:id/test`

Do not expose Hermes/FreeLLMAPI privileged APIs directly to the browser.

## 19. Backend health supervisor

If a service has no native push event for health, the JARVIS server may probe it on a bounded cadence (for example 5–15 seconds) and emit changes only when state changes or a heartbeat is needed.

The browser should subscribe to one JARVIS SSE stream, not poll every service itself.

Do not create a large distributed monitoring platform.

A small process-local supervisor is sufficient for the current single-user architecture.

## 20. Write lifecycle

Every settings write follows:

`idle → applying → applied/error → verified`

The UI must disable conflicting controls while the write is in progress.

On success:
- re-read actual configuration
- re-probe the service if relevant
- update snapshot
- emit settings event

On failure:
- preserve previous known-good UI state
- show exact safe error
- do not pretend save succeeded

## 21. Responsive behavior

Desktop:
- left section navigation
- main content cards
- activity/status rail where useful

Tablet/mobile:
- existing mobile tab model
- Settings section select/dropdown or stacked sections
- cards collapse cleanly
- no horizontal overflow

The main assistant remains visually dominant; Settings is a control surface, not the home screen.

## 22. Accessibility

Require:
- keyboard navigation
- visible focus
- correct button/label semantics
- live regions for important status changes
- no color-only status meaning
- confirmation dialogs reachable by keyboard

## 23. Do not fake functionality

The following are forbidden:

- hardcoded “Connected” when no probe ran
- fake model lists
- fake provider routing
- fake test buttons
- fake save success
- fake plugin enable state
- fake live activity
- simulated token streaming

If backend support does not exist, implement an honest unavailable state and document the missing control path.

## 24. Design target

The finished product should feel like:

```text
one assistant
one settings center
one source of live truth
many capabilities
```

not:

```text
JARVIS UI + Hermes dashboard + FreeLLMAPI dashboard + five separate settings systems
```

Provide optional “Open native dashboard” links for deep administration only when needed, but do not require them for normal JARVIS operation.
