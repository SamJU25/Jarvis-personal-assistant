# Phase 09 — Google Workspace Consolidation: Parity Report

> Status: **COMPLETE — No migration required.** Documented per `Updated Prompts/PHASE_09.md`
> acceptance criterion: *"no duplicate long-term Google implementation is left without a
> documented reason."*

## 1. Inventory: JARVIS Google features

Single implementation lives in `src/lib/google/` (server-only):

| File | Responsibility |
|------|----------------|
| `client.ts` | `executeGws()` — safe CLI execution (`spawn`, `shell: false`), bounded buffers, timeouts, cancellation, sanitized error mapping |
| `config.ts` | `JARVIS_GWS_EXECUTABLE` resolution, `gws auth status` probing |
| `types.ts` | Zod input/output schemas with strict bounding limits |
| `normalizers.ts` | Gmail / Calendar / Drive output normalization |
| `tools.ts` | 7 `JarvisTool` definitions + `registerGoogleTools()` |

Registered tools (via `createDefaultToolRegistry()` in `src/lib/tools/demo-tools.ts`):

| Tool | Permission | Risk | Confirmation | Verification | Idempotent |
|------|-----------|------|--------------|--------------|------------|
| `search_gmail` | read | low | none | read_verification | yes |
| `read_gmail` | read | low | none | read_verification | yes |
| `get_calendar_events` | read | low | none | read_verification | yes |
| `search_drive` | read | low | none | read_verification | yes |
| `read_drive_file` | read | low | none | read_verification | yes |
| `create_google_doc` | write | medium | explicit | doc verification | no |
| `draft_email` | write | medium | explicit | email_verification | no (draft-only, never sends) |

Tests: `tests/google/{client,config,normalizers,security,tools}.test.ts` — all passing.

## 2. Inventory: Hermes-native Google capability (installed version)

Inspected the installed Hermes checkout at `F:\hermes-agent` (v0.21.3-era api_server):

- **Enabled toolsets** (`.hermes/config.yaml` → `platform_toolsets.api_server`):
  `web`, `clarify`, `session_search`, `delegation`. **No Google toolset.**
- **Disabled toolsets** (`agent.disabled_toolsets`): `terminal`, `code_execution`, `file`,
  `computer_use`.
- Hermes source contains a **managed connectors** subsystem (`tools/connectors/`) in which
  `gmail` appears only as an example connector slug served through a remote "tool gateway"
  bridge. In this installation:
  - the connector toolset is not enabled in `config.yaml`;
  - no `google_calendar`, `google_drive`, or `docs` connector capability exists in the
    local checkout;
  - connector schemas are served remotely, so operations would not be locally owned or
    bounded by JARVIS policy.
- No Google-related code exists under `F:\hermes-agent\agent\`.

## 3. Parity matrix

| Capability | JARVIS (GWS CLI) | Hermes (installed) | Conclusion |
|------------|------------------|--------------------|------------|
| Gmail search | Safe, bounded, Zod-validated | Connector present in code, not enabled, remote-gateway dependent | **Keep JARVIS** |
| Gmail read | Working + normalized | Not available locally | **Keep JARVIS** |
| Calendar events | Working | Not present | **Keep JARVIS** |
| Drive search/read | Working | Not present | **Keep JARVIS** |
| Create Google Doc | Confirmed write + on-disk verification | Not present | **Keep JARVIS** |
| Draft email | Confirmed write, draft-only (never sends) | Not present | **Keep JARVIS** |
| Approval behavior | JARVIS ConfirmationService (single-use, 60s TTL, voice intent) | Native approvals exist but Google operations unavailable | **Keep JARVIS** |

## 4. Decision

**Nothing migrates. Nothing is removed.**

Per the Phase 09 rule — *"Migrate only capabilities where Hermes is sufficient and safer"* —
zero capabilities qualify: the installed Hermes exposes no enabled Google toolset, and its
connector path (a) is disabled, (b) depends on a remote gateway, and (c) would remove JARVIS
policy ownership (confirmation, verification, bounding) from Google side effects.

Google remains an **external capability boundary owned by JARVIS**: Hermes decides *whether*
to call a Google capability (semantic routing inside the run loop); JARVIS decides *how* it
executes (capability registry, confirmation, verification). This matches MASTER_RULES
core-ownership: Hermes owns reasoning; JARVIS owns controlled application capability
execution.

## 5. Regression guard

`tests/google/parity.test.ts` asserts all 7 tools remain registered with the documented
permission/confirmation/verification/idempotency profile, so accidental removal or a
parallel duplicate implementation fails CI.

## 6. Live verification status

- **Automated checks**: all green (see completion report below).
- **Live GWS calls**: `NOT VERIFIED` — the `gws` CLI is not on PATH and
  `JARVIS_GWS_EXECUTABLE` is not set in this environment, so no live Gmail/Calendar/Drive
  call could be executed. This is the expected state for a fresh checkout; the `config.ts`
  probe correctly reports `Not configured` (covered by `tests/google/config.test.ts`).
  When the GWS CLI is installed and authenticated, rerun the live verification per
  `MASTER_RULES.md` before relying on real Google data.

## 7. Completion report

1. **Summary**: Inventoried JARVIS and installed-Hermes Google capability; built the parity
   matrix; proved Hermes exposes no enabled/safer Google path, so nothing migrates and
   nothing is removed; added a regression guard test and this documented decision.
2. **Files changed/created/removed**: Created `docs/PHASE9-GOOGLE-PARITY.md`,
   `tests/google/parity.test.ts`. No production code changed.
3. **Architecture impact**: None — JARVIS remains the single Google capability boundary
   (registry → confirmation → verification), Hermes remains the reasoning core.
4. **Automated checks**: `vitest tests/google` 6 files / 40 tests passed;
   `tsc --noEmit` clean; `eslint .` 0 errors (2 pre-existing warnings in untouched files);
   `next build` succeeded with all routes.
5. **Live checks**: Hermes server not running and GWS CLI not installed — reported
   `NOT VERIFIED` above rather than claimed.
6. **Unresolved issues**: None introduced. Pre-existing lint warnings in
   `src/lib/agent/runtime.ts` and `src/lib/specialist/policy.ts` remain (out of scope).
7. **Exact next phase**: `PHASE_10.md` — Web Research + Provenance.


