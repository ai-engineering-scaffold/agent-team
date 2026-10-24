# Design: site redesign (spec 005)

Spec: [specs/005-site-redesign.md](../../specs/005-site-redesign.md) · Issue: #57 · ADR: [0017](../../decisions/0017-site-redesign-theme.md), superseding parts of [0014](../../decisions/0014-site-theme.md)

## Summary

The site moves to a neutral, GitHub-like light theme: white surfaces, near-black text, one blue accent, and status colours used only in badges. Inter sets headings and body; JetBrains Mono is a monospace accent for code, identifiers and dollar amounts. Every margin, padding and gap comes from an eight-step spacing scale. Dates read `Oct 23, 2026` inside `<time>` elements, ADR and budget statuses are pill badges, and tables get a quiet header row, right-aligned tabular numbers and, below 40rem, a card per row that keeps its ARIA table roles. A footer carries the build year and a "Contact us" mail link. It all ships in one PR (spec, Design input; ADR 0016).

## 1. Colour palette (AC1, AC2, AC5, AC8)

| Option | Gives | Costs |
| --- | --- | --- |
| A. Restyle spec 004's cream and olive palette | Little churn | Graham doesn't like it; most of its colours fail as text |
| **B. Neutral, GitHub-like palette with solid status colours and pale fills** | Technical and exact, like github.com; every text pair passes AA | A new token set; token tests rewritten |
| C. A dark theme | Looks "dev-tool" | The spec rules out dark mode |

**Choice: B.** The hex values are inspired by GitHub's open-source Primer palette (MIT). Ratios are WCAG 2.x, computed by `contrastRatio()`; text pairs need 4.5:1 and borders, bars and rings 3:1.

| Token | Hex | Role | Contrast |
| --- | --- | --- | --- |
| `canvas` | `#FFFFFF` | page background, table rows, cards, header band | n/a |
| `canvas-subtle` | `#F6F8FA` | table header row, footer band, code background | n/a |
| `neutral-subtle` | `#EFF2F5` | nav hover fill, superseded badge fill | n/a |
| `border` | `#D1D9E0` | header and footer rules, table separators, card outlines (decorative only) | n/a |
| `fg` | `#1F2328` | body text, headings, table text, current nav tab text | 15.8:1 on canvas, 14.8:1 on canvas-subtle, 14.1:1 on neutral-subtle, 13.9:1 on accent-subtle |
| `fg-muted` | `#59636E` | secondary text: ADR meta labels, phone column labels, footer text, superseded badge text and border | 6.1:1 on canvas, 5.7:1 on canvas-subtle, 5.4:1 on neutral-subtle |
| `accent` | `#0969DA` | links, focus ring, proposed badge text and border | 5.2:1 on canvas, 4.9:1 on canvas-subtle, 4.6:1 on accent-subtle |
| `accent-subtle` | `#DDF4FF` | proposed badge fill, selection background (with fg text) | n/a |
| `visited` | `#8250DF` | visited links | 5.0:1 on canvas, 4.7:1 on canvas-subtle |
| `success` | `#1A7F37` | accepted and Within budget badge text and border | 5.1:1 on canvas, 4.8:1 on canvas-subtle, 4.6:1 on success-subtle |
| `success-subtle` | `#DAFBE1` | accepted and Within budget badge fill | n/a |
| `danger` | `#CF222E` | rejected and Over budget badge text and border | 5.4:1 on canvas, 5.0:1 on canvas-subtle, 4.7:1 on danger-subtle |
| `danger-subtle` | `#FFEBE9` | rejected and Over budget badge fill | n/a |
| `highlight` | `#BC4C00` | the 2px current-page bar under the current nav tab | 5.0:1 on canvas |

The issue's hand-worked figures were within 0.1 of these; three came out a tenth different when computed (`fg` on canvas-subtle 14.8, `visited` on canvas-subtle 4.7, `danger` on canvas 5.4), and the computed value is the one recorded. Two pairs are added for roles the issue names: `fg` on `neutral-subtle` (hovered nav tab text) and `fg` on `accent-subtle` (selected text).

### Checked four ways

`site/lib/theme.ts` holds the table as `TOKENS`. Each contrast claim carries its threshold (`min: 4.5` or `3`). `site/tests/theme.test.ts` checks that:

