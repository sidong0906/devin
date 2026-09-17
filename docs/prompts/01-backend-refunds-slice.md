# Task: build the refunds backend vertical slice (identity, policy, maker-checker, audit, worker, payment simulator)

You are the **backend session** for a governed internal-tools prototype. Your branch name: `devin/backend-refunds-slice`.

## Your owned paths
`packages/server-core/**`, `apps/refunds/server/**`, `services/api/**`, `services/worker/**`, `services/payment-simulator/**`, `db/migrations/**`.

## What to build

The acceptance suite `tests/contracts/src/acceptance.test.ts` is the specification. Make it pass against live services. Implement in TypeScript with Fastify 5, Kysely + pg, zod (all already declared). Keep it a modular monolith: `services/api` composes `packages/server-core` + `apps/refunds/server`; `services/worker` and `services/payment-simulator` are separate processes.

### 1. Database (`db/migrations/*.sql`, run by `services/api/src/migrate.ts` using `MIGRATION_DATABASE_URL`)
Tables (amounts are integer minor units):
- `payments(id text pk, amount_minor int, currency text, customer_email text, captured_at timestamptz)`
- `approval_requests(id text pk, kind text, requester_id text, payload jsonb NOT NULL, subject_key text UNIQUE NOT NULL, decision text default 'PENDING', decided_by_id text null, decided_at timestamptz null, created_at timestamptz default now())` — `subject_key` = `refund:<paymentId>` so there is exactly one refund request per payment, rejected ones included.
- `audit_events(id bigserial pk, at timestamptz default now(), actor_id text, action text, object_id text, request_id text, outcome text check in ('ok','denied','failed'), summary text)`
- `execution_jobs(id bigserial pk, request_id text UNIQUE references approval_requests, idempotency_key text UNIQUE, state text, attempts int default 0, lease_until timestamptz null, provider_ref text null, last_error text null, updated_at timestamptz)`
Grants for role `tools_app` (least privilege; the migrator role owns the schema):
- `audit_events`: SELECT, INSERT only. **No UPDATE, no DELETE.**
- `approval_requests`: SELECT, INSERT, and UPDATE only on columns `(decision, decided_by_id, decided_at)` — column-level grant, so `UPDATE ... SET payload` fails with permission denied.
- `payments`: SELECT (seed runs as migrator). `execution_jobs`: SELECT, INSERT, UPDATE.
- Sequences: usage/select.
Also `services/api/src/seed.ts` (runs as migrator): idempotently upsert `SEED_PAYMENTS` from `@tools/contracts`.

### 2. `packages/server-core`
- `db.ts`: Kysely instance from `DATABASE_URL`, `withTx(fn)` helper (SERIALIZABLE or REPEATABLE READ not required; use row locks).
- `identity.ts`: demo auth. `POST /api/demo/session {user}` (strict body, from `DemoUserKey`) sets an HttpOnly, SameSite=Strict signed cookie named `SESSION_COOKIE` (from contracts) using `@fastify/cookie` with `SESSION_SECRET`. `resolveActor(request)` returns the seeded `Actor` from `DEMO_USERS` or throws `UNAUTHENTICATED`. **Production guard**: a function `assertDemoAuthAllowed(env)` that throws at startup if `DEMO_AUTH=true` and `NODE_ENV=production`; call it in `services/api/src/main.ts` and unit-test it (`prodGuard.test.ts`). Also add a same-origin check on mutating routes: reject if `Origin` header is present and its host differs from the API host or the configured `WEB_ORIGIN`; treat missing Origin as allowed for non-browser clients.
- `errors.ts`: `AppError(code: ErrorCode, message)`; a Fastify error handler mapping to `HTTP_STATUS[code]` and the `ApiError` shape `{code,message,requestId}` (use `request.id`). Zod failures → `VALIDATION` 422. Unexpected errors → 500 with `{code:"INTERNAL"...}` is acceptable but must not leak stack traces.
- `actions.ts`: deny-by-default registry. `registerAction({name: ActionName, permission: Permission, body: zodSchema, handler})`. `POST /api/actions/:name` looks up the registry; unknown name → 404 `NOT_FOUND` (or 403); actor lacking permission → 403 `FORBIDDEN` AND an audit event with outcome `denied`; body parsed with `.strict()` schema → 422 on unknown fields. Export a test (`actions.test.ts`) asserting every registered action has a permission and that an unregistered name is denied.
- `approvals.ts`: `decideRequest(actor, requestId, decision)` inside `withTx`: `SELECT ... FOR UPDATE` the request; `NOT_FOUND` if missing; `ALREADY_DECIDED` (409) if decision != PENDING; `SELF_APPROVAL` (403) if `requester_id === actor.id`; check the kind-specific review permission via a `ReviewPolicy` registry keyed by `RequestKind` (refund → `refunds.review`) → `FORBIDDEN`; then update decision columns, insert audit event `approvals.decide` outcome `ok`, and if approved call the kind's `onApproved(tx, request)` hook (refunds inserts one `execution_jobs` row with `idempotency_key = "refund:" + request.id`). If header `x-demo-fault: throw_before_commit` is present and demo mode is on, throw after the writes but before commit (this is how G7 is tested) — the tx must roll back and the API returns 500.
- `audit.ts`: `writeAudit(tx, {...})` inserting into `audit_events`. `summary` must be built from an allowlist (kind, masked customer ref, amount, currency, decision) — never the raw email.
- `masking.ts`: use `maskEmail` from contracts. `customerRef` in the stored payload must already be the masked email (store masked; the raw email lives only in `payments`).
- `dto.ts`: map rows → `ApprovalRequestDto`, `PaymentDto`, `AuditEventDto` (validate output with the contract schemas in tests).

