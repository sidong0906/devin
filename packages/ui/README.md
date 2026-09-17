# @tools/ui — design system

The building blocks every internal tool's screen is made of. One package, no domain knowledge:
it does not import `@tools/contracts` and knows nothing about refunds, flags, or approvals. App
screens in `web/src/apps/<name>/` and the shared shell in `web/src/platform/` compose these
primitives; they do not write their own CSS for things that exist here.

```
src/
  tokens.css        design tokens: the only file allowed to contain raw colours and pixel values
  primitives.css    styles for the primitives, referencing tokens only
  styles.css        imports both; the one stylesheet a host app loads
  tone.ts           the semantic Tone type and cx() class helper
  primitives/       one React component file per building block
  index.ts          public surface
```

## Layers

```
tokens  →  primitives  →  patterns  →  domain components  →  screens
(css)      (this pkg)     (this doc)   (web/src/platform)     (web/src/apps/<name>)
```

1. **Tokens** (`tokens.css`): colour, type, spacing, radius as CSS variables prefixed `--ui-`. Change a
   token and every tool changes; nothing else in the tree should hard-code a hex value.
2. **Primitives** (`primitives/`): thin React components that own a class name and a small amount of
   behaviour (default `type="button"`, `aria-pressed`, `role`). They accept and forward native HTML props.
3. **Patterns** (below): how primitives combine for the situations every governed tool hits: loading,
   empty, error, status, and the request/approve action row.
4. **Domain components** (`web/src/platform/`): primitives bound to the contract, e.g. `ExecutionBadge`
   maps every `ExecutionState` to a `Badge` tone and a title. These are the only place that decides
   "which tone does state X get".
5. **Screens** (`web/src/apps/<name>/`): compose 1–4. A screen should contain almost no `className`.

## Tone: the one vocabulary for status

Every status element (`Badge`, `Alert`) takes a `tone`. The tone is semantic, not decorative:

| Tone | Meaning | Use for | Never for |
|---|---|---|---|
| `ok` | confirmed success | `SUCCEEDED`, `APPROVED`, published | anything unconfirmed |
| `warn` | unresolved, needs a human | `NEEDS_REVIEW`, stale data, "reconcile before acting" | success or failure |
| `danger` | denied, rejected, failed | `REJECTED`, 403, 409, request errors | warnings |
| `pending` | in progress or waiting | `PENDING`, `QUEUED`, `LEASED`, `RETRY_WAIT` | terminal states |
| `neutral` | informational | `NONE`, counts, metadata | outcomes |

Rule that matters in a fintech tool: **an unresolved outcome must never look like success.**
`warn` has a border and `ok` does not, so they are distinguishable without colour; the web test
`Badges.test.tsx` asserts that only `SUCCEEDED` gets the `ok` tone.

## Primitives

| Component | Element | Props beyond native | Notes |
|---|---|---|---|
| `Badge` | `span.badge` | `tone` | status pill; pass `title` for the long explanation and `data-state` for tests |
| `Chip`, `ChipGroup` | `span.chip`, `span.chips` | — | monospace identifiers (permissions, keys) |
| `Alert` | `div.alert` | `tone`, `role?` | `role` defaults to `alert` for warn/danger, `status` otherwise |
| `Button` | `button.btn` | `variant` (`primary`/`secondary`/`danger`), `active?` | `type="button"` by default; `active` sets `aria-pressed` |
| `ActionsRow`, `ButtonGroup` | `div` | — | action row under a card; tight filter group (`role=group`) |
| `Card` | `section.card` | — | one concern per card, `<h3>` as its heading |
| `Grid2` | `div.grid-2` | — | two columns, one below 900px |
| `SectionHead` | `div.section-head` | `heading` | `<h2>` plus right-aligned controls |
| `EmptyState` | `p.empty` | — | dashed placeholder |
| `Loading` | `p.muted` | — | text, not a spinner; the API is fast or it is broken |
| `KeyValueList`, `KeyValueRow` | `dl.kv` | `label` | label/value grid; raw `<dt>/<dd>` pairs are also fine |
| `Table` | `table.table` | `clickable?` | `className="num"` on numeric cells, `"actions"` on the trailing action cell |
| `Tabs`, `TabLink` | `nav.tabs`, `a.tab` | `active` | anchor-based; the host owns navigation; sets `aria-current` |
| `Select` | `select.select` | — | native select with system styling |

Text utilities (plain classes, no component): `.muted`, `.small`, `.mono`, `.danger-text`.

## Patterns

**Load / empty / error.** Every data view renders exactly one of these before its content:

```tsx
{error ? <ErrorBox error={error} prefix="Could not load payments:" /> : null}
{rows === null && !error ? <Loading>Loading payments…</Loading> : null}
{rows && rows.length === 0 ? <EmptyState>No payments.</EmptyState> : null}
```

`ErrorBox` lives in `web/src/platform/` because it understands the contract's `ApiError`; it renders an
`Alert tone="danger"` with `code`, `message`, and `requestId` verbatim. Never rewrite a server error
into friendlier prose; the code is what support searches for.

**Server-refused action.** When the server returns 403/409 for a button the user could see, keep the
button visible and show the refusal inline next to it (`Alert tone="danger"`, `data-testid` for the
case). The UI hides buttons only as a courtesy; authorization is the server's.

**Request detail.** `Grid2` with two `Card`s: the immutable payload (`KeyValueList`) and the decision +
execution state (`Badge`s, `ActionsRow`, then outcome `Alert`s). App-specific payload fields plug in
via `WebApp.PayloadFields`.

**Filters.** `ButtonGroup` of `Button variant="secondary" active={…}`; the group has `aria-label`.

## Adding a primitive

1. Add the class rules to `primitives.css` using tokens only.
2. Add `primitives/<Name>.tsx` forwarding native props and using `cx`.
3. Export it from `index.ts`; add a test in `primitives.test.tsx` if it has behaviour (roles, aria).
4. Document it in the table above. If it encodes a status, it must take a `Tone`, not a colour.

If a tool needs something twice, it belongs here. If it needs it once, it stays in the tool.

## Ownership

`packages/ui` is CODEOWNERS-protected like the other shared packages. Devin sessions building a new tool
compose from it and may propose additions, but the shared vocabulary (tones, primitives) changes only
with a human review, the same rule as `packages/contracts`.