- `TOKENS` is exactly this palette, in this order;
- every stated ratio equals the computed one to one decimal place and meets its threshold unrounded;
- every text token reaches 4.5:1 on `canvas` and `canvas-subtle`, each badge's text 4.5:1 on its fill and its border 3:1 on both surfaces, and the bar and focus ring 3:1 on `canvas`;
- the `--colour-*` properties in `globals.css` equal `TOKENS`, and `globals.css` uses no other colour, no `color-mix()`, no `currentColor` keyword and no `prefers-color-scheme`;
- the token tables in ADR 0017 and in this doc match `TOKENS` row for row.

### Rules

- Links are `accent` and underlined; hover thickens the underline to 2px; visited links are `visited`.
- `:focus-visible` is a 2px solid `accent` outline with a 2px offset. It is an `outline`, so the existing focus-ring test still applies.
- `::selection` is `fg` on `accent-subtle`.
- `canvas` is kept out of every `:visited`, `:hover`, `:focus-visible` and `::selection` rule, because the minifier writes `#FFFFFF` as `#fff` there. The nav's hover and current-tab rules use `transparent` instead.

## 2. Fonts (AC1)

| Option | Gives | Costs |
| --- | --- | --- |
| A. Keep Source Serif 4 and Inter, add a mono | Least churn | Keeps the spec 004 look; three font packages |
| B. Mona Sans for headings | Closest to github.com | Fontsource layout not proven in this build |
| **C. Inter for headings and body, JetBrains Mono as the accent** | One sans family; proven loading; tabular figures; a mono built for code | One new dependency; Source Serif 4 dropped |

**Choice: C.** Both are SIL Open Font License 1.1 and load through `next/font/local` in `site/app/fonts.ts` from their fontsource package's latin `wght` normal woff2: Inter as `--font-body` (weights 100 to 900) and JetBrains Mono as `--font-mono` (weights 100 to 800). `next/font` serves them same-origin from `/_next/static/media/`. The path into `node_modules` resolves, so the copy-into-`app/fonts/` fallback is not needed.

- `body` and `h1` to `h6` use `var(--font-body)`. Headings are weight 600 with `line-height: 1.25`, and `h1` and `h2` have `-0.01em` letter-spacing and `text-wrap: balance`.
- `code`, `kbd`, `pre`, `samp` and the `.mono` class use `var(--font-mono)`. `.mono` marks ADR numbers (the decisions index column and the ADR page eyebrow), the Spec column, and Spend and Budget cells. Count columns stay in Inter with `tabular-nums`.
- `site/tests/fonts.test.ts` checks both files, their packages and licences, that the font packages are exactly these two, and that `globals.css` names no font family other than the two variables. Its Inter `tnum` tests are unchanged.

## 3. Type and spacing scales (AC3)

Type, in rem on a 16 px root: 0.75 (badges, phone column labels), 0.875 (tables, ADR meta, footer, nav, the ADR eyebrow), 1 (body, `h4` to `h6`), 1.25 (`h3`), 1.5 (`h2`), 2 (`h1`). Body line-height is 1.5.

| Step | Value | Pixels |
| --- | --- | --- |
| `--space-1` | 0.25rem | 4 |
| `--space-2` | 0.5rem | 8 |
| `--space-3` | 0.75rem | 12 |
| `--space-4` | 1rem | 16 |
| `--space-5` | 1.5rem | 24 |
| `--space-6` | 2rem | 32 |
| `--space-7` | 3rem | 48 |
| `--space-8` | 4rem | 64 |

Every `margin`, `padding`, `gap` (and `scroll-margin-top`) in `globals.css` is `var(--space-N)`, `0`, or `auto` where it centres a block. Margins are set on `h1` to `h6`, `p`, `ul`, `ol`, `li`, `dl`, `dt`, `dd`, `table`, `figure`, `pre`, `blockquote` and `hr`, so no browser default reaches computed style. Lists replace the browser's 40 px indent with `var(--space-5)`.

Vertical rhythm: `h1` is `var(--space-6) 0 var(--space-4)`, `h2` is `var(--space-7) 0 var(--space-3)`, `h3` is `var(--space-5) 0 var(--space-2)`, `h4` to `h6` are `var(--space-4) 0 var(--space-2)`, and `p`, `ul`, `ol` and `dl` are `0 0 var(--space-4)`.

