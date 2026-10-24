---
title: Redesign the site in a GitHub-like light theme, with Inter, JetBrains Mono and card tables on phones
status: proposed
date: 2026-10-24
decided_by: Proposed by tech-lead agent, approved by Graham
---

## Context

Spec 004 gave the site a theme (ADR 0014), but Graham doesn't like the result: uneven spacing, raw ISO dates, plain-word statuses, tall wrapping table rows, and tables that scroll sideways or get cut off on a phone. Spec 005 asks for a clean, technical look in the way github.com is, a footer with a contact link, formatted dates, status badges, and tables that show all their content at 375 px without scrolling sideways. Graham left the visual details to the tech lead, who made the choices in issue #57. The design doc is `docs/design/005-site-redesign.md`.

This ADR supersedes ADR 0014's Colour tokens, Fonts and Tables sections (including the over-budget row and the `.table-scroll` rule) and the colours in its Navigation section. ADR 0014 is not edited and keeps its status. Its contrast testing (axe `color-contrast` on every page) and its nav behaviour (always-visible tabs, `aria-current="page"`, and `"true"` on ADR pages) stay in force, restyled with the tokens below.

## Options considered

### Colour palette

1. **Restyle spec 004's cream and olive palette.** Little churn, but Graham doesn't like it, and most of its colours fail as text, so few roles are left.
2. **A neutral, GitHub-like palette: white surfaces, near-black text, one blue accent, and solid status colours, each with a pale fill.** Reads as technical and exact, which matches Graham's github.com example, and every text pair passes AA. It costs a new token set and rewritten token tests.
3. **A dark theme.** Looks "dev-tool", but the spec rules out dark mode, and it would need a light fallback anyway.

### Fonts

