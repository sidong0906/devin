# Economics: build on Devin vs. stay on Power Apps vs. Retool

Every number is one of: **measured** (docs/BUILD_LEDGER.md row), **list price** (linked), or **assumption** (labeled, to be confirmed by the client). Do not quote a number from this page without its label.

## 1. Measured inputs (this prototype)

| Bucket | Wall min | Human active min (spec + review) | Agent usage | Source |
|---|---|---|---|---|
| Spec: plan, contracts, acceptance gates, prompts (S_f) | ~20 | ~20 | none (written by the coordinator) | ledger rows 1, 2, 5 |
| Platform + refunds backend (A_f + A_h) | 9 | 0 during; ~4 integrate + review | see session page | ledger row 3, 6 |
| Refunds UI | 8 | 0 during; ~1 review | see session page | ledger row 4 |
| Second app (flags) from the playbook (A_p) | see ledger row 8 | see ledger row 8 | see ledger row 8 | ledger row 8 |
| KYC estimate (E_4) | 0 (written from the codebase, no session) | ~6 | none | docs/KYC_SCOPE.md |

ACU figures are not exposed to the child sessions; read them from each session page linked in the ledger and fill the "agent usage" column before quoting a dollar figure. Until then the ACU term is unknown, and the conclusion below does not depend on it (see sensitivity).

Caveat that must travel with these numbers: the coordinator wrote the spec and the acceptance gates *before* the sessions, against a frozen contract. That is the spec bucket. "Built in under an hour" is false without it.

## 2. Price inputs

| Item | Value | Label |
|---|---|---|
| Devin ACU | $2.25 per ACU | list price, Devin pricing page |
| Devin Teams seat | $40 per seat per month | list price |
| Devin Enterprise (if secure mode / VPC required) | $50K per year | assumption, unverified |
| Engineer hour, fully loaded | $150 | assumption |
| Maintenance share of cumulative build cost per year | 0.15 standalone, 0.20 with integrations, 0.25 regulated | assumption, industry rule of thumb |
| Power Apps Premium | $20 per user per month today; $26.40 from Jan 1, 2027 | list price, Microsoft licensing page |
| Retool | $15 per user + $50 per builder per month; Enterprise uplift ~$60K | list price + assumption |
| Current spend | $250K per year for 3 apps, 10 more planned | assignment |

**The first question for the VP is the seat count.** $250K at $20 per user per month is about 1,040 Premium seats. A 60-engineer company with three internal ops apps rarely has 1,000 daily users of them. If the real user count is ~300, the right-sized Power Apps bill is $72K today and $95K after January 2027, and *that* is the number a build has to beat, not $250K.

## 3. Formulas

```
measured bucket cost      C  = ACUs x 2.25 + (review_min + spec_min) / 60 x 150
production foundation        = C_f + 200 h x 150 + 40 ACU x 2.25        (OIDC, Postgres hardening, pipeline, denied-access logging, vault)
production playbook app      = 4 x C_p + 40 h x 150                     (4x prototype-to-prod multiplier; 40 h integrations/UAT/deploy)
production hand-spec'd app   = 4 x C_h + 40 h x 150                     (first app of each new shape; assume 4 of 13)
annual review overhead       = 2 h/week x 50 x 150 = $15K
maintenance (year N+1 on)    = m x cumulative build cost
Power Apps licenses          = users x 26.40 x 12
Retool                       = users x 15 x 12 + builders x 50 x 12 + uplift
license overlap              = months/12 x current spend   (assume 6 months)
```

## 4. Three-year scenarios (placeholders; refill from the ledger)

Assumptions: 300 users; 13 apps total (3 rebuilt + 10 new); 4 hand-specified shapes, 9 playbook apps; m = 0.20; hosting $6K per year; 80 compliance-evidence hours per year; measured buckets roughly C_f ~$500, C_h ~$150, C_p ~$100 (to be replaced).

| Scenario | 3-year cost | Dominant term |
|---|---:|---|
| Status quo: stay at $250K, build 10 apps in Power Apps (80 maker-hours each) | ~$870K | license at the current seat count |
| Right-sized Power Apps (300 users), build 10 apps in Power Apps | ~$400K | maker hours + $95K/yr license |
| Build on Devin (Teams): platform hardening + 13 apps + maintenance + 6 mo overlap | ~$430K to $480K | engineer hours (integrations, review, hardening); ACUs are under 5% |
| Build on Devin (Enterprise) | +$150K | Enterprise fee |
| Retool for the 10 new, keep 3 on Power Apps | ~$600K+ | double licensing |

Reading: at 300 users, right-sized Power Apps and a Devin build are within the error bars of each other. At 1,000 real users, Power Apps licensing is ~$950K over three years and building wins by a wide margin. The spread between scenarios is smaller than the uncertainty in three assumptions: real seat count, integration hours per app, and whether Enterprise pricing applies.

## 5. Sensitivity

- Users 300 to 1,000: Power Apps scenario triples; build ranking flips from "tie" to "clear win". This is why the SKU/seat list is step one.
- Integration hours per app 40 to 80: build scenario moves by ~$60K to $80K. Doubling ACUs moves it by low thousands. **Hours are signal; ACUs are noise.**
- Maintenance 0.15 to 0.25: moves the build scenario by ~$40K over three years.
- Review overhead x3: does not change the ranking.
- Keeping KYC on Power Apps: license reduction is 0 until entitlements are renegotiated; the build case then rests only on delivery speed and Postgres-facing apps where Power Apps is weakest.

## 6. The sentence for the VP

Power Apps bills per person who opens an app; Devin bills per unit of building effort. The Cognition invoice is small either way; engineer hours and the right-sized license are the decisive numbers, and the pilot exists to measure the first and force the second.
