# PHASE 04 HANDOFF GATE

Use after `PHASE_04.md` and before `PHASE_05.md`.

Do not implement new features here.

Verify from the actual code and live system:

- Hermes is the active agent core.
- Stable JARVIS ↔ Hermes sessions work.
- A single run can perform multiple tool steps.
- Real Hermes events reach the JARVIS event stream.
- UI updates from real events.
- Cancellation reaches Hermes.
- Obsidian memory is canonical.
- Obsidian skills are discoverable.
- Confirmation/verification remain authoritative.
- No silent Ollama/Command Code fallback occurs.
- tests/lint/typecheck/build pass.
- live Hermes/Obsidian checks pass.

Also verify the settings/event foundation created for later phases:

- a normalized status snapshot exists
- the browser can consume live settings events without direct access to privileged services
- no secrets appear in the snapshot

Report:

PASSING
FAILED
NOT VERIFIED
ARCHITECTURE DRIFT
PHASE 05 BLOCKERS

Do not fix new issues in this handoff. STOP.
