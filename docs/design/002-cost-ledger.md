# Design: cost and cycle-time ledger (spec 002)

Spec: [specs/002-cost-ledger.md](../../specs/002-cost-ledger.md) · Issue: #18 · ADRs: [0010](../../decisions/0010-cost-ledger-lives-on-a-metrics-branch.md), [0011](../../decisions/0011-unit-tests-for-criteria-without-a-page.md)

## Summary

Every agent job gets a small `record` job after it. The record job builds one JSON record from the agent job's result and pushes it, as its own file, to a `metrics` branch that holds nothing else. The review job and the record job read that branch for the spend line (AC5) and the over-budget label (AC6). The site build downloads the branch as a tarball for the loader (AC4). The logic lives in `site/lib/ledger/` as plain TypeScript, unit-tested with Vitest, and workflows run it with Node 22's built-in type stripping.

## 1. Where the ledger lives

| Option | Fresh within minutes (AC5, AC6) | Readable by the site build (AC4) | Cost |
| --- | --- | --- | --- |
| **A. `metrics` branch** | Yes | Yes, as a public tarball | Push retries; one more ref to read |
| B. Artifacts or cache | Yes | No | Expires after 90 days or is evicted |
| C. Comments on a tracking issue | Yes | Only with an API token at build | Data isn't in the repo |
| D. Bot PR per run, auto-merged | No: a PR and CI per run | Yes | Changes `low-risk-paths.txt`; doubles CI |
| E. Separate repo | Yes | Yes | A second repo and a cross-repo token |

**Choice: A** ([ADR 0010](../../decisions/0010-cost-ledger-lives-on-a-metrics-branch.md)).

- The branch is an orphan branch with one file per run: `ledger/YYYY/MM/<run_id>-<attempt>-<job>.json`. Separate files mean concurrent runs never edit the same file, so a rejected push is fixed by `git pull --rebase` and one retry (up to three tries).
- The `main` ruleset targets only the default branch, so no ruleset exception is needed. The record job pushes with the workflow's `GITHUB_TOKEN` (`contents: write`). That push starts no workflow, which is what we want.
- A push to `metrics` is never a merge to `main`, so it doesn't start `agent-pipeline`.
- **First run.** Nobody creates the branch by hand. When `git fetch origin metrics` finds no branch, the record script starts an orphan branch and pushes it. Every reader treats a missing branch as an empty ledger.
- Readers: workflows run `git fetch --depth=1 origin metrics` and read the files from `FETCH_HEAD`. The site build downloads `https://codeload.github.com/<repo>/tar.gz/refs/heads/metrics` (public, no token) into `site/.ledger/` in a `prebuild` script. Setting `LEDGER_SKIP_FETCH=1` skips the download, and CI's `site` and `e2e` jobs set it so tests never depend on live branch data. Unpacking rejects any path that would land outside `site/.ledger/` and stops at 10 MB or 20,000 files, falling back to `available: false`, and the loader keeps only records that pass schema validation. If the download fails, the build continues and logs a warning, so a GitHub outage never breaks a deploy. The loader then returns `available: false`, distinct from an empty ledger, so the metrics page can say the data is unavailable instead of showing $0. `site/.ledger/` is added to `.gitignore`.

## 2. Recording runs that time out or are cancelled (AC2)

A step inside the agent job may not run when that job is cancelled or times out. So recording is a separate job:

```yaml
record:
  needs: agent        # the job that runs claude-code-action
  if: always()
```

- **The agent job** adds a final `if: always()` step that reads the action's `execution_file` and writes `cost_usd`, `turns` and `subtype` as job outputs. These are three numbers or words, never the transcript. If the job is cancelled before that step, the outputs are empty, and the record has `null` cost and turns.
- **The record job** reads `subtype`, `needs.agent.result`, and the agent job's and agent step's start and end times from the Jobs API, then maps them to `outcome`. The outcome comes from the agent step first, because a job can fail after a successful agent step: `agent-review` exits 1 on every CHANGES_REQUESTED verdict, and `agent-build` can fail in its "Mark the issue blocked" step.
  - `success`: `subtype` is `success`, whatever the job's result.
  - `max_turns`: `subtype` is `error_max_turns`.
  - Only when `subtype` is empty does the job's result decide:
    - `timeout`: the job failed or was cancelled, and its elapsed time is within 60 seconds of its `timeout-minutes`. The workflow passes that value to the record job as an env value set next to the job (20 for plan and review, 60 for build and fix), never hard-coded in the script.
    - `cancelled`: the job was cancelled otherwise, for example by `cancel-in-progress` on a new push.
    - `error`: anything else, including any other non-empty `subtype`.
- **Finding `pr` for a build.** The build opens its PR partway through the run, so the record job looks it up afterwards: the open PR whose head branch matches `spec-NNN/issue-<N>-`. If there is none, `pr` is `null`.
- **Field sources (AC1).** `date` is the run's start time (`run_started_at`). `duration_s` is the agent step's own start to end, or to when the job stopped if the step never finished; it is never the job's duration.
- A run is recorded only if the agent step ran: its `conclusion` is not `skipped` and it has a start time. A skipped step still gets timestamps from the Jobs API, so a start time alone isn't enough. This covers `agent-fix` runs that its guard step stops (not a build PR, PR closed, or out of rounds), and matches the spec's "a run that fails before the agent step starts is not recorded". #19's tests include a fixture for "agent step skipped, so no record".
- **Finding the agent job.** The job's name depends on how it ran: `agent-build.yml` shows as `build / build` when the pipeline calls it and `build` when started by hand. So each workflow passes the agent job's name to the record job as an env value, and the script matches the job whose name ends with it.
- **`issue` for reviews and fixes.** A review or fix of a `spec-NNN/issue-N-` PR sets `issue` to N, from the branch. Any other PR has `issue: null`.

