---
spec: 002
title: Cost and cycle-time ledger
status: draft
budget_usd: 15
owner: Graham
---

## Problem

The README promises weekly numbers on shipping speed, defect rate and AI spend per feature, and every spec has a `budget_usd`. Nothing records what an agent run costs or how long it takes, so no one can tell whether spec 001 stayed within its $15, and the scribe's weekly post has no data to report.

## Users and stories

- As Graham, I want every agent run's cost and duration recorded against its spec, so that I can see whether a feature stayed within its budget.
- As a visitor, I want the org's spend numbers to come from a record in the repo, so that I can trust the weekly metrics.
- As the scribe agent, I want one place to read the week's runs from, so that the metrics post reports real numbers.

## Acceptance criteria

- **AC1.** Given an agent run in any workflow (plan, build, review or fix), when the run ends, then the ledger gains one record with: date, workflow, spec, issue and PR (where they apply), cost in API-equivalent dollars, turns, duration and outcome.
- **AC2.** Given an agent run that fails, times out or is cancelled after the agent started, when the run ends, then it is still recorded, with an outcome that says which.
- **AC3.** Given a record, when anyone reads it, then it holds only the AC1 fields: no prompt, transcript, token or secret.
- **AC4.** Given the ledger, when the site is built, then a loader in `site/lib/` returns every record and each spec's total spend and run count. Checked by a unit test against a fixture ledger.
- **AC5.** Given a build PR, when the agent review posts its comment, then the comment shows the spec's spend so far against its `budget_usd`.
- **AC6.** Given a spec whose recorded spend passes its `budget_usd`, when the next agent run for it is recorded, then its open PR (or, with none, its lowest open issue) gets an `over-budget` label, and the pipeline keeps building.

## Non-goals

- The metrics page and the scribe's weekly post. They are the next spec and read this ledger.
- Backfilling spec 001's runs, unless the tech lead finds it cheap (see open questions).
- Stopping work when a spec goes over budget. The label flags it, and Graham decides.
- Real billing totals. Runs use Graham's subscription (ADR 0007), so dollars are API-equivalent.

## Success metric

The first spec built after this ships has a recorded total that matches the sum of its runs' Actions logs, within a cent.

## Open questions

- For the tech lead: where the ledger lives. Main only takes changes through PRs, so a workflow can't append to a file there. Options include a dedicated `metrics` branch, a weekly PR that adds the week's records, or Actions artifacts collected by a weekly job. This needs a design (gate 2).
- Can spec 001's runs be backfilled from Actions logs, or have they expired?
- Recording happens in `.github/workflows/`, which agents may not edit. The build will need Graham to apply or approve the workflow parts.
