# JARVIS — MASTER BUILD SPECIFICATION FOR COMMAND CODE

## 0. ROLE

You are the primary software architect, implementation engineer, QA engineer, security reviewer, and technical mentor for this repository.

## SOURCE PROMPT FIDELITY

This project is based on the JARVIS master specification supplied by the developer from an existing JARVIS build prompt.

Preserve the source prompt's:
- product vision
- natural-language experience
- tool/skill architecture
- Obsidian workflow
- Google Workspace workflow
- memory
- structured output
- event stream
- confirmation system
- cinematic interface
- JARVIS core
- ElevenLabs voice
- demo flows
- security principles
- phased development philosophy

Only make these environment-specific adaptations:
1. Target Windows desktop instead of Mac.
2. Use Command Code as the initial reasoning-provider integration because that is the developer's current coding/model environment.
3. Keep the AgentProvider abstraction so a Codex CLI or Claude Code CLI provider can be added later.
4. Keep the application runtime separate from the coding-agent environment.

Do not remove source features merely because the initial implementation starts smaller.

I am a beginner developer building JARVIS through AI-assisted coding and learning by making the project.

This file is the MASTER PRODUCT SPECIFICATION.

Treat it as the long-term source of truth for product vision, architecture, UX, safety, integrations, and development direction.

IMPORTANT:
- Do not blindly implement everything in one giant pass.
- Preserve the complete product vision while implementing in controlled milestones.
- Inspect the existing repository before making assumptions.
- Prefer simple, readable, maintainable code.
- Never claim a feature is implemented unless it is actually implemented and verified.
- Never create fake functionality merely to make the UI look convincing.

---

# 1. PRODUCT

Project name:

JARVIS

Product type:

Local-first personal AI operating assistant.

JARVIS is NOT a chatbot.

The core product loop is:

NATURAL LANGUAGE COMMAND
→ UNDERSTAND
→ PLAN
→ SELECT TOOLS / SKILLS
→ EXECUTE
→ VERIFY
→ SYNTHESIZE
→ PRESENT
→ SPEAK CONCISELY

The user should be able to naturally say things such as:

- "Jarvis, prepare me for my next meeting."
- "What am I doing tomorrow afternoon?"
- "Did Yusuf send me anything recently?"
- "What did I write down about DeepSeek?"
- "Give me my morning briefing."
- "What am I forgetting?"
- "Find everything I know about agentic harnesses."
- "Take a note: the next video should open with the result first."
- "Turn this into a Google Doc."

The user must not need to memorize special commands.

JARVIS should infer intent and decide whether tools and/or skills are required.

The product philosophy is:

> JARVIS does not need hundreds of integrations. It needs a small set of reliable tools, well-defined processes, and an intelligent agent capable of combining them.

---

# 2. PRIMARY USER EXPERIENCE

The user should interact naturally through text and eventually voice.

The agent decides:

- whether tools are needed
- which tools are needed
- whether a skill/process applies
- whether multiple tools are required
- whether independent tool calls can run in parallel
- what information is relevant
- how to present the result visually
- what the concise spoken summary should be

The user experience should feel like:

"I tell JARVIS what I want. JARVIS figures out how to do it."

It should NOT feel like:

"I have to control a complicated workflow manually."

Human approval is still required for write/risky actions.

---

# 3. TARGET PLATFORM

Primary development platform:

Windows desktop.

Primary local URL:

http://localhost:3000

The application should be local-first.

Do not introduce cloud hosting or distributed infrastructure in the initial project.

The architecture should remain extensible for future cross-platform and cloud execution, but V1 must stay simple enough for a solo beginner developer.

---

# 4. TECHNOLOGY

Use:

- Next.js
- React
- TypeScript
- Tailwind CSS
- Framer Motion
- ElevenLabs for speech input/output
- Node.js server runtime
- Zod
- Node child_process / execFile / spawn for controlled subprocesses when a CLI provider or safe wrapper requires it
- Node fs/promises for controlled local file access
- Playwright later for browser automation
- SQLite + Drizzle only when structured persistent application state actually requires it
- GWS CLI for Google Workspace access

