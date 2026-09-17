# Task: build the operations UI for a governed refunds workflow (React + Vite)

You are the **UI session** for a governed internal-tools prototype. Your branch name: `devin/ui-refunds-shell`.

## Your owned paths
`web/**` only (the `web/vite.config.ts` proxy of `/api` → `http://localhost:4000` is already set; you may adjust the proxy block but not the test config).

## Context
The backend is being built in parallel by another session against the FROZEN contract in `packages/contracts/src/index.ts`. Build against that contract only: import the zod schemas/types from `@tools/contracts` and parse every API response with them. There is no backend running for you; write a small fixture server or MSW-free `fetch` stub for local development (e.g. a `VITE_USE_FIXTURES=1` mode that serves deterministic in-memory data derived from `SEED_PAYMENTS` and `DEMO_USERS`). **The integrated app must call the live API with NO silent fallback to fixtures**: fixtures only when the env flag is explicitly set, and show a visible "FIXTURE DATA" badge when it is.

## API surface (from `ROUTES` in the contract; all same-origin under `/api`, cookie-based session)
- `POST /api/demo/session {user: "agent"|"reviewer"|"dual"|"auditor"}` → sets HttpOnly cookie; then `GET /api/me` → `Actor {id, displayName, permissions[]}`.
- `GET /api/refunds/payments` → `{payments: PaymentDto[]}` (already masked email, `refundRequestId` nullable).
- `POST /api/actions/refunds.request {paymentId}` → `ActionAccepted {requestId, request}`.
- `GET /api/approvals` → `{requests: ApprovalRequestDto[]}`; `GET /api/approvals/:id` → `ApprovalRequestDto`.
- `POST /api/actions/approvals.decide {requestId, decision: "approve"|"reject"}` → `ActionAccepted`.
- `GET /api/audit?requestId=…` → `{events: AuditEventDto[]}` (requires `audit.read`).
- Errors: `ApiError {code, message, requestId}` with codes `UNAUTHENTICATED 401, FORBIDDEN 403, SELF_APPROVAL 403, NOT_FOUND 404, ALREADY_DECIDED 409, DUPLICATE_REQUEST 409, STALE_VERSION 409, VALIDATION 422`. Send `credentials: "same-origin"` and `content-type: application/json`.

## Screens (optimize for a 5-minute demo to a VP of Engineering; clean, dense, no decorative charts)
1. **Identity bar** (always visible): a "DEMO AUTH — synthetic identities" banner, a selector for the four seeded users (labels from `DEMO_USERS`), current actor name + permission chips. Switching identity calls the demo session endpoint then `/api/me`.
2. **Payments / Request refund**: table of seeded payments (amount formatted from minor units, masked email, captured date, existing request link). "Request full refund" button only if actor has `refunds.request`; disabled with reason if a request already exists. Show server errors verbatim by code (e.g. 409 DUPLICATE_REQUEST).
3. **Approvals queue**: all requests with kind, summary, requester, decision badge, execution badge. Filters: pending / decided. Row → detail.
4. **Request detail**: immutable payload (amount, currency, masked customer ref, payment id), requester, decision + who/when, execution state with attempts/providerRef/lastError. Approve/Reject buttons only with the kind's review permission (`refunds.review` for kind `refund`). Render **403 SELF_APPROVAL** as a clear inline message ("You requested this; a different reviewer must decide."), **409 ALREADY_DECIDED** as a readable conflict state that refreshes the record. Poll the detail every 1s while execution is `QUEUED|LEASED|RETRY_WAIT`; show `NEEDS_REVIEW` as an explicit warning, never as success. Show `SUCCEEDED` with providerRef.
5. **Audit timeline** (on the detail page, only when actor has `audit.read`; otherwise show "audit.read required"): ordered events with actor, action, outcome, summary, timestamp.
Provide loading, empty, error, and success states everywhere. Minimal hand-written CSS (one stylesheet, system font, readable contrast); no UI library (none is installed and you may not add one).

## Tests (vitest + @testing-library/react, jsdom — already configured in vite.config.ts)
Component tests for: identity switch renders permission chips; request button hidden without permission; SELF_APPROVAL error rendered; ALREADY_DECIDED conflict rendered; execution badge maps every `ExecutionState`. Mock `fetch` in tests; do not spin up a server.

## Acceptance
`pnpm --filter @tools/web build` succeeds; `pnpm lint && pnpm typecheck && pnpm test` pass from the repo root; the app runs with `pnpm --filter @tools/web dev` in fixture mode and renders all screens. Include a short `web/README.md` (how to run in fixture mode vs. against the API, and the fixture badge rule).
## Ground rules (apply to your whole session)

- Repository: https://github.com/sidong0906/devin. Base branch: `devin/1789619700-governed-refunds-prototype` at commit `b440fdb5f7a41df7f6c10fd3fcc0f204a58027c4`. Check out that exact commit, create your own branch from it (name given below), and push to that branch only. Do NOT open a PR, do NOT merge, do NOT push to main or to the base branch.
- Read `README.md`, `docs/IMPLEMENTATION_PLAN.md` (sections 2, 3, 7), `packages/contracts/src/index.ts` (the FROZEN contract) and `tests/contracts/src/acceptance.test.ts` (the black-box gates you are building toward) before writing code.
- Toolchain: Node 24 (`nvm use`), pnpm 10.34.5 via `corepack enable && corepack prepare pnpm@10.34.5 --activate`, `pnpm install --frozen-lockfile`. Docker is available for PostgreSQL (`pnpm db:up`).
- You may ONLY edit files inside your owned paths (listed below). Do NOT edit `packages/contracts/`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, root `package.json`, `tests/contracts/`, `.github/`, `db/init/`, or anything owned by the other session. Do NOT add or upgrade dependencies: everything you need is already declared in your package.json files (fastify, @fastify/cookie, kysely, pg, zod, tsx, vitest, react, vite, testing-library). If you genuinely cannot proceed without a contract change or a new dependency, STOP, and report exactly what you need and why in your final message — do not work around it.
- Do not weaken or edit tests you don't own, do not bypass git hooks, do not use real customer data (only the seeded synthetic fixtures in the contract).
- Before finishing: `pnpm lint`, `pnpm typecheck`, and `pnpm test` must pass from the repo root. Run your own tests too.
- Hard deadline: stop coding 40 minutes after you start, even if incomplete. Push whatever you have.
- Final message must contain, in this order: (1) branch name and head SHA, (2) list of files changed, (3) exact commands you ran and their pass/fail result, (4) what is NOT done or known to be broken, (5) any contract/dependency change you needed but did not make, (6) your elapsed minutes and, if visible, ACU usage. Be honest; partial work reported accurately is worth more than a claim.
- Do not do browser/UI testing with a recording; that is a separate step owned by someone else.
