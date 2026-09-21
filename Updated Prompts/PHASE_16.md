# PHASE 16 — VISION

Use `MASTER_RULES.md`.

## Objective

Add controlled screen/webcam vision as explicit capabilities.

Rules:

- capture only on explicit activation
- clear UI indicator
- image stays local unless an authorized inference path is used
- no microphone activation by vision code
- no stale-frame answers
- media type matches encoded bytes
- privacy-sensitive metadata is not persisted by default

Vision must enter the same Hermes session/run model.

STOP after real device verification.