Avoid unnecessary infrastructure.

Do NOT introduce unless a concrete requirement appears:

- Docker
- Redis
- queues
- PostgreSQL
- Kubernetes
- n8n
- distributed workers
- unnecessary microservices
- unnecessary MCP infrastructure
- cloud hosting dependencies

Prefer a modular monolith.

Keep the application understandable to a beginner.

---

# 5. REASONING ENGINE

JARVIS requires a provider abstraction.

The source design uses a locally installed agent CLI such as Codex CLI or Claude Code CLI. For this developer's environment, the initial provider is Command Code's Provider API. The architecture must preserve the source-level provider abstraction so the reasoning backend can later be swapped to a CLI-based provider.

The application runtime must remain separate from the coding-agent environment.


Create:

AgentProvider

Initial provider:

Command Code Provider

The JARVIS application should use Command Code's supported provider/API path for its runtime reasoning rather than tightly coupling all application logic to terminal-text parsing.

The architecture must permit future providers.

Conceptual interface:

runAgent({
  request,
  conversation,
  availableTools,
  availableSkills,
  context
})

The provider returns structured events and/or a validated final result.

When a CLI provider is used in the future:
- prefer non-interactive mode
- prefer structured JSON/NDJSON output where available
- do not scrape pretty terminal output unless no structured mode exists
- use controlled child_process/execFile/spawn invocation
- never expose unrestricted shell access through the application

Future providers may include:
- Codex CLI provider
- Claude Code CLI provider
- other compatible model providers
- local models

Do not hard-code one model throughout the application.

Allow model selection/configuration where useful.

IMPORTANT:

The coding agent used to build the project and the reasoning provider used by the JARVIS application are conceptually separate.

Do not assume the developer CLI itself should be embedded blindly into the final application.

---

# 6. FOUR CORE LAYERS

Keep these concepts separate:

1. BRAIN
2. TOOLS
3. PROCESSES / SKILLS
4. INTERFACE

Additional cross-cutting systems:

- MEMORY
- PERMISSIONS
- VERIFICATION
- EVENTS
- VOICE
- DEBUG / OBSERVABILITY

Conceptual architecture:

User
↓
Interface
↓
Agent Runtime
↓
Agent Provider
↓
Reasoning Model
↓
Tool / Skill Decisions
↓
Permission Layer
↓
Tool Execution
↓
Verification
↓
Structured Result
↓
Interface + Voice

---

# 7. AGENT RUNTIME

The runtime is responsible for:

- understanding the request
- resolving conversational context
- selecting a skill
- creating a plan
- selecting tools
- deciding tool ordering
- executing approved tools
- interpreting results
- deciding whether more tools are required
- synthesizing results
- producing structured UI output
- producing a concise spoken response

The model must NOT directly execute arbitrary system operations.

The model proposes semantic tool calls.

The application executes trusted tool implementations.

---

# 8. TASK LIFECYCLE

Use:

UNDERSTAND
→ PLAN
→ EXECUTE
→ VERIFY
→ COMPLETE

Possible task states:

- queued
- planning
- executing
- waiting_for_approval
- verifying
- completed
- failed
- cancelled

Every task needs a clear final state.

The agent must never claim an action succeeded unless the application confirmed success.

---

# 9. TOOL SYSTEM

Create a central Tool Registry.

Every tool must define:

- id
- name
- description
- input schema
- output schema
- permission level
- renderer type
- source type
- execute function

Use Zod runtime validation.

Conceptual interface:

Tool<TInput, TOutput>

Properties:

- id
- name
- description
- inputSchema
- outputSchema
- permission
- renderer
- source
- execute()

Tool descriptions should be written for the reasoning model.

Each description should explain:

- what the tool does
- when to use it
- when NOT to use it
- what it returns
- important limitations

---

# 10. TOOL PERMISSIONS

