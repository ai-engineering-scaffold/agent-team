---
spec: 001
title: How we work page
status: approved
budget_usd: 15
owner: Graham
---

## Problem

A visitor to the site can read individual decisions, but nothing shows how the org runs end to end: who the agents are, what each one owns, and which gates a change passes before it ships. Today they have to piece that together from ADRs and the `plugin/` folder, which most visitors will never open.

## Users and stories

- As a visitor, I want one page that lists the agent roles and the review gates, so that I understand how a change gets from idea to production.
- As Graham, I want the roles on that page to come from the agent definitions in the repo, so that the page can never drift from what actually runs.

## Acceptance criteria

- **AC1.** Given the built site, when a visitor opens `/how-we-work`, then the page shows a level-one heading "How we work".
- **AC2.** Given the agent definitions in `plugin/agents/`, when the page is built, then it lists one entry per agent file, showing the role's name (the frontmatter `name` in sentence case, for example "Code reviewer"), its description and the model it runs on, all read from that file's frontmatter.
- **AC3.** Given an agent file is added to or removed from `plugin/agents/`, when the site is rebuilt, then the list of roles changes to match without any other code change. Checked by a unit test that runs the role loader against a fixture folder, and by the AC2 Playwright test comparing the number of entries with the number of files in `plugin/agents/`.
- **AC4.** Given the page, when a visitor reads the gates section, then it lists the gates in order (Spec, CI, Review, Merge), each with who or what must approve it. Amended 2026-10-23: ADR 0012 removed the Design gate.
- **AC5.** Given the gates section, when a visitor follows a gate's links, then each gate links to ADR 0002, and the Merge gate also links to ADR 0006.
- **AC6.** Given any page on the site, when a visitor uses the main navigation, then a "How we work" link takes them to `/how-we-work`.
- **AC7.** Given a 375 px wide viewport, when the page loads, then all roles and gates are readable without horizontal scrolling.

## Non-goals

- Visual design. The site stays structure-only until Graham provides the theme.
- Live pipeline status (open PRs, check results) or metrics. Metrics are a separate spec.
- Showing each role's tool permissions.

## Success metric

The page ships through every gate of the pipeline it describes (spec, issues, engineer, QA, CI, agent review, merge), with each gate visible on its PR, within the $15 budget.

## Open questions

- Should the gate list also come from a file in the repo (for example a `docs/` page), or is it fine for the page to state the five gates in code since they change only by ADR?
- Should the page show which roles are deferred (security, release, eval steward, per ADR 0002)?
- For the tech lead: the build reads `plugin/agents/` from outside `site/`. The decision log already does the same with `decisions/`, so this depends on Vercel including files outside the root directory, which is its default. Confirm this once Vercel deploys succeed.