Layout: `main`, `.site-header-inner` and `.site-footer-inner` have `width: 100%`, `max-width: 64rem` and `margin-inline: auto`. Gutters are `padding-inline: var(--space-4)` below 40rem and `var(--space-6)` above. `p`, `ul`, `ol` and `dl` in `main` are capped at 48rem; tables use the full width. `body` is a flex column with `min-height: 100vh` and `main` grows, so the footer sits at the bottom of short pages.

## 4. Tables (AC6, AC7)

| Option | No sideways scroll, nothing clipped | Keeps table roles | Costs |
| --- | --- | --- | --- |
| A. Keep the scroll box | No | Yes | n/a |
| B. Hide low-priority columns | No | Yes | n/a |
| **C. Cards below 40rem, explicit roles, `aria-hidden` labels** | Yes | Yes | A label span per cell |

**Choice: C.**

### Markup

Every table, including Markdown tables, has `role="table"`, `role="rowgroup"` on `thead` and `tbody`, `role="row"`, `role="columnheader"` on `th scope="col"`, `role="rowheader"` on `th scope="row"` and `role="cell"` on `td`. A data cell is:

```html
<td role="cell" class="num mono">
  <span class="cell-label" aria-hidden="true">Spend</span><span class="cell-value">$16.10</span>
</td>
```

The value has its own span so the phone grid has exactly two items, however many inline nodes the value holds. Row-header cells have no label. An empty cell keeps its label and an empty value.

- `site/app/_components/cell.tsx` renders this for the decisions and metrics pages.
- `renderAdrBody()` in `site/lib/markdown.ts` emits the same markup for Markdown tables, with each label taken from its column header's plain text and HTML-escaped, and keeps marked's `align`. The heading-based label moves from the old scroll region onto `<table aria-label="...">`. The `.table-scroll` wrapper, its `role="region"` and `tabindex` are gone everywhere.
- The decisions index and both metrics tables carry `class="data-table"`. Cells that may wrap (Decision, Title) carry `wrap`. Numeric cells carry `num`.

### Wide screens

The header row has a `canvas-subtle` fill, `fg` text at weight 600 and a 1px `border` bottom rule. Body rows are `canvas` with a 1px `border` separator. Cells have `var(--space-2) var(--space-3)` padding and `vertical-align: top`. `num` cells are right-aligned with `tabular-nums`; everything else is left-aligned. Row-header cells stay at weight 400 so they don't read as the header row.

From 64rem, every `th` and `td` in a `.data-table` is `white-space: nowrap` except `td.wrap`. At 1280 px each table fits in the 64rem column with room to spare. Scoping the rule to 64rem and up means a screen between 40rem and 64rem wraps long cells instead of scrolling sideways. Markdown tables always wrap.

### Below 40rem

`table`, `tbody`, `tr`, `th` and `td` become `display: block`. Each body `tr` is a card: a 1px `border` outline, a 6 px radius, `var(--space-3)` padding and a `var(--space-3)` bottom margin. The row header is the card title at weight 600. Each `td` is a grid of `minmax(0, 2fr) minmax(0, 3fr)` with `gap: var(--space-2)`: the label in `fg-muted` at 0.75rem on the left, the value on the right (right-aligned for `num` cells). Values use `overflow-wrap: anywhere` and `white-space: normal`, so nothing is wider than the card. `thead` is hidden with `position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%)`, so its cells keep the `columnheader` role. No table or container has `overflow-x: auto`; only `pre` keeps it.

### Over budget

The over-budget row class, tint and `terracotta` marker are removed. The Over budget badge replaces them (AC5, AC10).

## 5. Dates, badges and the build year (AC4, AC5, AC9)