Permissions MUST be enforced in application code.

Do not rely only on model instructions.

Permission categories:

READ
WRITE
DANGEROUS

READ can normally execute automatically.

Examples:
- search_vault
- read_note
- search_gmail
- read_gmail
- get_calendar_events
- search_drive
- read_drive_file

WRITE requires explicit confirmation.

Examples:
- create_note
- create_google_doc
- draft_email
- create_calendar_event

DANGEROUS requires explicit confirmation and stronger restrictions.

Examples:
- send_email
- delete_file
- delete_calendar_event
- destructive note modification

Avoid dangerous tools in the first version whenever possible.

The model must never be able to modify its own permission policies.

---

# 11. OBSIDIAN

The user may have an existing Obsidian second-brain vault.

Configuration:

OBSIDIAN_VAULT_PATH

Access it server-side only.

Never expose raw filesystem access to the browser.

Initial tools:

- search_vault
- read_note
- create_note

## search_vault

Input:
- query
- optional limit

Search:
- filenames
- Markdown content
- headings
- tags where useful

Prefer fast local text search before introducing embeddings.

Return:
- path
- title
- excerpt
- relevance when available
- modifiedAt

## read_note

Input:
- path

Return:
- title
- content
- metadata
- modifiedAt

All paths must resolve within OBSIDIAN_VAULT_PATH.

Prevent path traversal.

## create_note

Input:
- title
- content
- optional folder

Default:

Inbox/JARVIS/

Do not overwrite an existing note unexpectedly.

Return:
- path
- title
- createdAt

---

# 12. GOOGLE WORKSPACE

The user's machine may already have GWS CLI installed and authenticated.

Use GWS CLI as the Google Workspace execution layer.

Do NOT implement Google OAuth directly in the first version if an already-authenticated GWS CLI is available.

Do NOT expose GWS CLI directly to the model.

Create semantic application tools that internally invoke known safe GWS operations.

Example:

Agent selects:

search_gmail({
  query: "from:yusuf newer_than:14d"
})

Backend performs a predefined safe GWS operation.

The model must never construct arbitrary shell commands.

Use:

execFile()
or
spawn()

with argument arrays.

Avoid shell=true.

Never concatenate raw user or model input into executable command strings.

Normalize external responses before sending them into the agent.

---

# 13. GOOGLE TOOLS

Initial Google tools:

- search_gmail
- read_gmail
- get_calendar_events
- search_drive
- read_drive_file
- create_google_doc
- draft_email

## search_gmail

Input:
- query
- optional limit

Return:
- id
- senderName
- senderEmail
- subject
- snippet
- timestamp
- labels
- hasAttachments

## read_gmail

Input:
- messageId

Return:
- sender
- recipients
- subject
- timestamp
- body
- attachment summary

## get_calendar_events

Input:
- start
- end
- optional query

Return:
- id
- title
- start
- end
- attendees
- location
- description

## search_drive

Input:
- query
- optional limit

Return:
- id
- name
- type
- modifiedAt
- owner
- webLink when available

## read_drive_file

Input:
- fileId

Return clean textual content and metadata for supported textual documents.

## create_google_doc

Permission:

WRITE

Require confirmation.

Return:
- documentId
- title
- link

## draft_email

Permission:

WRITE

Require confirmation.

Input:
- to
- subject
- body
- optional replyToMessageId

Do NOT implement automatic email sending in the first version.

---

# 14. SKILLS / PROCESSES

Tools define what JARVIS CAN do.

Skills define HOW JARVIS should perform recurring workflows.

Use:

skills/<skill-name>/SKILL.md

Initial skills:

- meeting-prep
- morning-briefing
- capture-note
- research
- loose-ends

The user should not need to explicitly name a skill.

Create a Skill Registry/Loader.

Each skill defines:

- purpose
- when to use it
- workflow
- preferred tools
- decision rules
- verification requirements
- expected output

Do not hard-code every skill into the agent runtime.

---

# 15. MEETING PREP

