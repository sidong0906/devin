# Governed internal tools, built with Devin

A prototype for one question from a fintech VP of Engineering who pays ~$250K/yr for Power Apps and plans ten more internal apps: **can Devin build the governed internal tools (refunds, feature flags, later KYC) on a company-owned foundation, and what does the next app cost?**

It is not a Power Apps clone. It is one real workflow (refunds) built end to end on a small platform layer, a second app (feature flags) stamped from a playbook to measure reuse, and a KYC queue scoped but not built. The Devin clock was 26 minutes across three sessions; specification, gates, integration, and review took about 45 human-active minutes more, itemized in `docs/BUILD_LEDGER.md`.

**Recommendation in one line:** keep Power Apps, right-size the licenses, pilot this pattern on the next two Postgres-facing consoles for eight weeks, decide at the gate. Full reasoning: `docs/KEY_DECISIONS.md`.

## What Devin wrote and what a human specified

- The plan, the frozen contracts (`packages/contracts`), the 24 black-box acceptance gates (`tests/contracts`), CI, and CODEOWNERS were specified by a human and written by the coordinating session.
- The platform layer (`packages/server-core`: identity, deny-by-default dispatcher, maker-checker, append-only audit, transactions, masking) was specified and reviewed by a human and written by Devin in the backend session (`docs/prompts/01`).
- Refunds was written by Devin from a hand-specified prompt (`docs/prompts/01`, `02`).
- Feature flags was written by Devin from the playbook (`docs/prompts/03`), with zero edits to `packages/`.
- KYC was scoped, not built (`docs/KYC_SCOPE.md`).

## Apps

| App | Path | Session | Spec | Permissions | PII | Maker-checker action | Gates |
|---|---|---|---|---|---|---|---|
| Refunds | `apps/refunds/server`, `web/` | [backend](https://app.devin.ai/sessions/52f726f5f0cb4095b67f6857c4d71c06), [UI](https://app.devin.ai/sessions/58c51219b16f4019a3f54ae490e03abe) | prompts 01, 02 | `refunds.request`, `refunds.review` | customer email, masked | approve → execution job → simulator | G1-G8 (16) |
| Feature flags | `apps/flags/server`, `web/src/components/FlagsView.tsx` | [flags](https://app.devin.ai/sessions/1aa75ba3cb0947edb86cba96cb240258) | prompt 03 (playbook) | `flags.propose`, `flags.review` | none by design | approve → publish with version check | F1-F3 (8) |
| KYC queue | not built | none | `docs/KYC_SCOPE.md` | | | | |

## Foundation

- Identity: synthetic demo auth behind an HttpOnly cookie; the API refuses to boot with demo auth when `NODE_ENV=production` (G1).
- Permissions: every mutation is a registered action with one required permission; unregistered actions are denied (G2, F1).
- Maker-checker: `decideRequest` checks requester identity before any role check; a dual-role user cannot approve their own request even by direct API call (G3, F2).
- Immutability: request payload is server-derived and the app DB role cannot UPDATE it (G4, G8).
- Audit: `audit_events` is INSERT-only for the app role and commits in the same transaction as the state change. Append-only against application code, not tamper-proof against a DBA (G7, G8).
- Execution: worker retries with the same idempotency key; a dropped simulator response yields one effect (G6). Two concurrent approvals yield one decision and one job (G5).
- Masking: raw customer email never reaches DTOs, audit summaries, or the DB summary column (G8).

## Architecture

See `docs/ARCHITECTURE.md` for the diagram, the trust / transaction / side-effect boundaries, and who wrote each layer.

## Run locally

```bash
nvm use                                   # Node 24
corepack enable && corepack prepare pnpm@10.34.5 --activate
pnpm install
cp .env.example .env
pnpm db:up                                # PostgreSQL 16 in Docker; creates tools_migrator and tools_app
pnpm db:migrate && pnpm db:seed
pnpm dev                                  # API :4000, worker, payment simulator :4100, web :5173
```

If Docker Hub rate-limits the image (HTTP 429, hit twice during this build): `docker pull mirror.gcr.io/library/postgres:16-alpine && docker tag mirror.gcr.io/library/postgres:16-alpine postgres:16-alpine`.

## Run the tests

```bash
pnpm check              # lint + typecheck + 33 unit tests, no services needed
pnpm test:acceptance    # 24 black-box gates against the running API, worker, simulator, DB
```

Last independent run on the merged tree: `Test Files 2 passed, Tests 24 passed` (acceptance) and 14 + 12 + 2 + 5 unit tests, `pnpm build` clean.

## A five-minute tour

Open http://localhost:5173 and use the identity picker.

1. **Ana Agent** → Payments → request a refund. Amount and currency come from the server.
2. **Dana Dual** (can request and review) → Approvals → open her own request → approve is refused with `SELF_APPROVAL`.
3. **Raj Reviewer** → approve the same request → status `APPROVED`, execution `QUEUED` then `SUCCEEDED` after the worker runs.
4. **Avery Auditor** → open the request → audit timeline shows request, approval, execution; no raw email anywhere.
5. **Dana Dual** → Flags → propose a change to `ui.new_dashboard` at version 0. **Raj Reviewer** approves → flag published at version 1. Propose again at version 0 → `STALE_VERSION`.
6. Terminal: `NODE_ENV=production pnpm --filter @tools/api start` → refuses to boot with demo auth.

## Auth is a stub

Four synthetic users, no passwords, no IdP. Production swaps the identity resolver for OIDC; nothing else changes. The boot guard exists so the stub cannot ship by accident.

## Deliberately not built

Real SSO, real PSP and reconciliation, partial refunds, multi-currency, denied-decision audit rows, DLP, retention/SIEM, deployment pipeline, KYC. Each is priced as a labeled assumption in `docs/ASSESSMENT.md` §3 and listed as planned in `docs/ARCHITECTURE.md`.

## Governance

Devin builds inside `apps/<name>` and `web/`. `packages/`, `services/`, `db/`, `tests/contracts/`, `.github/` and the lockfile require a human code-owner review (`.github/CODEOWNERS`). This is convention until branch protection is enabled in GitHub settings. The flags session legitimately edited three protected wiring files (`docs/BUILD_LEDGER.md`); with protection on, that is one human approval per new app.

## Devin evidence

| Session | Mode | Prompt | Head | Minutes | ACUs |
|---|---|---|---|---|---|
| [52f726f5](https://app.devin.ai/sessions/52f726f5f0cb4095b67f6857c4d71c06) backend | agent | `docs/prompts/01` | `81ffa98` | 9 | see session page |
| [58c51219](https://app.devin.ai/sessions/58c51219b16f4019a3f54ae490e03abe) UI | agent | `docs/prompts/02` | `e8d0908` | 8 | see session page |
| [1aa75ba3](https://app.devin.ai/sessions/1aa75ba3cb0947edb86cba96cb240258) flags | agent (playbook) | `docs/prompts/03` | `646c53c` | 6 | see session page |

## Documents

- `docs/KEY_DECISIONS.md` (one page)
- `docs/ARCHITECTURE.md`
- `docs/CAPABILITY_MATRIX.md`
- `docs/ASSESSMENT.md`
- `docs/ECONOMICS.md`
- `docs/KYC_SCOPE.md`
- `docs/BUILD_LEDGER.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/prompts/`
