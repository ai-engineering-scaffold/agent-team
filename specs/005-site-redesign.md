---
spec: 005
title: Site redesign
status: approved
budget_usd: 25
owner: Graham
---

## Problem

Spec 004 gave the site a theme, but Graham doesn't like the result. The spacing is uneven, dates show as raw ISO strings, table text wraps into tall rows, statuses are plain words, and on a phone the tables either scroll sideways or get cut off. The site is the org's public portfolio, so it should look like the work of a careful engineering team: clean, technical and exact, in the way github.com is.

## Users and stories

- As a visitor, I want a site that looks polished and technical, so that I trust the engineering behind it.
- As a visitor, I want a way to contact the org from any page, so that I can reach Graham.
- As a visitor, I want dates, statuses and numbers I can read at a glance, so that I can scan the decision log and metrics quickly.
- As a visitor on a phone, I want to see every table's content without scrolling sideways, so that the site works where I read it.

## Acceptance criteria

- **AC1.** Given any page, when it loads, then every colour and font it uses is a token listed in the new theme ADR, which supersedes ADR 0014's palette and fonts. This includes link, visited, hover, focus and selection colours, which may be checked from stylesheet rules because browsers hide `:visited` from computed style. The page keeps its light theme when the system prefers a dark colour scheme. Every font is free for commercial use, and the ADR names its licence. Headings, body text and the monospace accent use web fonts served from this site, with no request to a third-party font host. A system font stack alone does not meet this.
- **AC2.** Given any page, on desktop and at 375 px, when an automated contrast check runs, then it finds no WCAG AA violations: 4.5:1 for body text, and 3:1 for large text, badges' borders and fills where they carry meaning, and UI controls.
- **AC3.** Given any page, when it renders, then every margin, padding and gap on the header, main content, headings, paragraphs, lists, tables and badges is a value from the ADR's spacing scale, or `0`, or `auto` where it centres a block. Spacing may be checked from stylesheet rules, since computed style reports `auto` as pixels. The main content has a maximum width and centres on wide screens. At 375 px it has side gutters of at least 16 px.
- **AC4.** Given a date anywhere on the site (the decisions index, an ADR page, the metrics "Newest run included" line, and the "Week starting" column), when it renders, then it reads like `Oct 23, 2026`, with a time added as `Oct 23, 2026, 10:00 UTC` where the source has one. On an ADR page this covers the `date` field shown in its details. It sits in a `<time>` element whose `datetime` holds the original ISO value. No raw `YYYY-MM-DD` or ISO timestamp text is visible in those places. Dates inside an ADR's own prose are left as written.
- **AC5.** Given an ADR status (proposed, accepted, superseded, rejected) or a budget status ("Within budget", "Over budget"), when it renders in a table or on an ADR page, then it shows as a badge: a pill with its own fill or border that still contains the word, so the status never depends on colour alone. Each status has one badge style, used everywhere that status appears.
- **AC6.** Given a table on any page (the two metrics tables, the decisions index, and Markdown tables in rendered ADRs such as ADR 0002), when it renders, then the header row is set apart from the body rows, and rows have separators or alternating fills. Numeric columns (Spend, Budget, Runs, Runs with no cost, Runs not successful) are right-aligned with tabular figures, and date, identifier and other text columns are left-aligned. At 1280 px, no header cell wraps in the decisions index or the metrics tables, and no date, number, identifier or badge cell wraps. Only free-text columns (Decision, Title) may wrap.
- **AC7.** Given a 375 px wide viewport, when any page with a table loads (the decisions index, the metrics page and ADR 0002), then neither the page nor any table scrolls sideways (`scrollWidth <= clientWidth` for the document and for every table and its container), every cell's full text is visible with nothing clipped or hidden, and each cell's value is shown next to its column's name. Tables keep their `table`, `row`, `columnheader`, `rowheader` and `cell` roles, so a phone layout that reflows rows into cards still exposes them as a table. Column labels added for the phone layout don't change any row's or cell's accessible name. For example, they can be `aria-hidden` elements rather than CSS generated content, which browsers include in accessible names. No horizontal scroll bar or scroll shadow appears.
- **AC8.** Given the main navigation, when a visitor uses it on desktop or at 375 px, then the current page is marked with `aria-current="page"` and looks different by more than colour, and every link has visible hover and keyboard-focus states.
- **AC9.** Given any page, when it loads, then a footer (a `contentinfo` landmark) shows "© YYYY AI Engineering Scaffold", where YYYY is the year the site was built, and a "Contact us" link whose `href` is `mailto:schill1025@gmail.com`. The footer follows the same spacing scale and stays on one or two lines at 375 px.
- **AC10.** Given the existing Playwright and unit test suites, when they run after this change, then every test passes. The tests listed here assert spec 004's look, and they may be rewritten to this spec's tokens and styles, testing the same concern with assertions at least as strict: in `theme.spec.ts`, the AC1 tests and the AC3 font test; in `tables.spec.ts`, every test whose title starts with spec 004's "AC6:" or "AC7:", and "AC2: the over-budget row marker meets 3:1 against the row background"; and in `nav.spec.ts`, "AC4: on … only the … tab is the current page, and it looks different", "AC4: on an ADR page the Decisions tab is marked as the current section", "AC4: the current tab keeps its fill and weight when hovered" and "AC4: keyboard focus gives every tab a visible outline of at least 2px and 3:1". In `metrics.spec.ts`, the tests that check date text may be rewritten for AC4: "AC6: states the newest run's date and time in UTC", "AC4: Runs by week lists 8 weeks, newest first, starting 2026-10-19", "AC4: every Runs by week row shows its runs, spend and not-successful counts", "AC4: the empty week 2026-10-05 shows zeros" and "AC4: a week with a run that was not a success counts it". The rewrites check the formatted text, check each `<time>` element's `datetime` against the fixture's ISO values, and check newest-first order on the `datetime` values. In `site/tests/`, the tests in `theme.test.ts` and `fonts.test.ts` that pin spec 004's tokens, fonts, font packages or monospace stack, and the `metrics.test.ts` test "AC6: the newest run is shown as a UTC date and time", may be rewritten to the new ADR's tokens, fonts and date format. The colour-token table test then checks the new ADR and design doc instead of ADR 0014. The over-budget row tests may instead move to the Over budget badge (AC5). Every other test is unchanged, except where it located something by text this spec changed on purpose. No assertion is removed or loosened.