Process:

1. Find the relevant upcoming calendar event.
2. Identify attendees, company, and subject.
3. Search recent relevant Gmail correspondence.
4. Search Obsidian for related notes.
5. Search Drive when useful.
6. Identify:
   - recent changes
   - commitments
   - decisions
   - unresolved issues
   - preparation items
7. Rank information by importance.
8. Produce:
   - concise spoken briefing
   - structured UI cards
   - source references

Primary request:

"Jarvis, prepare me for my next meeting."

Expected chain:

Calendar
→ Gmail
→ Obsidian
→ Drive if useful
→ synthesis

---

# 16. MORNING BRIEFING

Use:

- today's calendar
- important/relevant recent email
- recent Obsidian notes
- useful TODOs

Surface:

- schedule
- important messages
- deadlines
- unresolved items
- preparation items
- possible loose ends

Do not overwhelm the user.

---

# 17. CAPTURE NOTE

Natural requests:

"Take a note..."
"Remember this..."
"Put this in my second brain."

Create a clean Markdown note in:

Inbox/JARVIS/

Respect the write confirmation policy.

---

# 18. RESEARCH SKILL

Purpose:

Answer questions about what the user already knows across personal sources.

Search:

- Obsidian
- Drive
- Gmail where relevant

Cluster findings by topic.

Show sources.

Clearly distinguish:

- directly found information
- inferred relationships
- uncertainty

Never invent personal knowledge.

---

# 19. LOOSE ENDS

Search for possible unfinished obligations from:

- recent notes
- meeting notes
- TODOs
- email requests
- follow-up commitments
- calendar preparation

Never present an inferred obligation as certain.

Use language such as:

"Possible loose end"

rather than:

"You forgot to..."

---

# 20. MEMORY

Start simple.

Do NOT add embeddings/vector databases initially.

Use structured local memory.

Categories:

- user_preference
- project_fact
- important_decision
- task_fact
- saved_note

Each memory record contains:

- id
- type
- content
- source
- createdAt
- updatedAt
- importance

Initial tools:

- remember
- search_memory
- forget_memory

Do not automatically save everything.

The agent should decide what is worth remembering.

Upgrade to semantic/hybrid retrieval only after a real use case appears.

---

# 21. CONVERSATIONAL CONTEXT

Support follow-ups.

Example:

User:
"What am I doing tomorrow?"

User:
"What about after lunch?"

JARVIS must understand the second request in context.

Do not send unlimited history.

Implement sensible context trimming.

Keep:
- conversation state
- task state
- long-term memory

as separate concepts.

---

# 22. STRUCTURED OUTPUT

Use a validated structured result.

Create Zod schemas.

Concept:

{
  speech: string,
  title: string,
  state: "complete" | "failed" | "waiting_for_approval",
  cards: [],
  sources: []
}

Supported card types:

- meeting
- calendar
- email
- note
- insight
- action
- document
- research
- source
- generic

Never render arbitrary HTML generated by the model.

Render only validated structured data using trusted React components.

If validation fails:

1. log the failure
2. attempt safe recovery
3. do not crash the UI
4. provide a safe fallback

---

# 23. EVENT STREAM

The backend should emit structured events.

Examples:

- agent_started
- plan_created
- skill_selected
- tool_started
- tool_completed
- tool_failed
- confirmation_required
- agent_synthesizing
- verification_started
- verification_completed
- response_ready
- audio_started
- audio_finished

Example:

{
  "type": "tool_started",
  "tool": "search_gmail",
  "label": "Checking recent correspondence"
}

The UI should render actual application events.

Never fabricate activity simply for visual effect.

---

# 24. VERIFICATION

Meaningful tasks must be verified.

Lifecycle:

UNDERSTAND
→ PLAN
→ EXECUTE
→ VERIFY
→ COMPLETE

Examples:

Code:
- tests
- lint
- build when appropriate

File:
- confirm file exists
- confirm expected result

Browser:
- confirm navigation
- confirm expected content

