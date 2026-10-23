---
title: Criteria without a page are tested by unit tests
status: proposed
date: 2026-10-23
decided_by: Proposed by tech-lead agent, approved by Graham
---

## Context

The definition of done in `CLAUDE.md` says every acceptance criterion has a Playwright test in `site/e2e/`. Spec 002's criteria describe workflow behaviour and a data loader, with no page to load. Graham approved checking them with unit tests on 2026-10-23, when he approved the spec.

## Options considered

1. **Keep the rule and write Playwright tests anyway.** The tests would load a page that doesn't show the behaviour, so they would prove nothing.
2. **Unit tests for criteria that have no page.** Vitest tests in `site/tests/`, named after the criterion, against fixtures. The spec must say for each criterion how it is checked.

## Decision

Option 2. A criterion with no page is checked by a unit test named after it. A criterion that shows on a page still needs a Playwright test. The spec says which applies to each criterion, and the reviewer checks it.

Proposed wording for the definition of done in `CLAUDE.md`, for Graham to apply:

> Every acceptance criterion the change covers has a test named after the criterion: a Playwright test in `site/e2e/` when it shows on a page, otherwise a unit test in `site/tests/` (ADR 0011).

## Consequences

- Workflow behaviour itself (that the record job runs) is not tested end to end. The success metric in spec 002 checks it by hand against Actions logs.
- QA writes Vitest tests for these criteria instead of Playwright tests.
