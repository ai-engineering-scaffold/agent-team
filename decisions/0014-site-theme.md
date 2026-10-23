---
title: Theme the site with Graham's palette, self-hosted Source Serif 4 and Inter, and axe for contrast
status: proposed
date: 2026-10-23
decided_by: Proposed by tech-lead agent, approved by Graham
---

## Context

ADR 0005 left the site "unstyled beyond basic structure until Graham provides a design theme". Spec 004 is that theme. Graham gave a five-colour palette and asked for a clean, professional look, a better nav, and restyled tables and fonts. The spec requires every colour to come from the palette, white, or a darker shade the ADR lists (AC1), WCAG AA contrast checked automatically (AC2), self-hosted fonts with a free commercial licence (AC3), a nav that marks the current page by more than colour (AC4, AC5), and readable tables (AC6, AC7). Most palette colours fail AA as text on the cream background, so the colours need fixed roles.

This ADR records the colour tokens and contrast testing (#43), the fonts (#44), the table rules (#45) and the nav (#46), so the four build PRs share one decision. The design doc is `docs/design/004-site-theme.md`.

## Options considered

### Contrast testing (AC2)

1. **A computed-colour check written by hand.** No dependency, but it covers only the element and colour pairs we list. It misses text over a fill set on an ancestor, and it misses new pages.
2. **`@axe-core/playwright`, a dev dependency under MPL-2.0, maintained by Deque.** Its `color-contrast` rule walks every text node, resolves the real background and applies the large-text threshold. It is the standard tool. It costs one dev dependency.

### Fonts (AC3)

1. **`next/font/google`.** No new dependency and self-hosted at runtime, but every build fetches from Google, so builds fail wherever that host is unreachable.
2. **`@fontsource-variable/inter` and `@fontsource-variable/source-serif-4`, loaded with `next/font/local`.** Versioned through npm, no network beyond `npm ci`, and `next/font` adds preloading and a size-adjusted fallback. It costs two dependencies.
3. **Importing the fontsource CSS directly.** No preload and no fallback metrics, so a visible font swap and layout shift.
4. **Committing the woff2 files with their `OFL.txt`.** No dependency, but unversioned binaries in the repo.

### Navigation (AC4, AC5)

1. **A menu button below a breakpoint.** Common, but it needs client-side state, an accessible disclosure, and an extra step in every existing nav test on the mobile project.
2. **Always-visible pill tabs.** Three short links fit in one row at 375 px, so nothing is hidden. It costs a second header row on narrow screens.

## Decision

### Colour tokens

These are the only colours the site uses. Shades keep the source colour's hue and saturation and lower its HSL lightness. Ratios are WCAG 2.x contrast ratios.

| Token | Hex | Source | Role | Contrast |
| --- | --- | --- | --- | --- |
| `cream` | `#E8E1CF` | palette | page background | n/a |
| `white` | `#FFFFFF` | allowed by AC1 | header band, table bodies | n/a |
| `ink` | `#313824` | dark olive at 62% lightness | body text, table text, selection text | 9.4:1 on cream, 12.2:1 on white, 5.6:1 on sage |
| `dark-olive` | `#4F5B3A` | palette | headings, visited links, focus ring, current nav tab fill | 5.6:1 on cream, 7.3:1 on white |
| `terracotta-dark` | `#7E5039` | terracotta at 75% lightness | links, the "Over budget" status text | 5.2:1 on cream, 6.8:1 on white |
| `terracotta` | `#A86B4C` | palette | over-budget row marker, a UI marker that needs 3:1 | 3.3:1 on cream |
| `olive` | `#7A8B5A` | palette | 3px header bottom rule (decorative) | n/a |
| `sage` | `#B9B08C` | palette | text-selection background, table header fill, table row separators (decorative) | n/a |

`site/lib/theme.ts` holds this table as `TOKENS`, and `site/app/globals.css` declares the same values as `--colour-*` properties. A unit test checks that the CSS, `TOKENS`, every ratio above and this table all agree.

- **Text.** Body text is `ink` and headings are `dark-olive`. `terracotta`, `olive` and `sage` are never text colours.
- **Links.** `terracotta-dark` with an underline, so links don't rely on colour alone. Visited links are `dark-olive`. Hover thickens the underline.
- **Keyboard focus.** `:focus-visible` gets a 2px solid `dark-olive` outline with a 2px offset on every focusable element.
- **Selection.** A `sage` background with `ink` text.
- **Borders.** `sage`, decorative only.
- **No dark mode.** `color-scheme: light` and a cream background on `html` and `body`, so a dark system preference still gets the cream page. No `prefers-color-scheme` rules.
- **No other colours.** No translucent colours and no `color-mix()`. A blended colour needs its own token in a new ADR.

### Contrast testing

Option 2: `@axe-core/playwright` runs the `color-contrast` rule on every page, on desktop and mobile. Unit tests of the token pairs above document the intended pairs and run without a browser.

### Fonts

Option 2. Headings use **Source Serif 4** and body text uses **Inter**. Both are variable fonts under the SIL Open Font License 1.1, which is free for commercial use. They load with `next/font/local` from each fontsource package's latin `wght` normal woff2 file and are served same-origin from `/_next/static/media/`. Code stays on the system monospace stack. If `next/font/local` cannot resolve a path into `node_modules`, the same two files and their `OFL.txt` are copied into `site/app/fonts/` (option 4), and that PR says so.

### Tables

- Header row: `sage` fill, `ink` text, weight 600. `terracotta-dark` and `dark-olive` text are never put on `sage`, since both fall below 4.5:1 there.
- Body rows: `white` background, `ink` text and a 1px `sage` bottom separator.
- Numeric columns carry a `num` class: right-aligned with `font-variant-numeric: tabular-nums`. Text, date and identifier columns stay left-aligned.
- Over-budget rows: an `over-budget` class set from the same `budgetStatus()` result that prints "Over budget". The row has a `cream` background, a 4px `terracotta` left border on its first cell, and the status text in `terracotta-dark` at weight 600. The words stay, so the status never depends on colour alone.
- Every table, including Markdown tables in ADRs, sits in a focusable, labelled `.table-scroll` region, so a wide table scrolls inside its own box.

### Navigation

Option 2: always-visible pill tabs.

- Header band: `white` with a 3px `olive` bottom rule. Below about 40rem the site name takes its own row and the tabs sit in one row beneath it.
- Tabs: `ink` text on `white`, pill-shaped, at least 44 px tall on narrow screens. Hover adds a `cream` fill and an underline. Focus uses the global `dark-olive` ring.
- Current page: `aria-current="page"`, a `dark-olive` fill, `white` text and weight 600, so it differs by shape and weight, not only colour. On an ADR page the Decisions tab gets `aria-current="true"` and the same look.
- The nav is a small client component using `usePathname()`, prerendered into the static HTML. No transitions.

## Consequences

- This is the theme ADR 0005's consequence was waiting for. ADR 0005 is not edited. `CLAUDE.md` and the `globals.css` header now point here instead of saying "structure only".
- Adding a colour or a font now needs a new ADR, and a unit test fails if `globals.css` and `TOKENS` drift apart.
- Three new dependencies arrive across the build PRs: `@axe-core/playwright` (dev) and the two fontsource packages. Each PR names its own.
- Most palette colours are not text colours, so the site reads mostly as cream, ink and dark olive, with terracotta for links. If Graham wants more of the palette as text, it needs new darker shades and a new ADR.
- The site stays light. A dark theme needs a dark palette from Graham and a new ADR.
- Revisit the nav if it grows past what fits in one row at 375 px.