Google:
- confirm operation result

The final response must reflect actual verification.

---

# 25. VOICE

Voice is a primary interface, but it must use the same command pipeline as text.

Architecture:

Microphone
→ Speech-to-Text
→ JARVIS command pipeline
→ structured response
→ Text-to-Speech

Use ElevenLabs.

Later capabilities:

- push-to-talk
- live transcript
- listening state
- speaking state
- interruption / barge-in
- concise spoken summaries
- audio-reactive UI

Do NOT create a separate voice agent.

Do NOT begin with always-listening wake words.

Do NOT store recordings by default.

Spoken responses should normally be 1–4 concise sentences.

Detailed context belongs in the UI.

---

# 26. INTERFACE

Visual quality is a first-class requirement.

Do NOT build:

- generic chatbot UI
- normal chat bubbles
- standard SaaS dashboard
- excessive neon
- fake code streams
- random hexadecimal decoration
- excessive gradients
- clutter

The product should feel like:

Apple-level polish
+
cinematic HUD
+
modern command center

Visual direction:

- near-black background
- restrained white / blue / cyan lighting
- glass surfaces
- extremely subtle gradients
- controlled bloom
- depth
- thin lines
- premium typography
- lots of negative space
- intentional motion
- high-end minimalism

The interface should be built around:

observing
reasoning
retrieving
acting
synthesizing

not around conversation bubbles.

---

# 27. JARVIS CORE

The center of the interface is an animated JARVIS core.

Use sophisticated layered geometry, not a generic glowing orb.

Possible layers:

1. atmospheric glow
2. outer orbital ring
3. secondary ring
4. inner radial geometry
5. waveform/frequency response
6. central energy/core layer

Possible techniques:

- concentric rings
- circular waveform
- orbital elements
- subtle particles
- radial response
- parallax
- depth
- soft bloom
- dynamic line geometry

States:

IDLE
- slow ambient movement

LISTENING
- responds to microphone amplitude/input

THINKING
- activity increases

EXECUTING
- visual emphasis reflects active tools/process

SPEAKING
- reacts to actual audio playback when possible

CONFIRMATION
- clearly separates proposed action from completed action

ERROR
- subtle amber/red state

Do not make error states overly dramatic.

Do not use visual activity as fake evidence of agent activity.

---

# 28. MAIN LAYOUT

Desktop-first.

CENTER:
- JARVIS core
- live transcript
- current spoken response

LEFT:
- date
- time
- voice status
- agent provider
- selected model
- Obsidian status
- Google status
- current skill
- system state

RIGHT:
- dynamic intelligence panel
- result cards
- tool activity
- sources

BOTTOM:
- text command input
- microphone control
- send/submit
- stop/cancel

Avoid chat bubbles as the main visual language.

---

# 29. TOOL ACTIVITY UI

Show useful activity without clutter.

Examples:

CALENDAR
Finding next meeting...

GMAIL
Reviewing recent messages...

OBSIDIAN
Searching previous notes...

DRIVE
Finding related documents...

SYNTHESIZING
Preparing briefing...

Statuses:

- queued
- running
- complete
- failed

Completed activity can collapse.

---

# 30. DYNAMIC CARD RENDERERS

Create a renderer registry.

Card types:

- meeting
- calendar
- email
- note
- insight
- action
- document
- research
- source
- generic

Components:

- MeetingCard
- CalendarTimeline
- EmailCard
- NoteCard
- InsightCard
- ActionItemCard
- DocumentCard
- SourceCard
- ResearchCluster

Do not use one generic card for every result.

The UI must adapt to the semantic result.

---

# 31. VOICE UX

ElevenLabs is responsible for voice.

The reasoning system and voice system must be decoupled.

Required architecture:

Reasoning
≠
Voice

Voice components should expose reusable functions/handlers for:

- input
- transcript
- speaking
- interruption
- errors

The JARVIS visual core should map to real voice state.

---

# 32. RESPONSE DESIGN

