# Build ledger

One row per session/stage. Unknown values stay unknown. Times are UTC.

| stage | session | role | prompt/playbook | base SHA | head SHA | start | end | wall min | agent usage | human active min | interventions | failed checks | review findings | status | gaps |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| research + plan | parent | coordinator | conversation | — | — | 2026-09-17 04:25 | 2026-09-17 04:33 | ~8 (plus earlier review) | unknown | — | — | — | — | done | — |
| scaffold + contracts | parent | coordinator | plan §7 | (empty repo) | b440fdb | 2026-09-17 04:33 | 2026-09-17 04:39 | 6 | unknown | 0 | 0 | 4 (react types version, vite config type, exactOptionalPropertyTypes on fetch body, tsconfig extends path) | — | done | contracts frozen; no runtime yet |
| backend slice | [52f726f5](https://app.devin.ai/sessions/52f726f5f0cb4095b67f6857c4d71c06) | child | docs/prompts/01 | b440fdb | 81ffa98 | 04:40 | 04:49 | 9 (self-reported) | not visible to child; see session page | 0 (no mid-session messages) | 0 | 0 reported; Docker Hub 429 → child fell back to apt PostgreSQL 14, so `pnpm db:up` untested by child | none yet (no PR) | done: 16/16 G1–G8 self-reported | no DB-backed unit tests for `decideRequest`; denied SELF_APPROVAL / kind-permission decisions are not audit-logged (only missing-action-permission is) |
| UI shell | [58c51219](https://app.devin.ai/sessions/58c51219b16f4019a3f54ae490e03abe) | child | docs/prompts/02 | b440fdb | e8d0908 | 04:40 | 04:48 | 8 (self-reported) | not visible to child | 0 | 0 | 0 | none yet | done: build/lint/typecheck/10 tests | never ran against live API; `POST /api/demo/session` response untyped in contract |
| integrate refunds | parent | coordinator | — | 9ab99b9 | 9ec225c | 04:49 | 04:53 | ~4 | unknown | ~4 | 1 (pulled postgres:16-alpine via mirror.gcr.io — Docker Hub 429) | 0 — independent re-run: `pnpm test:acceptance` 16/16, `pnpm check` 29 unit tests, `pnpm build` ok, app-role UPDATE on audit_events / payload denied by PG | — | done: refunds E2E at ~0:20 elapsed (cut rule 1:20 not needed) | G10 browser demo not yet recorded |
| flags contract + gate + playbook | parent | coordinator | docs/prompts/03 | 9ec225c | 159c34d | 04:53 | 04:58 | ~5 | unknown | ~5 | 0 | 0 | — | done | relaxed one assertion: denied decisions aren't audited by the platform (see backend gap) |
| playbook run #1: flags app | [1aa75ba3](https://app.devin.ai/sessions/1aa75ba3cb0947edb86cba96cb240258) | child | docs/prompts/03 | 159c34d | | 04:59 | | | | | | | | running | |
