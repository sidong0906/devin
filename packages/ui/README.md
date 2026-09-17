# @tools/ui — design system

The building blocks every internal tool's screen is made of. One package, no domain knowledge:
it does not import `@tools/contracts` and knows nothing about refunds, flags, or approvals. App
screens in `web/src/apps/<name>/` and the shared shell in `web/src/platform/` compose these
primitives; they do not write their own CSS for things that exist here.

It is built **on [Radix Themes](https://www.radix-ui.com/themes/docs/overview/getting-started)**, not
from scratch. Radix provides the accessible components, the colour scales, typography, spacing and
focus states; this package provides the fintech-specific vocabulary on top (the five status tones,
the load/empty/error patterns, the app/platform ownership rules) and a stable API so a new tool
never talks to Radix directly.

```
Radix Themes         components, 12-step colour scales, type/space/radius scales, focus rings, a11y
      ↓
packages/ui          UiProvider (one fixed theme), --ui-* semantic tokens, Tone → colour mapping,
                     thin wrappers with project defaults (Badge, Alert, Button, Card, Table, ...)
      ↓
web/src/platform     contract-bound components: which Tone does ExecutionState X get, ErrorBox
      ↓
web/src/apps/<name>  screens; compose the layers above, almost no className
```

```
src/
  styles.css          imports Radix Themes' stylesheet, then tokens.css, then overrides.css
  tokens.css          --ui-* semantic aliases over Radix variables; the only file naming a raw scale colour
  overrides.css       the handful of rules Radix does not provide (~15 lines, tokens only)
  tone.ts             Tone type, TONE_COLOR (tone → Radix scale), cx()
  primitives/         one React component file per building block, each wrapping a Radix component
  index.ts            public surface; also re-exports a small Radix escape hatch (Box, Flex, Text, ...)
```

## Why Radix Themes

Chosen over custom-built primitives (the first version of this package) and over the other common
options:

| Option | Why not / why |
|---|---|
| Custom CSS + components | Every accessibility detail (focus rings, contrast, keyboard handling) is our bug to find. ~300 lines of CSS to maintain per tool family. Fine for a demo, not for a dozen tools. |
| Tailwind-only | A utility layer, not a component library; still hand-writing Table/Select/Callout semantics. |
| MUI / Ant / Chakra | Full-featured, but heavy runtime theming, opinionated look that is hard to make "ours", and larger bundles. |
| shadcn/ui | Copies component source into the repo (Radix primitives + Tailwind). Good fit for a product; for a platform it means we own every copied file. |
| **Radix Themes** | Pre-styled components on top of Radix's accessible primitives; CSS-variable theming (no runtime CSS-in-JS); 12-step colour scales built for consistent text/background contrast; `Theme` props for accent/gray/radius/scale; small, tree-shakeable, MIT. Maps 1:1 onto the primitives we already had. |

Cost: one dependency (`@radix-ui/themes`, pinned in the pnpm catalog) and ~80 kB gzipped of CSS
loaded once per tool. Radix ships `styles.css` as one file; splitting per-component CSS is possible
later if the size matters.

## Layers

1. **Theme** (`UiProvider`): wraps the app root once. Sets `accentColor="indigo" grayColor="slate"
   radius="medium" scaling="95%"`. Fixed on purpose: tools should look the same, not pick an accent.
2. **Tokens** (`tokens.css`): `--ui-*` variables that alias Radix scale steps
   (`--ui-ok-bg: var(--green-3)`). Screens and overrides reference `--ui-*`, never `--green-3` directly,
   so re-mapping a tone is a one-line change.
3. **Primitives** (`primitives/`): thin wrappers that pin a Radix variant and size, add the project's
   class names (`badge`, `badge-warn`, `btn`, `table`...) for tests and the few overrides, and add
   behaviour Radix leaves to the caller (`type="button"`, `aria-pressed`, `role`).
4. **Patterns** (below): how primitives combine for loading, empty, error, status and the action row.
5. **Domain components** (`web/src/platform/`): primitives bound to the contract, e.g. `ExecutionBadge`
   maps every `ExecutionState` to a `Badge` tone and a title. The only place that decides "which tone
   does state X get".
6. **Screens** (`web/src/apps/<name>/`): compose 1–5.

## Tone: the one vocabulary for status

Every status element (`Badge`, `Alert`) takes a `tone`. The tone is semantic, not decorative, and each
maps to exactly one Radix colour scale (`TONE_COLOR` in `tone.ts`):

| Tone | Radix scale | Meaning | Use for | Never for |
|---|---|---|---|---|
| `ok` | `green` | confirmed success | `SUCCEEDED`, `APPROVED`, published | anything unconfirmed |
| `warn` | `amber` | unresolved, needs a human | `NEEDS_REVIEW`, stale data, "reconcile before acting" | success or failure |
| `danger` | `red` | denied, rejected, failed | `REJECTED`, 403, 409, request errors | warnings |
| `pending` | `indigo` | in progress or waiting | `PENDING`, `QUEUED`, `LEASED`, `RETRY_WAIT` | terminal states |
| `neutral` | `gray` | informational | `NONE`, counts, metadata | outcomes |

Rule that matters in a fintech tool: **an unresolved outcome must never look like success.**
`warn` badges carry an inset border that `ok` badges do not, so they are distinguishable without
colour; the web test `Badges.test.tsx` asserts that only `SUCCEEDED` gets the `ok` tone, and
`primitives.test.tsx` asserts the five tones map to five distinct Radix scales.

## Primitives

| Component | Wraps (Radix) | Props beyond Radix | Notes |
|---|---|---|---|
| `Badge` | `Badge` soft | `tone` | status pill; pass `title` for the long explanation and `data-state` for tests |
| `Chip`, `ChipGroup` | `Code` soft, `Flex` | — | monospace identifiers (permissions, keys) |
| `Alert` | `Callout.Root/Text` surface | `tone`, `role?` | `role` defaults to `alert` for warn/danger, `status` otherwise |
| `Button` | `Button` | `variant` (`primary`/`secondary`/`danger`), `active?` | `type="button"` by default; `active` → soft variant + `aria-pressed` |
| `ActionsRow`, `ButtonGroup` | `Flex` | — | action row under a card; tight filter group (`role=group`) |
| `Card`, `CardTitle` | `Card` surface (as `<section>`), `Heading` | — | one concern per card; `CardTitle` is the uppercase `<h3>` |
| `Grid2` | `Grid` | — | two columns from the `md` breakpoint, one below |
| `SectionHead` | `Flex` + `Heading` | `heading` | `<h2>` plus right-aligned controls |
| `EmptyState` | — | — | dashed placeholder (`p.empty`) |
| `Loading` | `Text` | — | text, not a spinner; the API is fast or it is broken |
| `KeyValueList`, `KeyValueRow` | `DataList.Root/Item/Label/Value` | `label` | label/value grid, renders `<dl>/<dt>/<dd>`; always use `KeyValueRow` |
| `Table.Root/Head/Body/Row/Th/Td` | `Table.*` surface | `clickable?` on Root | `className="num"` on numeric cells, `"actions"` on the trailing action cell |
| `Tabs`, `TabLink` | `TabNav.Root/Link` | `active` | anchor-based; the host owns navigation; `active` sets `aria-current="page"` |
| `Select` | — (native `<select>`) | — | kept native so it works in plain forms and jsdom; styled with tokens |

### Dashboard layer (shell, widgets, charts)

Internal-tool users expect the Power Apps shape: a left rail of tools, a header, KPI tiles, charts, then
the table. These primitives give every tool that shape from real API data; the tables stay the record.

| Component | Built on | Props | Notes |
|---|---|---|---|
| `AppShell` | CSS grid | `sidebar`, `header`, `children` | 232px sticky rail + sticky header + grey canvas; collapses to one column under 900px |
| `Sidebar`, `NavSection`, `NavItem` | anchors | `brand`, `footer`; `active`, `icon`, `meta` | `NavItem` sets `aria-current="page"`; the host owns routing |
| `AppIcon` | `span` | `color` (tone or Radix scale), `size` | coloured tile behind an icon; a tool's identity colour, separate from status tones |
| `PageHeader` | `Flex` + `Heading` | `icon`, `title`, `description`, `actions` | replaces `SectionHead` at the top of a tool screen |
| `StatTile`, `StatGrid` | `Box`, `Grid` | `label`, `value`, `hint`, `tone`, `icon` | KPI card with a tone-coloured top border; grid auto-fits ~190px columns |
| `Meter` | `Progress` soft | `label`, `value`, `max`, `tone`, `caption` | labelled progress bar for "x of y reached this stage" |
| `ChartCard` | `Box` | `title`, `description`, `actions` | the frame every chart or table sits in; use `.dashboard-grid` + `.span-N` (12 columns) to lay cards out |
| `DonutChart` | Recharts `PieChart` | `data: Slice[]`, `centerLabel`, `height` | total in the middle; renders `ChartEmpty` when everything is zero |
| `BarsChart` | Recharts `BarChart` | `data: Slice[]`, `layout`, `tone` | vertical or horizontal; per-bar tone/colour |
| `TrendChart` | Recharts `AreaChart` | `data: TrendPoint[]`, `series: Series[]` | stacked areas, one per series |
| `Icons` | `@radix-ui/react-icons` | — | curated re-export; add to `icons.ts`, do not import the package elsewhere |

Chart colours come from the same place as everything else: a `Slice`/`Series` takes either a `tone`
(status: `ok`/`warn`/`danger`/`pending`/`neutral`) or a `color` from `CHART_SERIES` (categories such as
tools). Fills resolve to `var(--<scale>-9)`, so charts follow the theme and stay legible against step-1/2
backgrounds. `colorProps(app.color)` converts a tool's identity colour into the right prop. Every chart
has `role="img"` and an `aria-label` that states the numbers, so the picture is never the only copy.

What a dashboard may show: counts and shares derived from contract DTOs the screen already fetched
(`web/src/platform/metrics.ts` for the approvals list). What it may not do: fetch a second, unaudited
source, or colour an unresolved state green.

Text utilities (plain classes): `.muted`, `.small`, `.mono`, `.danger-text`.

**Escape hatch.** `index.ts` re-exports `Box, Flex, Grid, Text, Heading, Code, Separator, Link` from
Radix for one-off layout. Anything with a colour or a status goes through a primitive above so the
tone rules hold. Do not import `@radix-ui/themes`, `@radix-ui/react-icons` or `recharts` from `web/`;
the boundary is this package.

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
via `WebApp.PayloadFields` and render `KeyValueRow`s.

**Filters.** `ButtonGroup` of `Button variant="secondary" active={…}`; the group has `aria-label`.

## Accessibility baseline

Inherited from Radix: visible focus rings, colour steps chosen for contrast (step 11 text on step 3
background), keyboard handling in `TabNav`. Added here: `Alert` roles, `Button` `aria-pressed`,
`TabLink`/`NavItem` `aria-current`, the warn border, chart `aria-label`s. Status is never colour-only:
every badge has text, every tile has a label, and `title` carries the long explanation.

## Adding or changing a primitive

1. Prefer wrapping an existing Radix component (pin its `variant`/`size`, add the project class name)
   over new CSS. If a rule is needed, add it to `overrides.css` using `--ui-*` tokens only.
2. Add `primitives/<Name>.tsx` forwarding Radix props and using `cx`; export it from `index.ts`.
3. Add a test in `primitives.test.tsx` if it has behaviour (roles, aria, tone mapping).
4. Document it in the table above. If it encodes a status, it must take a `Tone`, not a colour.

If a tool needs something twice, it belongs here. If it needs it once, use the escape hatch in the tool.

## Ownership

`packages/ui` is CODEOWNERS-protected like the other shared packages. Devin sessions building a new tool
compose from it and may propose additions, but the shared vocabulary (tones, primitives, the theme) changes
only with a human review, the same rule as `packages/contracts`. Radix Themes, Radix Icons and Recharts
are pinned in `pnpm-workspace.yaml`'s catalog so all packages upgrade together.
