# Key Decisions (one page)

**Question.** A Series C fintech (~60 engineers) pays ~$250K/yr for Power Apps running a KYC queue, a refunds dashboard, and a feature-flag panel, and plans ten more apps. Should it build the next ten with Devin instead?

**Recommendation.** Do not cancel Power Apps now. Right-size the licenses first. Run an eight-week pilot in which Devin builds Postgres-facing consoles on a small, human-specified platform layer, and decide the license question at the pilot gate, before the January 2027 price increase.

## Decision 1: Build one real outcome, not a Power Apps clone

We built refunds end to end: agent requests, an independent reviewer approves, a worker executes against a payment simulator with a stable idempotency key, and every step lands in an append-only audit log. We then stamped a second app (feature flags) from a playbook to measure reuse, and scoped KYC without building it. We did not build a form designer, connectors, or a workflow engine. Power Apps' value is its operating model (managed runtime, attested data store, DLP, non-engineer makers); a two-hour build cannot replicate that and should not claim to. Evidence: `docs/PROTOTYPE_GUIDE.md`, `docs/CAPABILITY_MATRIX.md`.

## Decision 2: Put the controls where an agent cannot remove them

The invariants that matter in fintech (no self-approval, immutable request, one side effect per approval, audit committed with state) are enforced by PostgreSQL grants and one transaction boundary, then tested by 24 black-box gates that run against live services. Devin builds inside `apps/<name>`; shared controls are specified and reviewed by a human, written by Devin in the backend session, and protected by CODEOWNERS. Prompt-level boundaries proved weak: the second app legitimately edited three protected wiring files. Branch protection, not prompts, is the control. Evidence: G1-G8, F1-F3, ledger row 8.

## Decision 3: Stop at the platform boundary and price the rest

Not built, on purpose: OIDC, real PSP, reconciliation, DLP, retention, pipelines, KYC. Each is priced as a labeled assumption in `docs/ASSESSMENT.md` §3. KYC is last, not first: it has the most PII and the least in common with the refunds model (`docs/KYC_SCOPE.md`).

## What the build measured

26 Devin minutes across 3 sessions, ~45 human active minutes on spec, gates, and review, 0 interventions, 0 failed gates on independent re-run, 2 real review findings, 1 governance finding. ACUs are read from the session pages, not from inside sessions. "Built in 26 minutes" is false without the spec bucket beside it.

## Economics in one line

Power Apps bills per person who opens an app; Devin bills per unit of building effort. At 300 real users a right-sized Power Apps bill (~$95K/yr from 2027) and a Devin build are within error bars; at the ~1,000 seats that $250K implies, building wins by a wide margin. Engineer hours are signal, ACUs are noise. Step one is the SKU list. (`docs/ECONOMICS.md`, all inputs labeled.)

## Pilot (8 weeks, stop conditions, not promises)

Weeks 1-2 harden the platform (OIDC, Postgres roles in prod, denied-access logging, staging, vault). Weeks 3-6 build the two most Postgres-facing consoles from the next-ten list via the playbook, feature flags first (smallest blast radius). Weeks 7-8 daily shadow use by an ops reviewer, internal audit samples PRs and the audit export, economics refilled from pilot numbers. Team: two engineers at half time, one ops reviewer, one compliance contact, the VP as sponsor. Pass only if all hold: engineer hours per app under the kickoff threshold; 80 percent of playbook PRs merged within two review rounds; zero high-severity findings from Devin Review plus one human security review and a clean secrets scan; audit signs off on the PR sample; two weeks with no P1; refilled three-year model beats right-sized Power Apps by the VP's margin. Any miss: right-size and stay, keep Devin for maintenance PRs and tests.
