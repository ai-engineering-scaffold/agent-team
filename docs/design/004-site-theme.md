# Design: site theme (spec 004)

Spec: [specs/004-site-theme.md](../../specs/004-site-theme.md) · Issues: #43, #44, #45, #46 · ADR: [0014](../../decisions/0014-site-theme.md), building on [0005](../../decisions/0005-vercel-and-nextjs.md) and [0012](../../decisions/0012-design-input-goes-in-the-spec.md)

## Summary

Graham's palette becomes eight named colour tokens with fixed roles. The tokens live once in `site/lib/theme.ts`, which also exports a WCAG contrast function. `globals.css` declares the same tokens as CSS custom properties, and unit tests keep the two, the ADR table and every stated contrast figure in step. Page-level contrast is checked with `@axe-core/playwright`. Headings use Source Serif 4 and body text uses Inter, self-hosted through `next/font/local`. Tables get a sage header row and right-aligned tabular numbers, and the nav becomes always-visible pill tabs. The work ships in four PRs, in this order: palette (#43), fonts (#44), tables (#45), nav (#46).

## 1. Colour tokens (AC1, AC2)

Only `dark-olive` passes AA for body text on cream, so the palette alone cannot colour body text and links. Two darker shades fill the gap. Each keeps its source colour's hue and saturation and lowers its HSL lightness, which AC1 allows.

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

Rules:

- Body text is `ink`, headings are `dark-olive`. `terracotta`, `olive` and `sage` are never text colours.
- Links are `terracotta-dark` and underlined. Visited links are `dark-olive`. Hover thickens the underline.
- `:focus-visible` is a 2px solid `dark-olive` outline, offset 2px, on every focusable element, including the table scroll regions.
- `::selection` is `ink` on `sage`.
- Borders are `sage` and decorative. The old `color-mix(in srgb, currentColor 20%, transparent)` separators are gone, since AC1 does not allow blended colours.
- `color-scheme: light` and a cream background on `html` and `body`, so a dark system preference still gets the cream page. No `prefers-color-scheme` rules.

### One list, checked four ways

`site/lib/theme.ts` exports `TOKENS` (name, hex, source, role and the contrast figures above), `ALLOWED_COLOURS` (the hex values) and `contrastRatio(a, b)` (WCAG 2.x relative luminance). `site/tests/theme.test.ts` checks that:

- `contrastRatio` gives the known values (21:1 for black on white, 1:1 for a colour on itself) and is symmetric;
- every contrast figure in `TOKENS` matches the computed ratio to one decimal place, and each pair meets the threshold its role needs;
- each shade has its source's hue and saturation, within hex rounding, and a lower lightness;
- the `--colour-*` properties in `globals.css` equal `TOKENS` exactly, and `globals.css` uses no colour outside them;
- the token tables in ADR 0014 and this doc match `TOKENS`.

## 2. Contrast testing (AC2)

| Option | Covers | Cost |
| --- | --- | --- |
| A. Hand-written computed-colour check | Only the pairs we list; misses ancestor fills and new pages | No dependency |
| **B. `@axe-core/playwright` (MPL-2.0, Deque)** | Every text node, real background, large-text threshold | One dev dependency |

**Choice: B**, plus the token-pair unit tests above, which are cheap and document intent.

Playwright tests, added by qa-automation on the #43 PR, visit every route in `site/e2e/pages.ts` (`/`, `/how-we-work`, `/decisions`, `/decisions/0002-six-agent-roles-and-five-gates`, `/metrics`):

- **AC1, computed colours.** Every element's computed `color`, `background-color`, `border-*-color`, `outline-color` and `text-decoration-color` is in `ALLOWED_COLOURS`, ignoring `transparent` and zero-width borders. Repeated with a dark colour scheme emulated, where the body background is still cream.
- **AC1, stylesheet rules.** Every colour in `:visited`, `:hover`, `:focus-visible` and `::selection` rules is in `ALLOWED_COLOURS`, since browsers hide `:visited` from computed style.
- **AC2.** axe's `color-contrast` rule reports no violations, on desktop and mobile.
- **AC2, focus ring.** The first link, reached by Tab, has an outline that is not `none`, at least 2px wide, and at least 3:1 against the page background by `contrastRatio()`.

## 3. Fonts (AC3, #44)

| Option | Build needs network | Preload and fallback metrics | Cost |
| --- | --- | --- | --- |
| A. `next/font/google` | Yes, Google at every build | Yes | Builds fail where Google is unreachable |
| **B. Fontsource variable packages via `next/font/local`** | No, beyond `npm ci` | Yes | Two dependencies |
| C. Fontsource CSS imported directly | No | No | Font swap and layout shift |
| D. Committed woff2 files and `OFL.txt` | No | Yes | Unversioned binaries |

**Choice: B.** Headings use Source Serif 4 and body text uses Inter, both variable fonts under the SIL Open Font License 1.1. Each loads from its package's latin `wght` normal woff2 file and is served from `/_next/static/media/`. Inter's tabular figures serve the numeric table columns. Code stays on the system monospace stack. If `next/font/local` cannot resolve into `node_modules`, #44 falls back to D with the same two files.

## 4. Tables (AC5, AC6, AC7, #45)

- Header row: `sage` fill, `ink` text, weight 600 (5.6:1).
- Body rows: `white`, `ink` text, 1px `sage` bottom separator. Row header cells use body weight.
- Numeric columns have a `num` class on `th` and `td`: right-aligned, `tabular-nums`. "Spend by spec": Spend, Budget, Runs, Runs with no cost. "Runs by week": Runs, Spend, Runs not successful. All other columns stay left-aligned.
- Over-budget rows: an `over-budget` class from the same `budgetStatus(row)` result that prints "Over budget"; `cream` background, a 4px `terracotta` left border on the first cell (3.3:1 on cream), and the status in `terracotta-dark` at weight 600 (5.2:1 on cream).
- Every table, including ADR Markdown tables via a `renderAdrBody()` helper, sits in a focusable `.table-scroll` region with a label, so wide tables scroll inside their own box at 375 px.

## 5. Navigation (AC4, AC5, #46)

| Option | Hides links on a phone | Changes existing tests | Cost |
| --- | --- | --- | --- |
| A. Menu button below a breakpoint | Yes | Yes, an open-menu step on mobile | Client state and a disclosure widget |
| **B. Always-visible pill tabs** | No | No | A second header row on narrow screens |

**Choice: B.** Three short links fit in one row at 375 px.

- Header band: `white` with a 3px `olive` bottom rule. Below about 40rem the site name takes its own row.
- Tabs: `ink` on `white`, pill-shaped, at least 44 px tall on narrow screens. Hover adds a `cream` fill and an underline.
- Current page: `aria-current="page"`, `dark-olive` fill, `white` text (7.3:1), weight 600. On an ADR page the Decisions tab gets `aria-current="true"` and the same look.
- A small `"use client"` component reads `usePathname()`; a pure `navState(pathname, href)` decides `page`, `section` or `none` and is unit-tested.

## 6. What changes outside the site

`CLAUDE.md` and the `globals.css` header stop saying "structure only" and point at ADR 0014. ADR 0005's consequence ("unstyled until Graham provides a design theme") is now met; ADR 0005 itself is not edited.
