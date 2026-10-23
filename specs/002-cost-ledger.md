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

The ledger is built in workflows, so most criteria are checked by unit tests in `site/tests/` against fixture files, not by Playwright. Each says how it is checked.

- **AC1.** Given an agent run, when it ends, then the ledger gains one record with exactly these fields: `date` (the run's start, ISO 8601 UTC), `workflow` (`plan` for the plan job in `agent-pipeline.yml`, `build` for `agent-build.yml`, `review` for `agent-review.yml`, `fix` for `agent-fix.yml`), `spec`, `issue`, `pr`, `cost_usd` (API-equivalent), `turns`, `duration_s` (the agent step) and `outcome`. `spec` comes from the plan job's spec number, from the `spec-NNN/` prefix of the PR's branch, or from the issue's `spec-NNN` label; anything else is `none`. `issue` and `pr` are `null` when they don't apply. Checked by a unit test of the record builder against fixture outputs, including one per `spec` source.
- **AC2.** Given any run, when it is recorded, then `outcome` is exactly one of `success`, `error`, `max_turns`, `timeout` or `cancelled`. A run that times out or is cancelled after the agent started is still recorded; this is common, since every push cancels a running review. When the agent reported no result, `cost_usd` and `turns` are `null` and `duration_s` is the time until the run stopped. Checked by the same unit test with a fixture for each outcome.
- **AC3.** Given a record, when it is validated, then it has exactly the AC1 fields: no prompt text, transcript, token counts or credentials. Checked by a schema test that rejects any extra field.
- **AC4.** Given the ledger, when the site is built, then a loader in `site/lib/` returns every record and, per spec (with `none` as its own group), the total cost, the run count and the number of runs with no cost. Checked by a unit test against a fixture ledger.
- **AC5.** Given a build PR, when the agent review posts its comment, then the comment includes a line with the spec's spend so far (excluding the current review run) against its `budget_usd`, and the count of runs with no cost. A chore PR (spec `none`) shows its total with no budget. Checked by a unit test of the line formatter; putting the line into the comment is a workflow change for Graham.
- **AC6.** Given a run is recorded, when its spec's total then exceeds `budget_usd`, then every open PR on a `spec-NNN/` branch for that spec gets the `over-budget` label (created if missing). With no open PR, the lowest-numbered open issue labelled `spec-NNN` gets it. With neither, nothing is labelled and the job log says so. The `none` group is never labelled. Labelling can't fail the job, so the pipeline keeps building. Checked by a unit test of the label-target function with a fixture for each case.

None of these criteria has a page, so none has a Playwright test. That departs from the definition of done in `CLAUDE.md`, so it needs Graham's approval and an ADR before the build starts (see open questions).

## Non-goals

- The metrics page and the scribe's weekly post. They are the next spec and read this ledger.
- Recording spec-writer runs. Specs are written in Claude sessions, not workflows, so spec totals cover planning, building, review and fixes only.
- Backfilling spec 001's runs, unless the tech lead finds it cheap (see open questions).
- Stopping work when a spec goes over budget. The label flags it, and Graham decides.
- Real billing totals. Runs use Graham's subscription (ADR 0007), so dollars are API-equivalent.

## Success metric

For the first spec built after this ships, the ledger's total over runs that have a cost matches the sum of those runs' Actions logs, within a cent.

## Open questions

- For Graham: approve unit tests, not Playwright, for criteria that have no page. The tech lead records it in an ADR at gate 2, with a proposed wording change to the definition of done.
- For the tech lead: where the ledger lives. Main only takes changes through PRs, so a workflow can't append to a file there, and the static site build must still be able to read it (AC4). Options include a dedicated `metrics` branch or a weekly PR that adds the week's records to `metrics/` (a low-risk path). This needs a design (gate 2).
- For the tech lead: a step inside a job that times out or is cancelled may not run, so AC2 may need recording in a separate job that runs after the agent's job.
- Can spec 001's runs be backfilled from Actions logs, or have they expired?
- Recording happens in `.github/workflows/`, which agents may not edit. The build will need Graham to apply or approve the workflow parts.
