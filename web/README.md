# @tools/web — refunds operations UI

React + Vite shell for the governed refunds workflow. Screens: identity bar (demo auth selector +
permission chips), payments / request refund, approvals queue, request detail (decision, execution,
audit timeline). Every API response is parsed with the zod schemas from `@tools/contracts`; a
response that does not match the frozen contract is surfaced as an error, never rendered.

## Run against the live API (default)

```bash
pnpm dev                          # from repo root: API :4000, worker, simulator, web :5173
# or only the web app (API must already be on :4000, or set API_URL):
pnpm --filter @tools/web dev
```

All requests are same-origin under `/api` (Vite proxies to `API_URL`, default `http://localhost:4000`)
with `credentials: "same-origin"`, so the HttpOnly session cookie set by `POST /api/demo/session` is
used as-is. **There is no fallback to fixtures**: if the API is down you see the network/HTTP error.

## Run in fixture mode (no backend)

```bash
VITE_USE_FIXTURES=1 pnpm --filter @tools/web dev
```

`web/src/api/fixtures.ts` is an in-memory stand-in for the API derived from `SEED_PAYMENTS` and
`DEMO_USERS` in the contract. It enforces the same rules and error codes (401/403/SELF_APPROVAL/
409 DUPLICATE_REQUEST/ALREADY_DECIDED/422) and simulates worker execution: approved refunds go
`QUEUED → LEASED → SUCCEEDED`, except `pay_1003` which goes `RETRY_WAIT → NEEDS_REVIEW` so the
uncertain-outcome state can be demoed. One pending request (Ana Agent, `pay_1002`) is pre-seeded.

**Fixture badge rule:** fixtures are used only when `VITE_USE_FIXTURES` is exactly `"1"` at build/dev
time, and whenever they are used an orange **FIXTURE DATA** badge is shown next to the demo-auth
banner. No badge means the app is talking to the real API.

## Checks

```bash
pnpm --filter @tools/web typecheck
pnpm --filter @tools/web test      # vitest + testing-library, fetch mocked, no server
pnpm --filter @tools/web build
```

Tests live in `src/__tests__` and cover: identity switch → permission chips; request button hidden
without `refunds.request`; 409 DUPLICATE_REQUEST shown verbatim; 403 SELF_APPROVAL inline message;
409 ALREADY_DECIDED conflict + refresh; NEEDS_REVIEW rendered as a warning; `ExecutionBadge` maps
every `ExecutionState`.
