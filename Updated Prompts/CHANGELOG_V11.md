# v11 changelog

## Main change

Converted the previous prompt pack into a full product/control-center specification centered on a functional JARVIS Settings UI.

## New / strengthened

- Binding `UI_GUIDE.md` for Antigravity.
- Functional Hermes settings from JARVIS Settings.
- Functional FreeLLMAPI gateway configuration/status from JARVIS Settings.
- Server-side settings snapshot + SSE event stream.
- Live settings health/state with revision/reconciliation.
- Provider credentials as write-only UI.
- Real apply/test/re-read/re-verify lifecycle.
- Explicit plugin manager phase.
- Specialist agent/delegation phase.
- Settings/Control Center completion phase.
- Stronger real-time diagnostics requirements.
- Real status over hardcoded “connected” labels.
- No direct browser access to privileged Hermes/FreeLLMAPI administration.
- No fake settings controls.
- FreeLLMAPI automatic routing remains backend-owned.
- Existing JARVIS visual shell remains; UI is extended rather than replaced.
