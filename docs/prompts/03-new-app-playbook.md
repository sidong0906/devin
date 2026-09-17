# Playbook: add a new governed app on the shared platform

This is the reusable prompt for "the next app". Fill the `<<PARAMS>>` block, hand it to one Devin session, and measure: wall minutes, human minutes, interventions, shared-code changes needed, failed checks. Run #1 of this playbook is feature flags (see docs/BUILD_LEDGER.md).

## <<PARAMS>>
- APP: `flags` — feature-flag change control (propose → independent approve → publish a versioned boolean).
- Branch: `devin/app-flags`.
- Base: branch `devin/1789619700-governed-refunds-prototype`, commit `e8a8ca97b0d8e2cc6eae1ba29734ab453179e589`.
- Frozen contract already contains everything you need: `FlagChangePayload`, `FlagProposeBody`, `FlagDto`, `FlagsResponse`, `SEED_FLAGS`, `RequestKind "flag_change"`, permissions `flags.propose` / `flags.review`, action `flags.propose`, error `STALE_VERSION`, routes `GET /api/flags` and `POST /api/actions/flags.propose`.
- Acceptance gate (already written, must pass): `tests/contracts/src/flags.acceptance.test.ts`. Read it first; it is the spec.

## Owned paths for this session
`apps/flags/**` (new), `db/migrations/0002_*.sql` (new), `web/src/**` (add a Flags screen; keep existing screens working), plus **exactly these wiring edits** outside app folders:
- `services/api/src/app.ts`: import and call `registerFlags()` / `registerFlagRoutes(app, db)` next to the refunds registration.
- `services/api/src/seed.ts`: upsert `SEED_FLAGS` (version 0) idempotently.
- `services/api/src/app.ts` demo reset: also reset `feature_flags` to seed values (version 0, no pending).
- `services/api/package.json`: add the workspace dep `"@tools/flags-server": "workspace:*"`.
Do NOT touch `packages/**`, `tests/**`, `.github/**`, `db/init/**`, root manifests, or the lockfile except as the workspace dep above requires (`pnpm install` will update `pnpm-lock.yaml`; that is expected and allowed). If the shared platform (`packages/server-core`) is missing something you need, STOP and report it — do not patch it. That finding is a first-class result of this experiment.

## Reference implementation to copy the shape of
`apps/refunds/server/src/index.ts` (action + review policy + routes), `db/migrations/0001_init.sql` (grants pattern), `web/src/components/PaymentsView.tsx` and `RequestDetail.tsx` (screen shape and error rendering).

## Build
1. `apps/flags/server` package `@tools/flags-server` (same tsconfig/package layout as `@tools/refunds-server`).
2. Migration `0002_flags.sql`: `feature_flags(key text pk, value boolean not null, version int not null default 0, updated_at timestamptz not null default now(), updated_by_id text null)`. Grants for `tools_app`: SELECT, and UPDATE only on columns `(value, version, updated_at, updated_by_id)`. No INSERT/DELETE for the app role (seed runs as migrator).
3. Action `flags.propose` (permission `flags.propose`, body `FlagProposeBody`): load flag `FOR UPDATE` → `NOT_FOUND`; `expectedVersion !== version` → `STALE_VERSION`; insert `approval_requests` with `kind="flag_change"`, payload = `FlagChangePayload`, `subject_key = "flag:<key>:v<expectedVersion>"` (unique violation → `DUPLICATE_REQUEST`); audit `flags.propose` ok with summary `kind=flag_change flag=<key> from=<old> to=<new> v=<expectedVersion>`.
4. Review policy for kind `flag_change` with permission `flags.review`. `onApproved(tx, request)`: re-read the flag `FOR UPDATE`; if `version !== payload.expectedVersion` throw `STALE_VERSION` (the shared decide transaction then rolls back and the request stays PENDING); else `UPDATE feature_flags SET value, version = version + 1, updated_by_id = <decider>, updated_at = now()` and audit `flags.published` ok (actor = decider, summary `kind=flag_change flag=<key> value=<new> v=<newVersion>`). Publishing is synchronous inside the approval transaction — there is no execution job; execution state stays `NONE`.
5. `GET /api/flags`: any authenticated actor. Returns `FlagsResponse`; `pendingRequestId` = id of the PENDING `flag_change` request for that key, else null.
6. Web: a **Flags** screen: table (key, value, version, updated by/at, pending link), propose toggle for actors with `flags.propose` (sends current `version` as `expectedVersion`), renders `409 STALE_VERSION` as "flag changed since you loaded it — refresh", `409 DUPLICATE_REQUEST` linking to the pending request. Request detail must render the `flag_change` payload (key, from/to, expected version). Add fixture data for fixture mode. One component test for the stale error.
7. Unit test in `apps/flags/server`: `onApproved` throws `STALE_VERSION` on version mismatch (mock tx is fine).

## Done means
Live stack up (`pnpm db:up`, `pnpm db:migrate`, `pnpm db:seed`, simulator + api + worker) → `pnpm test:acceptance` runs **both** `acceptance.test.ts` (16 tests, must still pass) and `flags.acceptance.test.ts` green. `pnpm lint && pnpm typecheck && pnpm test && pnpm build` pass at root.

If Docker Hub pull is rate-limited, `docker pull mirror.gcr.io/library/postgres:16-alpine && docker tag mirror.gcr.io/library/postgres:16-alpine postgres:16-alpine` then `pnpm db:up`.

## Ground rules
- Push to your branch only; no PR, no merge, never push to main or the base branch.
- Node 24 (`nvm use`), pnpm 10.34.5 via corepack, `pnpm install`.
- Hard stop at 30 minutes; push what you have.
- Final message, in order: (1) branch + head SHA, (2) files changed, (3) commands run with pass/fail incl. acceptance counts, (4) not done / broken, (5) anything you needed from the shared platform or contract but did not change, (6) elapsed minutes and ACU usage if visible. Report honestly.
