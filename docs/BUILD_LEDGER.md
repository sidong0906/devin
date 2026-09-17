# Build ledger

One row per session/stage. Unknown values stay unknown. Times are UTC.

| stage | session | role | prompt/playbook | base SHA | head SHA | start | end | wall min | agent usage | human active min | interventions | failed checks | review findings | status | gaps |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| research + plan | parent | coordinator | conversation | — | — | 2026-09-17 04:25 | 2026-09-17 04:33 | ~8 (plus earlier review) | unknown | — | — | — | — | done | — |
| scaffold + contracts | parent | coordinator | plan §7 | (empty repo) | b440fdb | 2026-09-17 04:33 | 2026-09-17 04:39 | 6 | unknown | 0 | 0 | 4 (react types version, vite config type, exactOptionalPropertyTypes on fetch body, tsconfig extends path) | — | done | contracts frozen; no runtime yet |
| backend slice | [52f726f5](https://app.devin.ai/sessions/52f726f5f0cb4095b67f6857c4d71c06) | child | prompts/backend.md (§7.1) | b440fdb | | 2026-09-17 04:41 | | | | | | | | running | |
| UI shell | [58c51219](https://app.devin.ai/sessions/58c51219b16f4019a3f54ae490e03abe) | child | prompts/ui.md (§7.2) | b440fdb | | 2026-09-17 04:41 | | | | | | | | running | |
