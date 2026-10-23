---
name: e2e-from-spec
description: How to turn a spec's acceptance criteria into Playwright tests. Use when writing end-to-end tests for a spec.
---

# Playwright tests from a spec

## Map criteria to tests

Make a table first, in the PR description:

| Criterion | Test | Notes |
| --- | --- | --- |
| AC1 | `AC1: shows the newest decision first` | |

Every criterion gets at least one test. A criterion that cannot be tested in the browser goes back to the spec writer.

## Write the tests

- File: `site/e2e/spec-NNN-short-name.spec.ts`
- Name each test after its criterion: `test("AC1: ...", ...)`
- Locate by role and visible text: `page.getByRole("link", { name: "Decisions" })`. Never by CSS class or test id unless there is no accessible name, and then fix the accessibility first.
- Assert what a user sees, not implementation details.
- Each test starts from a URL and stands alone; no test depends on another's state.

## Run them

```bash
npm --prefix site run test:e2e
```

CI runs the same suite on every PR. A test that fails because the product is wrong stays failing; report it on the PR.