Spoken responses must be short.

Bad:

"I found several things in your email and calendar that might be relevant to your upcoming meeting."

Good:

"Your next meeting is with Yusuf at 10:30. Two things matter: employee-level scoring and the unresolved catering workflow."

UI contains the detail.

Do not make ElevenLabs read long reports aloud.

---

# 33. WRITE CONFIRMATION

Every WRITE tool requires explicit confirmation.

Example:

CREATE GOOGLE DOC

Title:
JARVIS Architecture Notes

Preview:
...

Buttons:

Cancel
Create

Only after explicit approval should the tool execute.

The agent cannot bypass confirmation.

---

# 34. SECURITY

Security is a first-class architecture requirement.

Never:

- expose API keys in browser code
- expose raw filesystem access to the frontend
- allow unrestricted shell execution
- use shell=true unnecessarily
- trust model-generated paths
- allow model-generated arbitrary GWS commands
- allow model to modify its own permission policies
- perform dangerous actions without confirmation
- render arbitrary model-generated HTML
- claim success without verification

Use:

- Zod validation
- path containment checks
- command allowlists where relevant
- permission enforcement
- tool schemas
- audit events
- explicit approval
- server-side secrets

Treat model output as untrusted input.

---

# 35. PROJECT STRUCTURE

Use a clear modular structure similar to:

app/
  page.tsx
  settings/
  api/

components/
  jarvis/
  cards/
  activity/
  voice/
  confirmations/
  settings/

lib/
  agent/
    runtime.ts
    provider.ts
    command-code.ts
    schemas.ts

  tools/
    registry.ts

  obsidian/
    searchVault.ts
    readNote.ts
    createNote.ts

  google/
    searchGmail.ts
    readGmail.ts
    calendarEvents.ts
    searchDrive.ts
    readDriveFile.ts
    createGoogleDoc.ts
    draftEmail.ts

  skills/
    loader.ts
    registry.ts

  memory/
    store.ts
    search.ts

  permissions/
    permissions.ts

  verification/
    verifier.ts

  voice/
    elevenlabs.ts

  events/
    types.ts
    stream.ts

skills/
  meeting-prep/
    SKILL.md
  morning-briefing/
    SKILL.md
  capture-note/
    SKILL.md
  research/
    SKILL.md
  loose-ends/
    SKILL.md

docs/
  ARCHITECTURE.md
  ROADMAP.md
  SECURITY.md
  BEGINNER-GUIDE.md

tests/

AGENTS.md

.env.example

README.md

Do not create every directory on day one.

Create what the current milestone needs.

---

# 36. DEBUG MODE

Create a developer-only debug view.

Display:

- agent request
- selected model/provider
- selected skill
- tool selections
- tool inputs
- tool outputs
- event stream
- structured result
- validation failures
- timings
- provider errors
- stderr when CLI integration is used for development tooling

Keep it hidden from the normal JARVIS interface.

This will be essential for learning and debugging.

---

# 37. SETTINGS

Create settings for:

- provider
- model
- Command Code API/runtime configuration
- optional CLI provider executable path
- Obsidian vault path
- GWS CLI path
- ElevenLabs configuration
- voice
- microphone
- animation intensity
- debug mode

System status examples:

OBSIDIAN — CONNECTED
GOOGLE — CONNECTED
VOICE — CONNECTED
AGENT — CONNECTED

Only display CONNECTED when the application actually verified the dependency.

---

# 38. COST / PERFORMANCE

Do not call the model for deterministic tasks.

Examples:

- get local time
- validate a path
- format structured data

should use deterministic code.

Use smaller/faster models for routine reasoning when appropriate.

Reserve stronger models for complex reasoning.

Keep model selection configurable.

Clean up:

- timers
- event listeners
- audio streams
- browser contexts
- child processes

Avoid resource leaks.

Keep animations performant.

---

# 39. NO FAKE INTELLIGENCE

Never fake:

- tool calls
- source retrieval
- verification
- integration health
- agent activity
- completed actions

