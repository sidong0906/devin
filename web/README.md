# @tools/web — internal-tools shell

React + Vite shell that hosts every internal tool behind one identity bar and one approvals queue.
Every API response is parsed with the zod schemas from `@tools/contracts`; a response that does not
match the frozen contract is surfaced as an error, never rendered.

## Layout

```text
src/
  platform/     shell screens shared by all tools (IdentityBar, ApprovalsQueue, RequestDetail, AuditTimeline)
                plus the domain components that bind contract states to the design system
                (Badges.tsx: ExecutionBadge/DecisionBadge/OutcomeBadge/PermissionChip; ErrorBox.tsx)
  apps/
    index.ts    web-side app manifest (WEB_APPS); mirrors packages/app-manifest on the server
    types.ts    WebApp: tab, main View, PayloadFields for the request detail, reviewPermission
    refunds/    PaymentsView + RefundPayloadFields
    flags/      FlagsView + FlagChangePayloadFields
  api/          typed client (client.ts) and the in-memory fixture API (fixtures.ts)
  routes.ts     hash router; app tabs come from WEB_APPS, approvals routes are fixed
  styles.css    imports @tools/ui/styles.css, then only shell-specific rules (identity bar, timeline)
```

Visual building blocks (theme, tokens, Button, Badge, Alert, Card, Table, Tabs, ...) come from
[`packages/ui`](../packages/ui/README.md), which is built on Radix Themes. `main.tsx` mounts `UiProvider`
once; screens compose the primitives and should contain almost no `className`. Do not import
`@radix-ui/themes` here: a screen that needs a new visual asks the design system for it (or uses the
small escape hatch `@tools/ui` re-exports: `Box`, `Flex`, `Text`, ...).

A new tool adds a folder under `src/apps/<name>/` exporting a `WebApp` and one line in `src/apps/index.ts`.
Nothing under `platform/` needs to change: the queue renders any `RequestKind`, and the detail page
uses the app's `PayloadFields` (or a generic JSON fallback).

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
