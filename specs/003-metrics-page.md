---
spec: 003
title: Metrics page
status: approved
budget_usd: 15
owner: Graham
---

## Problem

The README promises public numbers on AI spend, shipping speed and defect rate per feature. Since spec 002, every agent run is recorded on the `metrics` branch, but the only place a number shows up is a line in each review comment. A visitor can't see what a feature cost, and Graham can't see at a glance whether specs stay within budget.

## Users and stories

- As a visitor, I want one page that shows what each feature cost against its budget, so that I can judge how efficiently an AI-native org ships.
- As Graham, I want to see spend per spec and per week, so that I notice a spec going over budget, or a week of failed runs, without reading Actions logs.
- As a visitor, I want to know how current the numbers are and where they come from, so that I can trust them.

## Acceptance criteria

Numbers come from the spec 002 loader (`loadLedger()` in `site/lib/ledger/load.ts`) and from each spec's frontmatter. Playwright runs against a production build made from a fixture ledger, never live `metrics` data.

- **AC1.** Given the built site, when a visitor opens `/metrics`, then the page shows a level-one heading "Metrics", and the main navigation on every page has a "Metrics" link to it.
- **AC2.** Given a ledger with runs, when the page is built, then a "Spend by spec" table has one row per spec file in `specs/`, in spec order, then one row "Unknown spec NNN" (no budget) for each spec number in the ledger with no spec file, so no spend drops out of the page, then a last row "Chores" for spec `none`, shown even with no chore runs. Each row shows the spec number and title (from frontmatter), spend in US dollars to the cent, `budget_usd`, the number of runs, and the number of runs with no cost. Chores show no budget.
- **AC3.** Given a spec whose spend is over its `budget_usd`, when the page is built, then its row says "Over budget". A spec, or Chores, with no recorded runs shows "Not recorded" instead of $0.00, which is how spec 001 appears.
- **AC4.** Given a ledger with runs, when the page is built, then a "Runs by week" table lists the 8 weeks ending with the week of the newest run (weeks start Monday, UTC), newest first, so a fixed ledger always gives the same table. Each row shows the week's start date as `YYYY-MM-DD`, the number of runs, spend, and the number of runs whose outcome was not `success`. A week with no runs shows zeros.
- **AC5.** Given the ledger could not be read at build time (`available: false`), when a visitor opens the page, then it says "Spend data is unavailable for this build." and shows neither table, so a failed download never reads as $0. Given an empty ledger, the page says "No agent runs recorded yet." and shows neither table.
- **AC6.** Given the page, when a visitor reads it, then it states the date and time (UTC) of the newest run included (left out in both AC5 cases), says that dollars are API-equivalent on a subscription (ADR 0007), and links to ADR 0010 for where the data lives.
- **AC7.** Given a 375 px wide viewport, when the page loads, then both tables are readable without horizontal page scrolling.

## Design input

- None given yet. Graham's answers to the open questions below go here. If the spec merges without an answer on freshness, the page updates on every merge to main, which needs no new pieces.

## Non-goals

- Shipping speed and defect rate. Neither has a definition or a data source yet (see open questions); they get their own spec once Graham picks the definitions.
- The scribe's weekly post. It reads the same numbers and is a separate spec.
- Charts or visual design. The site stays structure-only until Graham provides the theme.
- Per-run detail, links to Actions logs, or anything from a run beyond the ledger's fields.

## Success metric

After this ships, the "Spend by spec" total for spec 003 itself matches the sum of its runs' Actions logs within a cent, and the page is live on the production site within one merge of the last build PR.

## Open questions

- For Graham (design input): how fresh must the page be? The site is static and Vercel rebuilds only on a merge to main, so runs recorded after the last merge don't show until the next one. "Updated on every merge" needs no new pieces. A daily rebuild needs a Vercel deploy hook, a repository secret and a scheduled workflow.
- For Graham (design input): which definitions do you want for shipping speed and defect rate, for the follow-up spec? Candidates: spec merge to last build PR merge (speed), and the share of build PRs the reviewer sent back, or bugs found after merge (defects).
- For the tech lead: how Playwright gets a fixture ledger. CI sets `LEDGER_SKIP_FETCH=1`, so the e2e build needs a fixture copied into `site/.ledger/` or a loader directory override, without changing what the production build reads. `specs/` grows with every spec, so the AC2 tests check specific rows rather than counting them.
