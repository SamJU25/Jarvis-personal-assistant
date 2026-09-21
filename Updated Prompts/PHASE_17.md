# PHASE 17 — BROWSER + BASIC WEB/GOOGLE/YOUTUBE ACTIONS

Use `MASTER_RULES.md`.

## Objective

Add a small, dependable browser capability set for everyday commands.

Do NOT build a universal browser/RPA planner.

## Basic commands

Support, where the installed Hermes/browser capability makes them reliable:

- “Open Google.”
- “Search Google for X.”
- “Search the web for X.”
- “Open this website.”
- “Open YouTube.”
- “Search YouTube for X.”
- “Play X on YouTube.”
- “Pause.”
- “Resume.”
- “Skip.”

## Routing

Prefer:

simple information retrieval → web-search capability
website interaction → browser capability
repeated small site action → tiny dedicated capability if useful

Do not open a browser just to answer a question that a safe search capability can answer.

## Inspect first

Inspect the actual installed Hermes/browser capability and current browser connection support.

Determine:
- browser backend
- session lifecycle
- tabs/windows
- navigation
- click/type/scroll
- playback control
- cancellation
- authentication isolation
- snapshots/screenshots

Do not invent tool names.

## YouTube

Keep YouTube deliberately small.

A request to play something should resolve/search/select a result, perform the action, and verify playback state when the installed browser capability exposes enough evidence.

Do not claim playback started merely because a click was attempted.

## Safety

- user-authenticated browser state stays local/server-side
- downloads remain bounded
- secrets never enter browser-visible diagnostics
- consequential actions require existing confirmation policy
- cancellation stops browser actions

## Acceptance

Live-verify:

1. open Google
2. search Google/web
3. open YouTube
4. search YouTube
5. play a selected result when supported
6. pause/resume
7. cancellation
8. honest failure when browser automation is unavailable

STOP.