- `site/lib/dates.ts`: `formatDate(iso)` gives `Oct 23, 2026` and `formatDateTime(iso)` gives `Oct 23, 2026, 10:00 UTC`. The date part uses `Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" })`; the time is the zero-padded UTC hours and minutes, with seconds dropped. A date-only value parses as midnight UTC, so no time zone can move it a day. Invalid input throws `invalid date: ...`. It replaces `formatUtc` in `lib/metrics.ts`.
- `<DateTime iso>` (`site/app/_components/date-time.tsx`) renders `<time dateTime={iso}>`, using `formatDate` for a `YYYY-MM-DD` value and `formatDateTime` otherwise. It is used in the decisions index Date column, the ADR page's Date, the metrics "Newest run included" line and the "Week starting" row headers.
- `site/lib/status.ts`: `badgeTone(status)` maps proposed to `accent`, accepted to `success`, superseded to `neutral`, rejected to `danger`, Within budget to `success` and Over budget to `danger`, and throws on anything else. `<Badge status>` (`site/app/_components/badge.tsx`) renders `<span class="badge badge-{tone}">{status}</span>`. It is used in the decisions index, the ADR page's Status (followed by ", superseded by ADR NNNN" when set) and the Spend by spec Status column, where an empty status renders no badge.
- Badge CSS: `display: inline-block`, `padding: 0 var(--space-2)`, a 1px border in the tone colour, `border-radius: 999px`, 0.75rem at weight 600, `line-height: 1.5`, `white-space: nowrap`, no `text-transform`.
- **Build year.** The root layout computes `new Date().getUTCFullYear()` while rendering. Every route is prerendered, so that is the build year. It renders:

  ```html
  <footer class="site-footer" data-build-year="2026">
    <div class="site-footer-inner">
      <span>© 2026 AI Engineering Scaffold</span><span aria-hidden="true">·</span><a href="mailto:schill1025@gmail.com">Contact us</a>
    </div>
  </footer>
  ```

  The footer is a `canvas-subtle` band with a 1px `border` top rule and `fg-muted` text at 0.875rem. Its inner row is a wrapping flex row with `gap: var(--space-1) var(--space-2)` and `padding-block: var(--space-5)`, so at 375 px it fits on one line, or two at most.

## 6. Navigation (AC8)

`site/lib/nav.ts` and `main-nav.tsx` keep their logic: always-visible tabs, `aria-current="page"` on the current page and `"true"` on ADR pages (ADR 0014). Restyled:

- The header band is `canvas` with a 1px `border` bottom rule. The site name is `fg` at weight 600. Below 40rem the site name and the tabs stack.
- Tabs are `fg` text on a transparent background, 0.875rem, a 6 px radius and `padding: 0 var(--space-3)`. They are at least 2.25rem tall, and 2.75rem (44 px) below 40rem.
- Hover adds a `neutral-subtle` fill.
- The current tab (`a[aria-current]`) is weight 600 with a 2px `highlight` bar: an `::after` block positioned at the tab's bottom edge, inset `var(--space-2)` from each side, with a 2px radius. Hovering it keeps the transparent fill, the weight and the bar, and adds an underline as its hover cue.
- No transition. The issue made one optional, and a colour mid-transition is not a token, which the AC1 computed-colour test would catch.

## 7. Small touches

- The ADR page shows `ADR 0017` as a mono, `fg-muted` eyebrow above the `h1`, and the status, date and decided-by details as a bordered two-column `dl` grid with `fg-muted` labels.
- Headings have `scroll-margin-top: var(--space-4)`.
- Inline `code` has a `canvas-subtle` background, a 6 px radius and `0 var(--space-1)` padding; `pre` has `var(--space-4)` padding.

## 8. Tests that change (AC10)

Only the tests spec 005 lists are rewritten, each at least as strictly:

- `site/tests/theme.test.ts`: the token tests and both token-table tests now pin ADR 0017's palette and read ADR 0017 and this doc. The spec 004 shade test goes with the palette it tested.
- `site/tests/fonts.test.ts`: the font, package and family tests now pin Inter and JetBrains Mono. The `tnum` tests are unchanged.
- `site/tests/metrics.test.ts`: "AC6: the newest run is shown as a UTC date and time" now checks `formatDateTime`.
- `site/tests/markdown.test.ts`: the scroll-region assertions now check the label on the table itself and that no scroll region remains. The heading-label and escaping checks stay. "keeps the alignment the Markdown sets" cannot match its old exact string once cells carry roles and labels, so it now checks the same `align` values on the new markup.
- New: `site/tests/dates.test.ts` and `site/tests/status.test.ts`.
- Playwright: the issue lists the rewrites to `theme.spec.ts`, `tables.spec.ts`, `nav.spec.ts` and `metrics.spec.ts`, and new specs for AC3, AC4, AC5, AC7 and AC9. The qa-automation agent writes those.

## 9. What changes outside the site

`CLAUDE.md`'s theme line and the `globals.css` header now name ADR 0017. ADR 0014 is not edited and keeps its status.