## 3. How workflows call the TypeScript

| Option | New dependency | Notes |
| --- | --- | --- |
| **A. Node 22 type stripping** | None | Run `node site/scripts/ledger/record.ts` directly. Needs erasable-only syntax (no enums or namespaces) and `.ts` extensions in relative imports. |
| B. `tsx` | Yes (dev) | Most forgiving, but a new dependency for three scripts. |
| C. `tsc` build step | None | An extra compile step in each workflow and output to keep out of the repo. |

**Choice: A.** Node 22.18 and later strip types without a flag. Not every job pins Node today (`agent-review.yml` and the plan job have no `setup-node`), so every job that runs these scripts, including each new record job, adds `actions/setup-node` with `node-version: 22`. The engineer sets `allowImportingTsExtensions` in `site/tsconfig.json` so Next.js, Vitest and Node all accept the `.ts` imports. Type stripping ignores tsconfig `paths`, so files under `site/lib/ledger/` and `site/scripts/ledger/` use relative `.ts` imports only, never the `@/` alias. If that clashes with the Next.js build, B is the fallback, named in the PR as a new dependency.

Files:

- `site/lib/ledger/record.ts`: the schema, `buildRecord()` and `outcomeFor()` (AC1–AC3).
- `site/lib/ledger/load.ts`: the loader and per-spec totals (AC4).
- `site/lib/ledger/spend-line.ts`: the review comment line (AC5).
- `site/lib/ledger/label-target.ts`: which PRs or issue get `over-budget` (AC6).
- `site/scripts/ledger/*.ts`: thin CLI wrappers that call the above from workflows.

## 4. Backfilling spec 001

Review jobs run with `show_full_output: true`, so their logs include the final result with `total_cost_usd` and `num_turns`. The build and plan jobs don't print it. Logs are kept for 90 days. A full backfill isn't possible, and a partial one (reviews only) would make spec 001's total misleading. **Choice: no backfill.** Spec 001 is reported as "not recorded" on the metrics page.

## 5. Workflow changes Graham applies

Agents may not edit `.github/workflows/`, so the last issue (#23) writes the scripts and puts the exact workflow diff in its PR description. The diff covers:

- an `if: always()` output step and a `record` job in `agent-build.yml`, `agent-fix.yml`, `agent-review.yml` and the plan job in `agent-pipeline.yml`;
- the spend line added to the review prompt, read from a file the review job writes before Claude runs;
- the permissions below, on the record jobs only.

Record job permissions, listed in full so the diff doesn't hit a 403 that AC6's "labelling can't fail the job" would hide:

| Permission | Why |
| --- | --- |
| `contents: write` | Push the record to `metrics` |
| `actions: read` | Job and step timings from the Jobs API |
| `pull-requests: read` | List open PRs for AC6 |
| `issues: write` | Create and add the `over-budget` label (AC6) |

`agent-build.yml` is a reusable workflow, and a called workflow can only use the permissions its caller grants. So the `build` job in `agent-pipeline.yml` must also grant `actions: read`; without it, GitHub rejects the called workflow and every pipeline-started build fails before the agent runs. #23's workflow diff includes that line, and it is tried with a pipeline-started build, not only with `workflow_dispatch`, which hides this problem. #23 also pushes twice in quick succession to a PR and checks that both review runs are recorded, the first as `cancelled`, because `agent-review` cancels in-progress runs and a record job that is already running could be cut off.

**Scripts run from `main`, never from the PR.** On `pull_request`, `actions/checkout` defaults to the PR's merge commit, so a PR could otherwise change the scripts that record it, rewrite the ledger with the record job's write token, or fake its own spend line. That would break the rule in `agent-review.yml` and `merge-gate.yml` that a PR never changes what reviews it. So:

- every record job and the spend-line step check out `ref: main` and run the scripts from there. In the review job, the spend-line step checks `main` out into a separate `path: .ledger-tools`, so the agent still reviews the PR's code in the workspace;
- the build, fix and plan record jobs also check out `main` explicitly;
- the record job in `agent-review.yml` repeats the agent job's same-repo guard, because `if: always()` would otherwise run it on fork PRs.

**The spend line is numbers only.** Anyone with write access can edit a record on `metrics` (ADR 0010), and the line goes into the review prompt. The formatter reads only records that pass schema validation and emits only numbers and the spec number, so a hand-edited record can't inject text into the prompt.

Untrusted values (branch names, labels, PR titles) reach scripts only through `env:`, never through `${{ }}` inside `run:`, and `spec` is matched against `^[0-9]{3}$` before use.

## 6. Testing

Per [ADR 0011](../../decisions/0011-unit-tests-for-criteria-without-a-page.md), AC1–AC6 are checked by Vitest tests in `site/tests/ledger/`, named after each criterion, with fixtures in `site/tests/fixtures/ledger/`: one execution result per outcome (including an agent step that succeeded in a job that failed afterwards), a small ledger folder and PR and issue lists for the label target.

## Build order

The issues stay as sliced: #19 schema and builder, #20 loader, #21 spend line, #22 label target, #23 scripts and the proposed workflow diff. Once this design merges, `design-needed` comes off #19–#23 and #18 closes, and the pipeline builds #19 next.
