# Design: metrics page (spec 003)

Spec: [specs/003-metrics-page.md](../../specs/003-metrics-page.md) · Issue: #34 · ADRs: [0013](../../decisions/0013-e2e-build-uses-a-fixture-ledger.md), building on [0007](../../decisions/0007-track-cost-on-the-claude-subscription.md), [0010](../../decisions/0010-cost-ledger-lives-on-a-metrics-branch.md) and [0011](../../decisions/0011-unit-tests-for-criteria-without-a-page.md)

## Summary

`/metrics` is a static page that reads `loadLedger()` (spec 002) at build time. A pure function, `metricsPageState(ledger)` in `site/lib/metrics.ts`, decides what the page shows: `unavailable`, `empty`, or `ready` with the newest run's timestamp. The page is a thin switch on that result. The "Spend by spec" and "Runs by week" tables come in the next two issues and read the same ledger.

## 1. Freshness

The spec's design input is empty, so the page follows the spec's default: it updates on every merge to main, when Vercel rebuilds the site. There is no deploy hook, secret or scheduled workflow. The page says when its newest run was, so a reader can see how current it is.

## 2. How Playwright gets a fixture ledger

| Option | Works with CI today | Production stays on live data | Cost |
| --- | --- | --- | --- |
| **A. `prebuild` copies a fixture when `LEDGER_SKIP_FETCH=1`** | Yes | Yes, with a `VERCEL=1` guard | One ledger state per build |
| B. `LEDGER_DIR` override set by the e2e job | No: needs a workflow change by Graham | Yes | Waits on Graham |
| C. Playwright builds one site per fixture | Yes | Yes | Triple the e2e build time; `distDir` handling |

**Choice: A** ([ADR 0013](../../decisions/0013-e2e-build-uses-a-fixture-ledger.md)).

- `scripts/ledger/fetch.mjs`, run by `prebuild`, copies `site/e2e/fixtures/ledger/ledger/` to `site/.ledger/ledger/` when `LEDGER_SKIP_FETCH=1`, checks the copy with the same symlink and size checks as a download, logs `ledger: LEDGER_SKIP_FETCH=1, so the e2e fixture ledger was copied`, and returns `"fixture"`. If the copy fails it leaves no ledger, so the page says the data is unavailable.
- **Vercel guard.** Vercel sets `VERCEL=1` on every build. There, `LEDGER_SKIP_FETCH=1` keeps the old behaviour: no ledger, so `available: false`. A misconfigured production build shows "unavailable", never fixture numbers.
- **Fixture content.** Thirteen valid spec 002 records with fixed dates, chosen to serve all three build issues: no runs for spec 001, spec 002 over its $15 budget with one `cost_usd: null` run, spec 003 under budget, spec 999 with no spec file, two chores (one ending in `error`), eight weeks ending with the week of 2026-10-19 with one empty week, one run older than those eight weeks, and the newest run at `2026-10-21T14:05:00Z`. `site/e2e/fixtures/ledger/README.txt` lists every case and the totals it should produce, and a Vitest test checks the per-spec totals.
- Playwright's config lets CI point `BASE_URL` at a Vercel preview, which reads live data. The metrics tests must run against the local fixture build, which is the default (`checks.yml` does not set `BASE_URL`).

## 3. Testing the states a build can't show

One build holds one ledger, and the fixture build is in the `ready` state. The other two states, and AC6's rule that the freshness line is left out in them, are checked by Vitest tests named after the criterion (`site/tests/metrics.test.ts`) against `metricsPageState`. The page and the tests import the same message constants (`UNAVAILABLE_MESSAGE`, `EMPTY_MESSAGE`), so the words tested are the words shown. The `ready` state, the heading, the nav link and the provenance links are checked in Playwright against the fixture build.

| Criterion | How it's checked |
| --- | --- |
| AC1 | Playwright, fixture build |
| AC5 (unavailable, empty) | Vitest, `metricsPageState` |
| AC6, freshness left out in AC5 states | Vitest, `metricsPageState` |
| AC6, newest run time, ADR 0007 and ADR 0010 | Playwright, fixture build |

## 4. Page content

- A level-one heading "Metrics", and a "Metrics" link in the main navigation.
- `unavailable`: "Spend data is unavailable for this build." `empty`: "No agent runs recorded yet." Neither shows a table or the freshness line.
- `ready`: "Newest run included: 2026-10-21 14:05 UTC", always formatted in UTC whatever the build machine's time zone.
- In every state: dollars are API-equivalent costs on a Claude subscription (ADR 0007), and the data lives in the ledger on the `metrics` branch (ADR 0010). These help a reader most when the data is missing, so they are not hidden in the AC5 states; the spec leaves out only the freshness line there.