## Design input

Graham, 2026-10-23:

- "A clean beautiful design that exudes professionalism and tech and attention to detail." Use the github.com website as the example.
- Changing the colour scheme is fine. The spec 004 palette does not need to survive.
- The spacing needs work throughout the site.
- Dates should be formatted, not raw. Common statuses should be badges.
- Tables need better spacing, so there isn't so much text wrapping. They should not be cut off on mobile or show horizontal scroll indicators.
- "Be creative!" The tech lead has room to choose the details: type scale, a monospace accent for identifiers such as ADR numbers and dollar amounts, subtle borders and surfaces, how tables reflow on a phone, and small touches that show care. All of it stays within the criteria above.
- Add a site footer with this year's copyright, the name "AI Engineering Scaffold", and a "Contact us" link that opens an email to schill1025@gmail.com (Graham, 2026-10-23).
- The build PR updates the theme line in `CLAUDE.md` ("Visual design follows the theme in ADR 0014") and the `site/app/globals.css` header to name the new theme ADR. That ADR supersedes ADR 0014's palette and fonts without editing it.
- Build it as one issue, so the redesign lands in one PR.

## Non-goals

- New pages or copy changes, other than the footer (AC9) and labels a reflowed table or badge needs.
- A dark mode. A theme that follows the system's dark preference could be a later spec.
- Charts, illustrations, a logo, or animation beyond short hover and focus transitions.
- Changes to the pipeline, the ledger or how pages get their data.

## Success metric

After the build PR merges, Graham looks at every page on a laptop and a phone and is happy to share the site as his portfolio.

## Open questions

- None. Graham left the visual details to the tech lead within the design input above.