1. **Keep Source Serif 4 headings and Inter body, and add a mono.** Least churn, but the serif headings are the spec 004 look Graham wants replaced, and it means three font packages.
2. **Mona Sans (GitHub's own face, OFL 1.1) for headings.** Closest to github.com, but a new package whose fontsource file layout this build hasn't proven.
3. **Inter for headings and body, JetBrains Mono for the monospace accent.** One sans family, as github.com uses, already proven with `next/font/local`. Inter has tabular figures, and JetBrains Mono is built for code and identifiers. It costs one new dependency, and Source Serif 4 is dropped.

### Tables on a phone

1. **Keep the scroll box.** Keeps table roles, but the spec forbids sideways scroll.
2. **Hide low-priority columns.** Keeps table roles, but hides content, which the spec forbids.
3. **Reflow each row into a card below 40rem, with explicit ARIA table roles and `aria-hidden` column labels.** No sideways scroll and nothing hidden. The explicit roles keep the table semantics that `display: block` can drop in some browsers. It costs a label span in every data cell.

## Decision

Palette option 2, fonts option 3, tables option 3, with the rules below.

### Colour tokens

These are the only colours the site uses. The hex values are inspired by GitHub's open-source Primer palette (MIT). Ratios are WCAG 2.x, computed by `contrastRatio()` in `site/lib/theme.ts`. Text pairs need 4.5:1; borders, bars and rings need 3:1.

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

`site/lib/theme.ts` holds this table as `TOKENS`, and `site/app/globals.css` declares the same values as `--colour-*` properties. A unit test checks that the CSS, `TOKENS`, this table and the design doc's table agree, and that every ratio meets its threshold.

- **No translucent colours and no `color-mix()`.** A blended colour, such as `border`, is its own solid token.
- **No dark mode.** `color-scheme: light` and a `canvas` background on `html` and `body`. No `prefers-color-scheme` rules.
- **Links** are `accent` and underlined, so they don't rely on colour alone. Hover thickens the underline. Visited links are `visited`.
- **Keyboard focus.** `:focus-visible` is a 2px solid `accent` outline with a 2px offset on every focusable element. It stays a CSS `outline`, not a `box-shadow`.
- **Selection** is `fg` text on `accent-subtle`.
- **Badges.** A pill (`border-radius: 999px`) with a 1px border and text in the status colour on its pale fill. The border carries the meaning and reaches 3:1 on `canvas` and `canvas-subtle`; the fill is decorative; the word always stays. Badge text is 12 px at weight 600 with no `text-transform`. Mapping: proposed is `accent`, accepted is `success`, superseded is `fg-muted` on `neutral-subtle`, rejected is `danger`, Within budget is `success`, Over budget is `danger`. Each status has this one style everywhere it appears. An empty budget status renders no badge.
- **Over budget.** ADR 0014's over-budget row tint and its `terracotta` marker are removed. The Over budget badge replaces them.
- **The minifier writes `#FFFFFF` as `#fff`** inside rules, so `canvas` stays out of the `:visited`, `:hover`, `:focus-visible` and `::selection` rules.

### Fonts

- **Inter** (`@fontsource-variable/inter`, SIL Open Font License 1.1, free for commercial use) for body text and for `h1` to `h6`. Headings are weight 600, with `-0.01em` letter-spacing on `h1` and `h2`.
- **JetBrains Mono** (`@fontsource-variable/jetbrains-mono`, SIL Open Font License 1.1, free for commercial use) as `--font-mono`, for `code`, `kbd`, `pre`, `samp`, ADR numbers (the decisions index column and the ADR page eyebrow), the Spec column, and the Spend and Budget amounts. Count columns stay in Inter with `tabular-nums`.
- Both load the latin `wght` normal woff2 from their fontsource package with `next/font/local` and are served same-origin from `/_next/static/media/`. If `next/font/local` cannot resolve a path into `node_modules`, the woff2 and its `OFL.txt` are copied into `site/app/fonts/`, as ADR 0014 allowed.
- `@fontsource-variable/source-serif-4` is removed.

### Type and spacing scales

- **Type scale** (rem on a 16 px root): 0.75 (badges, phone column labels), 0.875 (tables, ADR meta, footer, nav), 1 (body), 1.25 (`h3`), 1.5 (`h2`), 2 (`h1`). Body line-height is 1.5.
- **Spacing scale:** `--space-1` to `--space-8` are 0.25, 0.5, 0.75, 1, 1.5, 2, 3 and 4 rem (4, 8, 12, 16, 24, 32, 48 and 64 px). Every `margin`, `padding` and `gap` in `globals.css` is a `var(--space-N)`, `0`, or `auto` (only to centre a block). Margins are set explicitly on `h1` to `h6`, `p`, `ul`, `ol`, `li`, `dl`, `dd`, `table`, `figure` and `pre`, so no browser default survives.
- **Layout.** `main`, the header row and the footer row have `max-width: 64rem` and centre with `margin-inline: auto`. Gutters are `var(--space-4)` (16 px) below 40rem and `var(--space-6)` (32 px) above. Prose (`p`, `ul`, `ol`, `dl` in `main`) is capped at 48rem; tables use the full width.

### Tables

- Every table, including Markdown tables in ADRs, has explicit roles: `table`, `rowgroup` on `thead` and `tbody`, `row`, `columnheader` on `th[scope=col]`, `rowheader` on `th[scope=row]` and `cell` on `td`. Markdown tables keep marked's `align` and get an `aria-label` from the nearest heading before them, or "Table".
- Each data cell starts with an `aria-hidden` `.cell-label` span holding its column's name, then the value. The label is hidden above 40rem. Because it is `aria-hidden` and not CSS generated content, it changes no accessible name. Row-header cells get no label. An empty cell still has its label.
- **Wide screens:** the header row has a `canvas-subtle` fill, `fg` text at weight 600 and a 1px `border` rule. Body rows have a 1px `border` separator. Cells have `var(--space-2) var(--space-3)` padding. Numeric columns (`num`: Spend, Budget, Runs, Runs with no cost, Runs not successful) are right-aligned with `tabular-nums`; every other column is left-aligned. In the decisions index and both metrics tables, header, date, number, identifier and badge cells don't wrap; only Decision, Title and Markdown prose columns do.
- **Below 40rem:** each row becomes a card with a 1px `border` outline, a 6 px radius, `var(--space-3)` padding and a `var(--space-3)` gap below. Each cell is a label | value grid. Values use `overflow-wrap: anywhere`. The header row is visually hidden with the clip pattern and keeps its `columnheader` role. No table or container has `overflow-x: auto`, and the `.table-scroll` wrapper is removed. `pre` keeps its own `overflow-x: auto`.

### Dates and the footer

- Dates read `Oct 23, 2026`, with `, 10:00 UTC` added where the source has a time, always in UTC. They sit in `<time>` elements whose `datetime` keeps the ISO value: the decisions index, the ADR page's Date, the metrics "Newest run included" line and the "Week starting" row headers. ADR prose is not touched.
- Every page has a footer (`contentinfo`) on a `canvas-subtle` band with a 1px `border` top rule and `fg-muted` text: "© YYYY AI Engineering Scaffold" and a "Contact us" link to `mailto:schill1025@gmail.com`. YYYY is the UTC year when the root layout renders, which is build time because every route is prerendered, and the footer exposes it as `data-build-year`.

### Navigation

ADR 0014's behaviour stays. Restyled: a `canvas` header band with a 1px `border` bottom rule; the site name in `fg` at weight 600; tabs in `fg` with a 6 px radius, at least 44 px tall below 40rem. Hover adds a `neutral-subtle` fill. The current tab is weight 600 with a 2px `highlight` bar along its bottom edge (an inset `::after` block, never a translucent shadow), so it differs by shape and weight, not only colour, and keeps both when hovered. A hovered current tab keeps its (empty) fill and shows an underline instead, so its look stays stable. No transitions: a colour mid-transition is not a token, and the issue made the transition optional.

## Consequences

- The site reads as white, near-black and blue, with status colour only in badges. `CLAUDE.md` and the `globals.css` header now point here.
- Adding a colour or a font still needs a new ADR, and the unit tests fail if `globals.css`, `TOKENS`, this ADR and the design doc drift apart.
- One new dependency, `@fontsource-variable/jetbrains-mono`, and one fewer, `@fontsource-variable/source-serif-4`.
- Every new table needs the explicit roles and a label span per data cell. The `Cell` component and `renderAdrBody()` provide them, so pages shouldn't hand-write cells.
- A table with many long columns could still be too wide between 40rem and 64rem. The no-wrap rule applies only from 64rem so such a table wraps there instead of scrolling. Revisit if a table outgrows the card layout or 64rem.
- The site stays light. A dark theme needs a new spec and a new ADR.
