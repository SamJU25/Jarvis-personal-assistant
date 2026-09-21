# User Taste and Working Preferences

These guidelines capture established user taste, coding conventions, and workflow rules. Apply them across all planning, implementation, verification, and communication.

## 1. Phased Execution and Scope Discipline
- **One Phase at a Time**: Implement exactly one phase or milestone at a time. Fully verify it, then stop cleanly at the phase boundary. Never automatically cascade into subsequent phases without explicit approval.
- **Inspect Before Editing**: Read source-of-truth project documents (`JARVIS_MASTER_PROMPT.md`, `SOURCE_ALIGNMENT.md`, `AGENTS.md`) before implementation. Thoroughly inspect repository and local environment before proposing or making changes.
- **Preserve Existing Code**: Value, understand, and preserve existing code and patterns. Never assume a repository is disposable or empty.
- **Plan First**: Always create a concise implementation plan before implementation begins.
- **Persistence**: Work through interruptions or usage limits rather than stopping prematurely when the user prompts to continue.

## 2. Architecture and Code Quality
- **Clean TypeScript/React Architecture**: Maintain simple, readable architecture with typed reusable components, clean naming, and small focused modules.
- **Minimalist Dependencies**: Avoid unnecessary third-party packages, premature abstractions, and heavyweight infrastructure unless explicitly required by the project spec.
- **Honest Mock Boundaries**: Sample data, fixtures, and placeholders must be visibly identified and strictly isolated. Never imply real integrations, tool executions, backend state, or successful external operations when using mocks.

## 3. Verification and Completion
- **Evidence Before Claims**: Completion claims must be backed by fresh, actual test results, linting, type-checking, production build runs, local browser inspection, state validation, and responsive layout checks.
- **Avoid Redundant Re-verification**: If previous runs in the same context already established correctness and the user indicates that testing is done or asks to skip, advance directly to documentation and finalization.
- **Process Cleanup**: Always stop and clean up any spawned background processes, test dev servers, or dangling services when work completes.

## 4. UI / UX Design Standards
- **Premium and Restrained Aesthetics**: Design interfaces with restrained color palettes, generous negative space, subtle micro-motion, and clear visual hierarchy.
- **Avoid AI Clichés**: Do not use neon-heavy gradients, generic SaaS dashboard card templates, or chat-bubble-centric layouts. Make deliberate, project-specific aesthetic choices.

## 5. Communication and Explanations
- **Beginner-Friendly & Practical**: Provide explanations covering what changed, how the architecture works, how to run it, what is mocked vs real, key architectural takeaways, and the clear next phase.
