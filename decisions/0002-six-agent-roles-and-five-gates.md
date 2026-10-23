---
title: Six agent roles and five review gates
status: accepted
date: 2026-10-22
decided_by: Graham
---

## Context

An org of agents needs the same things a human team needs: clear ownership, handoffs that leave a record, and review by someone other than the author.

## Decision

**Roles**, each a Claude Code subagent in `plugin/agents/`:

| Role | Owns |
| --- | --- |
| Spec writer | Turning a brief into a testable spec |
| Tech lead | Design docs, ADRs, slicing work into one-PR issues |
| Engineer | Implementing one issue with unit tests |
| Code reviewer | An independent review, never in the author's context |
| QA automation | Playwright tests written from the spec's acceptance criteria |
| Scribe | The decision log, changelog and weekly metrics post |

**Gates**, in order:

1. **Spec.** Graham approves the spec.
2. **Design.** Graham approves the design, only when the tech lead flags `design-needed`.
3. **CI.** Lint, types, unit tests, build and Playwright pass as required checks.
4. **Review.** The reviewer agent finds no blocking issues.
5. **Merge.** Graham merges, except for low-risk changes (ADR 0006).

Work moves through GitHub (merged specs, labelled issues, PRs), never through chat, so every handoff is public and timestamped.

## Consequences

- QA writes tests from the spec rather than the code, so tests check intent.
- Security, release and eval-steward roles are deferred until the loop is stable.
