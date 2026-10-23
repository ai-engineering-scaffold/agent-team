---
spec: 004
title: Site theme
status: approved
budget_usd: 20
owner: Graham
---

## Problem

The site has been structure-only while it waited for Graham's theme: browser-default fonts, a nav of plain links and bare tables. Visitors, including hiring managers, judge a portfolio in seconds, and today it reads as unfinished. Graham has now given the theme's direction: his palette, a better global nav, and restyled tables and fonts.

## Users and stories

- As a visitor, I want a clean, professional site, so that I take the org's work seriously.
- As a visitor, I want a nav that clearly shows where I am and is easy to use on a phone, so that I can move between pages without hunting for links.
- As a visitor, I want tables I can scan quickly, so that I can read the metrics without effort.

## Acceptance criteria

- **AC1.** Given any page, when it loads, then its colours, including link, visited and focus colours, come only from Graham's palette (below), plus white and any darker shades of palette colours that the theme ADR lists as tokens. The page background is the cream `#E8E1CF` or white, including when the visitor's system prefers a dark colour scheme.
- **AC2.** Given any page, when an automated contrast check runs, then body text meets WCAG AA (4.5:1) and large text and UI controls meet 3:1. If a palette colour fails as text on its background, it is used only where it passes, for example as a border or fill.
- **AC3.** Given any page, when it loads, then headings and body text use web fonts served from this site, with no request to a third-party font host at runtime. Once the page has loaded, `document.fonts.check()` is true for the heading and body fonts. The fonts are free and licensed for commercial use.
- **AC4.** Given any page, when a visitor looks at the main navigation, then the link to the current page is marked with `aria-current="page"` and looks different from the other links, by a shape or weight change and not only by colour. Every nav link has visible hover and keyboard-focus states.
- **AC5.** Given a 375 px wide viewport, when a page loads, then every nav link can be reached and the page itself does not scroll horizontally (`document.documentElement.scrollWidth <= clientWidth`). A wide table may scroll inside its own container. If the links sit behind a menu button, that button has the accessible name "Menu", reports whether it is open, and works with the keyboard.
- **AC6.** Given a table on any page (the two metrics tables, the decisions index table, and Markdown tables in rendered decisions such as ADR 0002), when it renders, then the header row is set apart from the body rows, rows have separators or alternating fills, and numeric columns (Spend, Budget, Runs, Runs with no cost, Runs not successful) are right-aligned with tabular figures. Dates, identifiers and other text columns stay left-aligned.
- **AC7.** Given a "Spend by spec" row that is "Over budget", when it renders, then its background or border differs from the other body rows, and it still shows the words "Over budget", so the status doesn't depend on colour alone.
- **AC8.** Given the existing Playwright suite, when it runs after this change, then every test still passes, with each test unchanged except where it located something by text this spec changed on purpose, and no assertion is removed or loosened.

## Design input

Graham, 2026-10-23:

- Palette: `#7A8B5A` (olive), `#B9B08C` (sage), `#E8E1CF` (cream), `#4F5B3A` (dark olive), `#A86B4C` (terracotta).
- "Very clean styles and an appealing professional look."
- Make the global nav a lot better than plain hyperlinks. Update the tables and fonts to match the same design ideas.

### Palette contrast notes (spec writer)

Measured against the cream background, only the dark olive `#4F5B3A` passes AA for body text (5.6:1). The terracotta reaches 3.3:1, so it works for large text, borders and fills, not body text. On white it reaches 4.3:1, still short of AA for body text. Olive `#7A8B5A` is 2.8:1 on cream, below the 3:1 a focus ring or active-link marker needs there (3.7:1 on white). Sage `#B9B08C` is 1.7:1 on cream, so it is a fill only, and dark olive text on a sage fill is 3.3:1, too low for table body text. The tech lead assigns colour roles within AC1 and AC2, picks the fonts within AC3, and records both in an ADR.

`CLAUDE.md` says "Do not add visual design until Graham provides the theme", and the `globals.css` header says the same. This spec is that theme, so the first build PR updates both lines, and the theme ADR records the change with a reference to ADR 0005.

## Non-goals

- Dark mode. The palette is a light theme, so the site stays light (AC1) until a dark palette is given.
- New pages, content or copy changes, other than small layout text such as a menu button label.
- Charts, illustrations, a logo or animation beyond simple hover and focus transitions.

## Success metric

Graham looks at the production site on a laptop and a phone, after the last build PR merges, and finds no page that still looks unstyled.

## Open questions

- For Graham (design input): do you have a font in mind, or a feel to aim for, such as a classic serif for headings or an all-sans look? If not, the tech lead picks within AC3.
- For the tech lead: how to test AC2. An axe-based check adds a dev dependency, and the PR must name it. A computed-colour check needs no new dependency but only covers the elements it names.
