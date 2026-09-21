# PHASE 10 — WEB RESEARCH + PROVENANCE

Use `MASTER_RULES.md`.

## Objective

Create a reliable research capability without moving web reasoning into JARVIS itself.

Hermes chooses when research is needed. JARVIS governs capability access. Results must retain provenance.

## Requirements

- source URL/title metadata
- retrieval timestamp
- content trust boundary
- deduplication
- safe result normalization
- citations/provenance in final UI where appropriate
- no prompt injection from web content into system policy

Do not build a second agent loop.

## Acceptance

A real research query produces a trace showing search/retrieval → evidence → Hermes synthesis, with source provenance preserved.

STOP.
