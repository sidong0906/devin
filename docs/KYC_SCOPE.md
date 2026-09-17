# KYC review queue — scope and estimate (not built)

We deliberately did not build the KYC app in this prototype. This is the output of a scoping pass over the
existing platform, written the way an Ask-mode session would answer "what would it take to add KYC on this
foundation?" It is a discovery checklist plus a conditional estimate, **not** a validated migration plan:
we have not seen the client's actual KYC workflow, vendor integrations, SLAs, or retention requirements.

## What KYC review would reuse unchanged

| Platform control | Reused? | Notes |
|---|---|---|
| Identity resolution + prod guard | yes | swap demo auth for SSO first (see README "What is deliberately not here") |
| Deny-by-default action registry | yes | new actions: `kyc.claim`, `kyc.decide`, `kyc.escalate`, `kyc.request_info` |
| Maker-checker `decideRequest` | partly | KYC decisions are usually **single-reviewer with four-eyes only on escalations/high-risk**; the current policy is "always a second person". Needs a per-kind policy hook: `requiresSecondReviewer(request) => boolean`. Shared-code change. |
| Append-only audit | yes | but summaries must be reviewed for PII: KYC objects *are* PII (names, DOB, document numbers). Allowlisted summary builder needs a KYC-specific allowlist. |
| Execution jobs + worker | yes | for vendor callbacks (re-screening, document verification) with idempotency keys |
| Immutable request payload | needs change | KYC cases are **long-lived and mutable** (documents added, info requested, risk score recomputed). The refunds model "one immutable payload, one decision" does not fit; needs a `case` aggregate with versioned facts and decisions attached to a case version. This is the biggest architectural delta. |
| Approvals queue UI | partly | needs claim/assignment, SLA timers, filters by risk tier — a queue-work UI, not an approvals list |

## What is new

1. **Case model**: `kyc_cases` (customer ref, risk tier, status, assignee, SLA due), `kyc_case_events` (append-only facts: document received, screening hit, info requested), decisions bound to a case version.
2. **Vendor integration boundary**: identity-verification / sanctions-screening provider(s) behind the same worker + idempotency pattern as the payment simulator. Unknown until the client names vendors; webhook verification, replay protection, and retry semantics per vendor.
3. **PII handling**: field-level encryption or tokenization for document numbers; masked DTOs by role (analyst sees full, auditor sees masked); retention/purge jobs; access logging of *reads*, not only writes (our audit currently logs mutations only).
4. **Queue semantics**: claim with lease (we already have `FOR UPDATE SKIP LOCKED` in the worker; reuse for human claim), reassignment, SLA breach flags, escalation path.
5. **Reporting/export**: regulators and internal compliance want exports; not a UI concern in the prototype but mandatory here.

## Conditional estimate

Assumptions: one vendor, existing SSO, synthetic data in pilot, no data migration from Power Apps/Dataverse
in the first cut, the shared platform changes above accepted.

| Work | Devin sessions (bounded, gate-driven) | Human engineering time (spec, review, security) |
|---|---|---|
| Platform changes (policy hook, mutable case aggregate, read-audit) | 2–3 | 1–2 days |
| KYC domain + migrations + queue API | 2–3 | 1–2 days |
| Vendor adapter + webhook + worker jobs | 2–4 (depends on vendor docs/sandbox) | 2–3 days incl. security review |
| Queue UI (claim, case view, decisions, SLA) | 2–3 | 1 day |
| PII controls (encryption, masked DTOs, retention job) | 2 | 2–3 days (security-owned) |
| Acceptance gates written first (like G1–G8/F1–F3) | — | 1 day |
| **Total** | **~10–15 sessions** | **~8–12 engineer-days** before hardening |

Excluded and unknown: Dataverse data migration, dual-running with the existing Power App, regulatory sign-off,
model-based risk scoring, multi-jurisdiction rules. Any of these can dominate the total.

## Judgment

KYC is the *worst* first candidate for migration off Power Apps: highest PII sensitivity, most regulatory
scrutiny, and the one app whose data model differs most from the approvals pattern we proved. It should be
last, and only after the refunds pilot has produced real ownership-cost numbers. If the client keeps KYC on
Power Apps, assume **no license reduction** from this program until an entitlement analysis says otherwise.
