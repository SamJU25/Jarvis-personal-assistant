# JARVIS — Source Alignment

This bundle is intentionally based on the complete JARVIS prompt supplied by the developer.

## Preserved from the source

The master prompt preserves the source prompt's core requirements:

- JARVIS is a local tool-using AI assistant, not a chatbot.
- Natural-language voice interaction.
- Intelligent tool and skill selection.
- Cross-source reasoning.
- Obsidian second-brain access.
- Google Workspace through GWS CLI wrappers.
- Meeting prep, morning briefing, research, capture-note, loose-ends skills.
- Structured Zod-validated results.
- Event streaming.
- Human confirmation for writes.
- Memory.
- ElevenLabs voice.
- Cinematic JARVIS core.
- Left context area, central core, right intelligence area, bottom command controls.
- Dynamic semantic card renderers.
- Debug mode.
- Verification.
- Security boundaries.
- Source/demo flows.
- Incremental development.

## Deliberate adaptations for this developer

1. Operating system:
   - Source: Mac
   - This project: Windows

2. Initial reasoning provider:
   - Source: Codex CLI or Claude Code CLI
   - This project: Command Code Provider API initially

The provider abstraction still supports future Codex CLI and Claude Code CLI adapters.

3. Development workflow:
   - Command Code is the primary coding/build agent for this project.
   - The JARVIS runtime remains a separate application.

4. Development phases:
   - The source prompt has 8 large implementation phases.
   - This bundle may split those into smaller milestones to make the project safer for a beginner.
   - The final feature set and source-level order remain intact.

## Why this is intentional

The goal is to build the same kind of JARVIS experience while adapting the implementation to the developer's actual Windows + Command Code environment.

This file is documentation for the developer. Command Code should treat `JARVIS_MASTER_PROMPT.md` and `AGENTS.md` as the active project instructions.