### 3. `apps/refunds/server`
- Register action `refunds.request` (permission `refunds.request`, body `RefundRequestBody`): look up payment → `NOT_FOUND`; build immutable payload `{kind:"refund", paymentId, amountMinor (from payment), currency:"USD", customerRef: maskEmail(email)}`; insert `approval_requests` with `subject_key = "refund:"+paymentId`; on unique violation → `DUPLICATE_REQUEST` 409; write audit `refunds.request` ok; return `ActionAccepted`.
- Register review policy for kind `refund` with `onApproved` creating the execution job.
- `GET /api/refunds/payments` (needs `refunds.request` OR `approvals.read`): masked payments with `refundRequestId`.

### 4. `services/api/src/main.ts`
Fastify on `API_PORT` (4000). Routes exactly as in `ROUTES` in contracts: demo session, `GET /api/me`, payments, `POST /api/actions/:name`, `GET /api/approvals` (permission `approvals.read`; include execution state/result joined from `execution_jobs`), `GET /api/approvals/:id`, `GET /api/audit?requestId=` (permission `audit.read`), `GET /api/health`. Demo-only `POST /api/demo/reset` (only when `DEMO_AUTH=true` and NODE_ENV != production): truncate `execution_jobs`, `approval_requests`, `audit_events` — note the app role can't DELETE audit rows, so reset must connect with `MIGRATION_DATABASE_URL` or the migrator must grant `TRUNCATE`... prefer: reset uses a second Kysely instance on `MIGRATION_DATABASE_URL`. Log with request ids; never log cookies or raw emails.

### 5. `services/worker/src/main.ts`
Poll loop (every 500ms): claim one job `WHERE state IN ('QUEUED','RETRY_WAIT') AND (lease_until IS NULL OR lease_until < now()) ... FOR UPDATE SKIP LOCKED`, set `LEASED`, `attempts+1`, `lease_until = now()+10s`. Outside the tx, `POST {PAYMENT_SIMULATOR_URL}/refunds` with header `Idempotency-Key: <idempotency_key>` and body `{paymentId, amountMinor, currency}` with a 3s timeout. On success: in one tx set `SUCCEEDED`, `provider_ref`, and insert audit `execution.succeeded` (actor `system:worker`). On timeout/network error: set `RETRY_WAIT` with `lease_until = now()+1s` and `last_error`; after 5 attempts → `NEEDS_REVIEW` + audit `execution.failed`. Never generate a new idempotency key. Map job states to `ExecutionState` in DTOs (`NONE` when no job).

### 6. `services/payment-simulator/src/main.ts`
Fastify on `PAYMENT_SIMULATOR_PORT` (4100). In-memory store is fine (single process), but must be correct: `POST /refunds` with `Idempotency-Key`: if key seen with same body fingerprint → return the stored result (200, same `providerRef`); same key with different body → 422; new key → create effect `{providerRef: "re_"+random, ...}` and return 201. Test hooks (always on; the simulator is a stub): `POST /__test/reset` clears effects and faults; `GET /__test/effects` → `{effects:[...]}`; `POST /__test/fault {mode:"drop_response_once"}` → the next `POST /refunds` records the effect but never responds (destroy the socket / hang past the worker timeout) — the retry with the same key must then return the stored effect. Add unit tests.

## Acceptance
Run the full stack locally (`pnpm db:up`, migrate, seed, start simulator + api + worker with `.env.example` values) and run `pnpm test:acceptance`. Target: all G1–G8 tests green. If some fail, report exactly which and why. Also `pnpm lint && pnpm typecheck && pnpm test` must pass at the repo root.
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
