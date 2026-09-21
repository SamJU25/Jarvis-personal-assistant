# PHASE 05 — HERMES + FREELLMAPI + FUNCTIONAL SETTINGS CONFIGURATION

Use `MASTER_RULES.md` and `UI_GUIDE.md`.

## Objective

Make the production inference path:

`JARVIS → Hermes → FreeLLMAPI → automatic upstream routing`

and make Hermes + FreeLLMAPI genuinely configurable from the JARVIS Settings UI.

The user should not normally open the Hermes dashboard or FreeLLMAPI dashboard to run JARVIS.

## Inspect first

Inspect the actual installed versions and supported controls:

### Hermes
- current `config.yaml` format
- custom OpenAI-compatible provider support
- supported model/base_url/api_key fields
- runtime reload/restart behavior
- model/capability APIs
- current gateway/run API

### FreeLLMAPI
- `/v1` API behavior
- `model=auto` and `auto:*` behavior
- routing strategy
- tool calling
- streaming
- health/readiness
- admin/auth model
- unified key behavior
- supported declarative startup config
- supported config reload/restart behavior

Use the installed versions as source of truth.

## Production inference rule

The desired path is:

`Browser → JARVIS → Hermes → FreeLLMAPI → upstream model/provider`

Do not let the browser call FreeLLMAPI directly.
Do not add direct Gemini/OpenAI/Groq/etc. calls to JARVIS's production agent path.
Do not create another model router.

## Hermes configuration

Configure the Hermes custom OpenAI-compatible endpoint using the actual supported config mechanism.

Target shape:

```yaml
model:
  provider: custom
  base_url: <FreeLLMAPI /v1>
  default: auto
```

Use the exact installed Hermes syntax; do not blindly copy this example if the version differs.

Secrets must be server-side.

## FreeLLMAPI configuration

FreeLLMAPI supports declarative startup configuration via `FREEAPI_CONFIG_PATH` or `FREEAPI_CONFIG_JSON` in current releases.

Prefer the supported server-side mechanism for provider credentials and routing configuration.

If the installed version exposes an authenticated management API, use it.
If not, use the supported declarative config path and explicitly apply/reload/restart as required.

Never fake hot reload.

## Settings UI — mandatory

Implement the first functional version of:

### Hermes Core card

Show real:
- connection status
- version if available
- session readiness
- run readiness
- capability count
- skill count
- delegation status

Actions:
- Test Connection
- Refresh Capabilities
- Refresh Models

### Inference Gateway card

Show real:
- FreeLLMAPI status
- base URL (safe)
- routing strategy
- streaming support
- tool-calling support
- last health check
- last routed provider/model when verified
- last latency when available

Actions:
- Test Gateway
- Test Streaming
- Test Tool Calling
- Refresh Models

### Provider credentials

Show only:
- provider name
- configured/not configured
- health status
- last health check

Allow entry of a new provider key through a secure server-side flow.
Never return stored keys.
Never put them in browser storage.
Never log them.

If the gateway only supports key management through its own authenticated admin surface, expose the smallest safe server-side integration and an explicit “Open gateway administration” link rather than pretending JARVIS can manage unsupported operations.

## Settings data architecture

Implement:

`GET /api/settings/snapshot`
`GET /api/settings/events` (SSE)

plus existing-repo-compatible write/test endpoints.

Use validated schemas:
- `SystemStatusSnapshot`
- `SettingsEvent`
- Hermes settings input/result
- Inference settings input/result

## Live updates

The Settings page must NOT poll Hermes/FreeLLMAPI directly.

Use one JARVIS server-side health/config observer that emits normalized settings events.

Browser flow:

`snapshot → SSE → reducer/store`

On reconnect:
- fetch snapshot
- reconnect stream
- reconcile by revision/event IDs
- avoid duplicates

## Apply flow

Every setting change must show:

`Idle → Applying → Applied/Failed → Verified`

On success:
1. re-read actual configuration
2. re-probe the service
3. update snapshot
4. emit settings event

If the service requires restart, show that honestly and expose a safe Restart/Reload action where the installed environment supports it.

## Automatic routing

JARVIS may request a high-level routing profile if supported.
JARVIS must not pick a concrete upstream provider/model for normal operation.

The default user experience is:

`Routing: Automatic`

## Failure behavior

If FreeLLMAPI is down:
- Settings shows `Unavailable`
- agent request shows a truthful gateway failure
- no direct-provider bypass

If one upstream provider fails, allow FreeLLMAPI to perform its own fallback.

## Acceptance

1. Hermes is connected through FreeLLMAPI.
2. `model=auto` or installed equivalent works.
3. streaming works.
4. tool calls work.
5. multi-step Hermes runs still work.
6. Settings shows real live state.
7. Test Connection performs a real check.
8. changing a supported setting changes actual runtime/configuration state.
9. saved state is re-read and verified.
10. provider keys never appear in browser responses/logs.
11. no direct upstream provider fallback exists in JARVIS.

## Live verification

Use the real Hermes and FreeLLMAPI instances.

Prove:

`JARVIS → Hermes → FreeLLMAPI → upstream`

Then verify the JARVIS Settings UI sees the actual state change and returns to the correct live status.

Run tests, lint, typecheck, build, and live verification.

STOP.