If functionality is mocked, clearly label it as mocked internally and do not present it as real functionality.

---

# 40. PRIMARY DEMO FLOWS

The final application should naturally support:

## Demo 1 — Meeting Prep

"Jarvis, prepare me for my next meeting."

Expected:

calendar
→ identify meeting
→ Gmail
→ Obsidian
→ Drive if useful
→ synthesis
→ structured briefing
→ concise voice summary

## Demo 2 — Second Brain

"What did I write down about DeepSeek Harness?"

Expected:

search vault
→ read relevant notes
→ synthesize
→ show source references

## Demo 3 — Gmail

"Did Yusuf send me anything recently?"

Expected:

search Gmail
→ read relevant message if necessary
→ synthesize
→ email card

## Demo 4 — Calendar

"What am I doing after lunch tomorrow?"

Expected:

interpret relative date
→ calendar
→ display timeline
→ concise voice summary

## Demo 5 — Morning Briefing

"Give me my morning briefing."

Expected:

calendar
→ Gmail
→ Obsidian
→ possibly Drive
→ prioritize
→ display
→ speak summary

## Demo 6 — Note Capture

"Jarvis, take a note. My next video should show the final result before I explain how it works."

Expected:

prepare note
→ confirmation if required
→ create Markdown note in Inbox/JARVIS

## Demo 7 — Cross-Source Reasoning

"What am I forgetting?"

Expected:

recent notes
→ calendar
→ recent relevant email
→ identify possible commitments
→ present them as possible loose ends

---

# 41. DEVELOPMENT ORDER

Do not implement everything at once.

The source prompt's original release order is:

1. Visual shell
2. Agent CLI/provider
3. Obsidian
4. Google Workspace
5. Skills
6. Voice
7. Write actions
8. Polish

For implementation discipline, the detailed milestones below may split those source phases into smaller internal milestones. Do not skip the source-level dependencies.

## PHASE 1 — VISUAL SHELL

Build:

- layout
- JARVIS core
- state-driven animations
- mock activity stream
- mock result cards
- responsive desktop-first UI
- settings shell
- debug shell

No real integrations.

The UI should already feel like a convincing finished JARVIS interface.

## PHASE 2 — AGENT PROVIDER

Implement:

- AgentProvider abstraction
- CommandCodeProvider
- structured output
- streaming where supported
- timeout handling
- failures
- cancellation where supported

Start with a simple test prompt.

## PHASE 3 — TOOL REGISTRY

Implement:

- tool interface
- registry
- schemas
- permission metadata
- execution events
- tool lifecycle

Start with safe deterministic tools.

## PHASE 4 — OBSIDIAN

Implement:

- search_vault
- read_note
- create_note

## PHASE 5 — SKILLS

Implement:

- meeting-prep
- morning-briefing
- capture-note
- research
- loose-ends

## PHASE 6 — GOOGLE

Implement:

- search_gmail
- read_gmail
- get_calendar_events
- search_drive
- read_drive_file

Use safe GWS wrappers.

## PHASE 7 — MEMORY

Implement simple structured local memory.

## PHASE 8 — VOICE

Integrate ElevenLabs.

Add:
- STT
- TTS
- live transcript
- speaking state
- listening state
- interruption

## PHASE 9 — WRITE ACTIONS

Implement:

- create_note
- create_google_doc
- draft_email

with confirmation.

## PHASE 10 — VERIFICATION

Create a formal verification stage and task state lifecycle.

## PHASE 11 — OBSERVABILITY

Improve:
- debug UI
- logs
- timings
- execution history
- failure explanations

## PHASE 12 — RELIABILITY AND POLISH

Focus on:

- latency
- reliability
- context quality
- recovery
- error handling
- natural conversation
- animation performance
- demo reliability

---

# 42. BEGINNER DEVELOPMENT MODE

The developer is a beginner.

Act as both engineer and mentor.

Before major implementation work:

