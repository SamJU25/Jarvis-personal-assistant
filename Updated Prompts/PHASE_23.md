# PHASE 23 — PLUGIN / EXTENSION MANAGER

Use `MASTER_RULES.md` and `UI_GUIDE.md`.

## Objective

Expose Hermes/JARVIS plugin state and safe plugin controls from the JARVIS Settings UI without rebuilding Hermes's plugin engine.

## Inspect first

Inspect the installed Hermes plugin system and the current JARVIS capability registry.

Determine:
- plugin discovery
- install location
- enable/disable
- dependency model
- tool/skill/hooks exposed by plugins
- UI extension support
- permission surface
- reload/restart behavior

Do not invent plugin APIs.

## UI

Settings → Plugins should show:

- installed plugins
- enabled/disabled
- version
- source
- tools count
- skills count
- permission summary
- health/last check

Actions:
- enable
- disable
- test
- refresh
- details

Provider/plugin secrets remain write-only.

## Safety

Installing or enabling a plugin must not automatically grant unlimited filesystem/network/computer access.

Show permissions before enabling when the plugin requires consequential access.

Never claim a plugin is active until the backend confirms it.

## Realtime

Plugin changes must emit settings events and update the Settings page live.

## Acceptance

- real plugin inventory
- real enable/disable state
- real health/test
- no secret leakage
- live settings update
- restart/reload handled honestly

STOP.
