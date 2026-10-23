The e2e fixture ledger for the /metrics page (spec 003, design 003).

When LEDGER_SKIP_FETCH=1 and VERCEL is not 1, `prebuild` (scripts/ledger/fetch.mjs) copies
ledger/ into site/.ledger/ledger/, so every Playwright test runs against these records and never
against live `metrics` data. Every file is a valid spec 002 record with a fixed date, so the page
built from it never changes. Edit a record only together with the tests that rely on it.

Cases:

- Spec 001 has no runs, so its row shows "Not recorded".
- Spec 002 is over its budget of $15: $16.10 over 5 runs (5001-5005). 5004 timed out with
  cost_usd null, so 1 run has no cost.
- Spec 003 is under its budget of $15: $6.95 over 4 runs (5008, 5010, 5012, 5013).
- Spec 999 has no spec file, so it shows as "Unknown spec 999": $2.95 over 2 runs (5007, 5011).
  5011 ended at max_turns.
- Chores (spec "none"): $0.75 over 2 runs (5006, 5009). 5009 ended in error.

Weeks (Monday start, UTC). The newest run is 5013 at 2026-10-21T14:05:00Z, a Wednesday, so the
8 weeks shown start on 2026-10-19 back to 2026-08-31:

  week        runs  spend  not success
  2026-10-19  2     $1.80  0
  2026-10-12  2     $6.35  1 (5011, max_turns)
  2026-10-05  0     $0.00  0   <- empty week
  2026-09-28  2     $1.28  1 (5009, error)
  2026-09-21  1     $0.80  0
  2026-09-14  2     $7.77  0
  2026-09-07  2     $1.10  1 (5004, timeout)
  2026-08-31  1     $6.40  0

5001 (2026-08-25, week of 2026-08-24) is older than the 8 weeks, so it counts toward spec 002's
spend but appears in no week row.
