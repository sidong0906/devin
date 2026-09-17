# Honest assessment: Devin vs. Power Apps for this client

Sources: `docs/BUILD_LEDGER.md` (ledger), `docs/CAPABILITY_MATRIX.md` (matrix), `tests/contracts/*.test.ts` (gates), `docs/ECONOMICS.md` (economics). Microsoft claims are from the public Power Apps and Power Platform admin documentation; Devin claims from docs.devin.ai. Every row names its evidence.

## 1. Why companies buy Power Apps

Not for the form builder. They buy a managed application runtime, a licensed and attested data store (Dataverse), ~1,500 connectors, tenant-wide DLP and environment policy, deployment pipelines, and the ability for a non-engineer to ship a working tool without an engineering ticket. The customer still configures every control and owns every business rule. The $250K buys the operating model; it does not buy correct refund logic.

## 2. Replicable and shown here

| Capability | Evidence | Caveat |
|---|---|---|
| Permission on every mutation, deny by default | G2, F1; `actions.ts` | one dispatcher; unregistered actions are denied |
| Maker-checker, no self-approval, identity checked before role | G3, F2 | denied decisions are not audit-logged (matrix) |
| Immutable request payload, server-derived amount | G4; PG grant test in G8 | refunds only |
| Append-only audit against application code, committed with state | G7, G8 | not tamper-proof against a DBA |
| Exactly-one side effect under retry, against a simulator | G6 | proves the contract, not a real PSP |
| PII masking in DTOs and audit | G8 | refunds only; flags has no PII by design |
| Second app from a playbook with zero platform edits | ledger row 8, F1-F3 | n = 1; flags is the simplest possible second app |
| Self-verification, bounded sessions, zero interventions | ledger totals | prompts and gates were written by the coordinator first |
| Scoping a fourth app without building it | `docs/KYC_SCOPE.md` | an estimate, not a measurement |

## 3. Replicable, deliberately not shown (assumption hours)

| Item | Why not now | Estimate (assumption) |
|---|---|---|
| OIDC against the company IdP | puts IdP secrets in an agent session; belongs to a human in the pilot | 2 to 4 engineer days |
| Postgres hardening: INSERT-only audit role in production, log shipping | prototype already has the grants; shipping/retention is ops work | 1 to 2 days |
| Denied-decision audit rows | small; found by review, left as a documented gap | 1 to 2 hours |
| Environment pipeline (dev/staging/prod) | out of the 2-hour box | 1 to 2 weeks |
| Real PSP adapter + reconciliation | needs sandbox credentials and a reconciliation design | 1 to 2 weeks |
| App plugin manifest (no `services/api` edits per app) | found by the flags run | 0.5 day |

## 4. Not replicable, or Devin should not try

- Microsoft's SOC/PCI/ISO attestations for the platform. The client would carry its own evidence for a custom stack.
- Tenant-wide DLP and connector policy. The structural substitute here is "no PII in audit rows and masking by default," which is narrower.
- ~1,500 connectors. Every integration in this model is code that someone reviews and maintains.
- The maker experience for non-engineers. Every app in this model needs an engineer to write a spec and review a PR.
- The authorization, audit, and approval layer should never be delegated to an agent without a human-written spec and human review. That is the rule this repository follows, and it should stay a rule.

## 5. Where the risk lies

| Risk | What this repo does | Residual |
|---|---|---|
| Insecure generated code | black-box gates, PG grants, CODEOWNERS on shared controls | no SAST or secrets scanner was run; say so |
| Ownership boundary drift | `git diff --name-only` at each merge | the flags run touched 3 protected wiring files; prompt-level boundaries are weak, branch protection is the real control |
| Verification tax | 45 human active minutes for 26 Devin minutes | the reviewer here was another Devin session; the pilot must measure a human's review time |
| Ambiguous specs burn sessions | frozen contracts + gates before any implementation session | this is real cost; it is the spec bucket |
| Compliance evidence | audit is append-only; PR history is the change record | denied decisions not logged; no retention or SIEM |
| Day-two ownership | small modular monolith, one DB, pnpm workspace | someone owns upgrades, on-call, incident response |
| The $250K itself | economics starts with the seat count question | the client has not supplied the SKU list |

## 6. What the ledger says about this build

- 3 Devin sessions, 26 self-reported minutes total, 0 interventions, 0 failed gates on independent re-run, 24/24 acceptance and 33 unit tests green.
- Two review findings, both real: denied decisions not audited; `Database` type has no app extension point. Neither is a security hole; both are debt that a second engineer would hit on app three.
- One governance finding: the second app needed edits to `services/api` wiring. With branch protection on, that is a human approval per new app, which is the intended cost.
- No session failed. This is a clean run on a well-specified problem with pre-written gates. It is not evidence about what happens on an under-specified problem.

## 7. The four assignment questions

- **Build cost.** 26 Devin minutes plus ~45 human active minutes for platform + two apps at prototype depth. ACUs unknown from inside sessions; read from the session pages. Production is a 4x multiplier plus integration hours (economics §3, assumption).
- **Maintenance burden.** 15 to 25 percent of cumulative build cost per year (assumption), plus ~2 review hours a week. The Devin bill is small; the reviewing engineer is the cost.
- **Security implications.** Stronger where the client wants it stronger (PG-enforced audit immutability, typed maker-checker) and weaker everywhere Power Apps sells attestations, DLP, and managed identity. The client inherits the evidence burden.
- **Opportunity cost.** Two engineers at half time for eight weeks of pilot (~320 hours, ~$48K at $150/h) is product work not done. That is the number to weigh against a right-sized license, not the ACU invoice.
