# Governed internal-tools platform

One company-owned platform layer for the internal apps a fintech usually buys from Power Apps: request, independent approval, execution, audit. Built with Devin to answer one question: **can Devin build these on a foundation we own, and what does the next app cost?**

Detailed walkthrough: `docs/PROTOTYPE_GUIDE.md`. Decision and pilot: `docs/KEY_DECISIONS.md`.

## What exists today

| Layer | What it does | Status |
|---|---|---|
| Platform (`packages/`) | Identity with production boot guard, deny-by-default permissions, maker-checker approvals (requester can never approve their own request), audit log appended in the same transaction as every state change, durable execution with idempotent retries, PII masking | Built. 24 black-box gates green in CI. Specified and reviewed by a human, written by Devin. |
| Refunds (`apps/refunds`) | Agent requests a full refund, a different reviewer approves, worker executes against a payment simulator, auditor sees the masked trail | Built end to end. 16 gates. |
| Feature flags (`apps/flags`) | Propose a flag change, independent approval publishes it with version conflict detection | Built from the playbook in one 6-minute Devin session, zero edits to the platform. 8 gates. |
| KYC review queue | Case queue with assignment and vendor checks | Scoped, not built. Estimate in `docs/KYC_SCOPE.md`. |
| Shared UI (`web/`, `packages/ui`) | Identity picker, approvals queue, request detail, audit timeline; every app plugs into the same screens and builds from one design system: Radix Themes and Recharts underneath, a project-owned layer of five status tones, a sidebar shell, KPI tiles and charts on top (`packages/ui/README.md`); an Overview dashboard summarises all tools from the audited approvals list | Built. |

Build cost measured: 26 Devin minutes across three sessions plus about 45 human minutes of specification, gates, integration, and review (`docs/BUILD_LEDGER.md`). Auth is a synthetic stub and the payment provider is a simulator; both are swap points, not shortcuts hidden in the code.

## What is deliberately not here

Real SSO, real payment provider, deployment pipeline, DLP, retention and SIEM, denied-decision audit rows, KYC. Each is priced as a labeled assumption in `docs/ASSESSMENT.md`. The audit log is append-only against application code, not against a database administrator.

## How it evolves

1. **Next app of the same shape** (approval workflow): one playbook run (`docs/prompts/03-new-app-playbook.md`), one human code-owner review. Measured once at 6 Devin minutes; treat as n=1 until the pilot repeats it.
2. **Harden for production** (weeks 1 to 2 of the pilot): OIDC identity, INSERT-only audit role, denied-access logging, staging deployment, secrets in a vault. Assumed 200 engineer hours; see `docs/ECONOMICS.md`.
3. **New shapes** (case queues like KYC): add a case aggregate to the platform first, then stamp apps on it. This is platform work by the two engineers who own `packages/`, not a playbook run.
4. **Register, don't wire**: a new app is a folder under `apps/<name>` plus one line in `packages/app-manifest` (server) and `web/src/apps/index.ts` (web). The API, worker, and seed compose from the manifest and are not edited per app.

Rule that does not change: the authorization, audit, and approval layer is specified and reviewed by humans. Devin writes it and stamps apps on top of it; it never owns it.

## Frontend

The team is used to Power Apps, so the UI has that shape: a left rail of tools, a header with who you are, KPI tiles and charts, then the table that is the record. It was built in three passes, each a merged PR:

| Pass | Decision | Why |
|---|---|---|
| Design system (`packages/ui`) | One package owns every visual building block; screens compose it and carry almost no CSS | A new tool should look right by default and be reviewable as behaviour, not styling |
| Rebuilt on Radix Themes | Wrap a maintained, accessible library instead of hand-rolled components; ~300 lines of custom CSS became ~15 lines of overrides | Accessibility, keyboard handling and colour scales come for free; the project keeps only what is its own |
| Dashboard layer | Sidebar shell, app identity colours, KPI tiles, Recharts charts, an Overview across tools and a summary strip per tool | Colourful, glanceable internal tooling the team already recognises |

**What the project owns (and Radix does not):**

- **Five status tones**, the only status vocabulary in the UI: `ok` green, `warn` amber, `danger` red, `pending` indigo, `neutral` gray. Rule: an unresolved outcome never looks like success. A refund waiting on the provider is `pending`; one that exhausted retries is `warn`; only a provider-confirmed success is `ok`.
- **App identity colours** separate from status (Refunds teal, Feature flags violet) so a tool's colour never reads as a state.
- **The `@tools/ui` boundary**: `web/` never imports Radix Themes, Radix Icons or Recharts directly. Swapping the library is a change to one package.
- **Dashboards derive from the audited data**. Every tile and chart is a pure function over the same DTOs the tables show (`web/src/platform/metrics.ts`, unit-tested); there is no second, unaudited analytics source, and the tables stay authoritative.

**Screens built:** Overview (awaiting approval, approved, rejected, executed, needs review; requests per day, decision outcomes, requests by tool, execution pipeline, throughput, recent requests), Refunds (captured volume, refunds requested, largest payment, coverage donut, payments table with request action), Feature flags (flags on, pending changes, publishes per flag, flags table with propose action), Approvals queue (maker-checker enforced in the UI and the API), Request detail with payload and audit timeline, identity picker with the permission chips of the acting user. Every chart carries an `aria-label` with its numbers; tests assert tone mapping, roles and the dashboard aggregations.

**Adding a tool's UI:** a folder `web/src/apps/<name>/` with `meta.tsx` (label, icon, colour, description), a view, an optional summary strip and payload fields for the request detail, plus one line in `web/src/apps/index.ts`. The sidebar, Overview charts, approvals queue and detail page pick it up without edits. Building blocks and rules: `packages/ui/README.md`; layout of `web/`: `web/README.md`.

## Run it

```bash
nvm use && corepack enable && corepack prepare pnpm@10.34.5 --activate
pnpm install && cp .env.example .env
set -a && source .env && set +a          # scripts read the shell env, not .env
pnpm db:up && pnpm db:migrate && pnpm db:seed
pnpm dev                                  # web :5173, API :4000, worker, simulator :4100
pnpm check && pnpm test:acceptance        # lint, types, 46 unit tests, 24 gates
```

Five-minute tour by role, evidence per session, and governance notes: `docs/PROTOTYPE_GUIDE.md`.

## Documents

`docs/KEY_DECISIONS.md` (one page) · `docs/ARCHITECTURE.md` · `docs/CAPABILITY_MATRIX.md` · `docs/ASSESSMENT.md` · `docs/ECONOMICS.md` · `docs/KYC_SCOPE.md` · `docs/BUILD_LEDGER.md` · `docs/prompts/`
