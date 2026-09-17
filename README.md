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
| Shared UI (`web/`, `packages/ui`) | Identity picker, approvals queue, request detail, audit timeline; every app plugs into the same screens and builds from one design system (tokens, primitives, status tones) | Built. |

Build cost measured: 26 Devin minutes across three sessions plus about 45 human minutes of specification, gates, integration, and review (`docs/BUILD_LEDGER.md`). Auth is a synthetic stub and the payment provider is a simulator; both are swap points, not shortcuts hidden in the code.

## What is deliberately not here

Real SSO, real payment provider, deployment pipeline, DLP, retention and SIEM, denied-decision audit rows, KYC. Each is priced as a labeled assumption in `docs/ASSESSMENT.md`. The audit log is append-only against application code, not against a database administrator.

## How it evolves

1. **Next app of the same shape** (approval workflow): one playbook run (`docs/prompts/03-new-app-playbook.md`), one human code-owner review. Measured once at 6 Devin minutes; treat as n=1 until the pilot repeats it.
2. **Harden for production** (weeks 1 to 2 of the pilot): OIDC identity, INSERT-only audit role, denied-access logging, staging deployment, secrets in a vault. Assumed 200 engineer hours; see `docs/ECONOMICS.md`.
3. **New shapes** (case queues like KYC): add a case aggregate to the platform first, then stamp apps on it. This is platform work by the two engineers who own `packages/`, not a playbook run.
4. **Register, don't wire**: a new app is a folder under `apps/<name>` plus one line in `packages/app-manifest` (server) and `web/src/apps/index.ts` (web). The API, worker, and seed compose from the manifest and are not edited per app.

Rule that does not change: the authorization, audit, and approval layer is specified and reviewed by humans. Devin writes it and stamps apps on top of it; it never owns it.

## Run it

```bash
nvm use && corepack enable && corepack prepare pnpm@10.34.5 --activate
pnpm install && cp .env.example .env
set -a && source .env && set +a          # scripts read the shell env, not .env
pnpm db:up && pnpm db:migrate && pnpm db:seed
pnpm dev                                  # web :5173, API :4000, worker, simulator :4100
pnpm check && pnpm test:acceptance        # lint, types, 33 unit tests, 24 gates
```

Five-minute tour by role, evidence per session, and governance notes: `docs/PROTOTYPE_GUIDE.md`.

## Documents

`docs/KEY_DECISIONS.md` (one page) · `docs/ARCHITECTURE.md` · `docs/CAPABILITY_MATRIX.md` · `docs/ASSESSMENT.md` · `docs/ECONOMICS.md` · `docs/KYC_SCOPE.md` · `docs/BUILD_LEDGER.md` · `docs/prompts/`
