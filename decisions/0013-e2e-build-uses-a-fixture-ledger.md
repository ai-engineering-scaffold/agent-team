---
title: The e2e build copies a fixture ledger when the fetch is skipped
status: proposed
date: 2026-10-23
decided_by: Proposed by tech-lead agent, approved by Graham
---

## Context

Spec 003's metrics page is built from the cost ledger, and its Playwright tests must run against a fixed fixture ledger, never live `metrics` data. CI's `site` and `e2e` jobs set `LEDGER_SKIP_FETCH=1` and run a plain `npm run build`, agents may not edit `.github/workflows/`, and the production build on Vercel must keep reading the live branch. A static build also holds only one ledger, so it can show only one of the page's states (unavailable, empty, or with runs).

## Options considered

1. **`prebuild` copies a committed fixture when `LEDGER_SKIP_FETCH=1`.** Works with CI as it is today. Costs: "skip fetch" now means "use the fixture", and one build shows one ledger state.
2. **A `LEDGER_DIR` override that the e2e job sets.** Keeps the fixture out of `prebuild`, but needs a workflow change only Graham can make, so the work would wait on it.
3. **Playwright builds one site per fixture** (a `webServer` array, each a separate `next build` with its own `distDir`). Covers every state in Playwright, but triples e2e build time and adds `distDir` handling the site doesn't have.

## Decision

Option 1. With `LEDGER_SKIP_FETCH=1`, `scripts/ledger/fetch.mjs` copies `site/e2e/fixtures/ledger/ledger/` into `site/.ledger/ledger/` and logs that it did. When `VERCEL=1` it never copies the fixture and leaves no ledger, so a misconfigured production build shows "unavailable", never fixture numbers.

Page states one static build can't show are checked by Vitest tests named after the criterion, against a pure function the page switches on (`metricsPageState` in `site/lib/metrics.ts`), with the page's messages exported so the page and the tests share one string. This extends ADR 0011 from "criteria without a page" to "page states a single static build can't show". The state the fixture build does show is checked in Playwright.

## Consequences

- No workflow change, secret or new dependency.
- Every Playwright test sees the same ledger, so the fixture must cover every case the spec 003 tables need. Changing a record means changing the tests that rely on it; `site/e2e/fixtures/ledger/README.txt` lists what each record is for.
- The unavailable and empty states are not tested in a browser. A bug in how the page renders them, rather than in choosing them, would get past the unit tests. If that happens, revisit option 3.
- A Vercel preview reads live data, so the metrics Playwright tests must keep running against the local fixture build, not `BASE_URL`.
