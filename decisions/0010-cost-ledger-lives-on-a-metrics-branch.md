---
title: The cost ledger lives on a metrics branch
status: proposed
date: 2026-10-23
decided_by: Proposed by tech-lead agent, approved by Graham
---

## Context

Spec 002 records every agent run's cost and duration. Later runs need the records within minutes (the spend line in reviews and the over-budget label), and the static site build must read them. `main` only takes changes through PRs, so a workflow can't append records there.

## Options considered

1. **A `metrics` branch, one JSON file per run.** Fresh within seconds, plain git, public and auditable. Costs a push retry on races and one more ref for readers.
2. **Actions artifacts or cache.** Nothing to set up, but records expire or get evicted, and the site build can't read them.
3. **Comments on a tracking issue.** Fresh, but the site build would need an API token, and the data isn't in the repo.
4. **An auto-merged bot PR per run.** Keeps records on `main`, but adds a PR and a CI run for every agent run and changes the low-risk allowlist.
5. **A separate metrics repo.** Clean, but needs a second repo and a cross-repo token.

## Decision

Option 1. Records go to an orphan `metrics` branch as `ledger/YYYY/MM/<run_id>-<attempt>-<job>.json`, pushed by a `record` job with the workflow token. Workflows read the branch with a shallow fetch, and the site build downloads it as a public tarball, continuing with an empty ledger if that fails. See `docs/design/002-cost-ledger.md`.

## Consequences

- The ruleset on `main` doesn't apply to `metrics`. Anyone with write access could edit or rewrite records there; git history keeps that visible.
- The site build depends on GitHub being reachable for current numbers, but never fails because of it.
- If the branch grows large (thousands of runs), revisit with a monthly roll-up file.