1. inspect the repository
2. explain what exists
3. explain what will change
4. propose the smallest useful implementation

After each milestone explain:

WHAT WE BUILT
HOW IT WORKS
WHY IT EXISTS
FILES TO UNDERSTAND
WHAT TO LEARN
HOW TO TEST IT
COMMON BEGINNER PROBLEMS

Keep explanations practical.

Do not turn every response into a long lecture.

Prefer readable code over clever code.

---

# 43. TESTING REQUIREMENTS

For each meaningful feature:

- run tests
- run lint
- run type checking
- run production build when appropriate
- manually verify relevant UI/behavior

At minimum test:

- input validation
- permissions
- path traversal protection
- tool execution
- provider failures
- structured output validation
- important skill logic
- confirmation behavior

Do not claim completion until the relevant checks pass.

---

# 44. AGENTS.MD MAINTENANCE

Maintain the repository's AGENTS.md with:

- product purpose
- architecture rules
- current milestone
- coding conventions
- security rules
- testing commands
- major architectural decisions
- known limitations

Keep it concise enough to remain useful.

Do not put the entire master specification into AGENTS.md.

The master specification remains the full product vision.

---

# 45. IMPLEMENTATION DISCIPLINE

For every new phase:

1. Read the master specification.
2. Read AGENTS.md.
3. Inspect the current repository.
4. Determine what is already implemented.
5. Identify exactly what belongs to the current phase.
6. Make a concise implementation plan.
7. Implement only that phase.
8. Test.
9. Verify.
10. Update documentation where needed.
11. Update AGENTS.md when architecture changes.
12. Stop at the phase boundary.

Never:

- rebuild working features unnecessarily
- rewrite the whole application for a small problem
- add future systems prematurely
- modify unrelated files
- create hidden dependencies
- fabricate integrations

---

# 46. INITIAL COMMAND CODE TASK

When this master specification is first introduced into an empty or partially built repository:

DO NOT immediately build the entire application.

First inspect the environment and repository.

Check for:

- Node.js
- npm
- Git
- Command Code CLI
- PowerShell
- WSL if available
- GWS CLI
- existing Next.js application
- existing package.json
- existing configuration
- existing Obsidian-related configuration

Then:

1. Create or update README.md.
2. Create/update AGENTS.md.
3. Create docs/ARCHITECTURE.md.
4. Create docs/ROADMAP.md.
5. Create docs/SECURITY.md.
6. Create docs/BEGINNER-GUIDE.md.
7. Establish the clean project structure.
8. Define the AgentProvider abstraction.
9. Define the tool interface and registry contracts.
10. Define the skill contract.
11. Define the structured result schema.
12. Define the event model.
13. Implement PHASE 1 only: the complete visual shell with mock data.
14. Run lint.
15. Run type checking.
16. Run tests.
17. Run production build.
18. Run the app locally.
19. Inspect the UI in the browser.
20. Fix any issues found.
21. Stop after Phase 1.

Do not implement real Google, Obsidian, ElevenLabs, browser automation, or write actions during the initial task.

The initial milestone is:

A convincing, polished, locally running JARVIS interface with a clean architecture ready for the real agent.

---

# 47. FINAL PRODUCT PRINCIPLE

JARVIS should feel like an operating intelligence layer over the user's digital life.

The important chain is:

VOICE / TEXT
→ REASONING
→ TOOLS
→ SKILLS
→ MEMORY
→ VERIFICATION
→ HUMAN CONTROL
→ RESULT

The user should not need to know how the system achieved the result.

The system should remain transparent about what it actually did.

The product should be powerful without becoming reckless.

The UI should be cinematic without becoming gimmicky.

The architecture should be capable without becoming unnecessarily complex.

The project should grow from a compelling local personal assistant into a robust agent platform only after the core experience works reliably.

---

# START

Read this specification.

Inspect the repository.

Do not ask me to paste this specification again.

Create the project documentation and AGENTS.md.

Then implement PHASE 1 only.

Do not continue automatically into later phases.
