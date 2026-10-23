---
title: Specs build in parallel, and the pipeline fixes and restarts itself
status: proposed
date: 2026-10-23
decided_by: Proposed by Claude, requested by Graham
---

## Context

ADR 0008 runs one build at a time across all specs, so an open build PR for spec 001 holds up even the planning of spec 002. Graham wants several specs to move at once. Running in parallel also raises problems that used to be rare: PRs that conflict with main, a red CI run that nobody picks up, and a pipeline that only restarts on a merge, so removing `blocked` from the last stuck issue starts nothing. Each spec is also sliced into several issues, and every issue pays for its own build, CI run, review and merge.

## Options considered

1. **One build per spec at a time, several specs at once.** The issues of one spec still build in order, so later issues can rely on earlier ones. Specs that touch the same files can conflict.
2. **Every open issue at once.** Fastest on paper, but later issues of a spec often depend on earlier ones, and cost multiplies.
3. **Keep one build at a time, with fewer issues per spec.** Simple and conflict-free, but a long build still stops every other spec.

## Decision

Option 1, with these changes:

- **Parallel builds.** `agent-pipeline` starts a build for the next issue of every approved spec, at most `MAX_BUILDS` (3) at once, and plans one unplanned spec per run. Each build runs as its own `agent-build` run. The issue is labelled `building` until that run ends, and the picker clears a `building` label with no build behind it.
- **The pipeline restarts itself.** Besides every push to main, it runs when Graham removes `blocked` from an issue, when a build PR is closed without merging, when a build ends, and every 15 minutes. The schedule catches merges made by auto-merge, because a merge made with the workflow token starts no workflows.
- **The fix agent handles red CI and conflicts.** `agent-fix` takes a reason. `review` is ADR 0009's round. `ci` runs when the checks fail on a build PR (`agent-watch`). `conflict` runs when a build PR conflicts with main: it merges main into the branch and resolves the conflict, with no rebase or force-push. Each reason gets two rounds, counted by commit subject, before the PR is labelled `blocked`. A run stops if the PR has moved on since its trigger or is already blocked.
- **No agent review on workflow PRs.** A PR that changes `.github/workflows/` skips the agent-review job. claude-code-action refuses to run when a workflow differs from main's copy, so the review could only fail there. A skipped job passes the required check, and merge-gate still needs Graham.
- **Approval starts auto-merge.** When Graham approves a PR's latest commit, merge-gate turns on auto-merge, so the PR merges when every check is green. A later push dismisses the approval and the gate fails again.
- **One issue per spec by default.** The tech lead splits a spec only when one PR would be too big to review well (roughly over 1,000 changed lines) or a risky part should land first. Builds get 90 minutes and 120 turns to fit a whole spec.
- **Faster setup.** Build, fix and CI cache the Playwright browser by lockfile.
- **A daily note.** `agent-watch` comments each morning on a "Waiting on Graham" issue with PRs ready for his approval and blocked work. It stays quiet when nothing waits.

## Consequences

- Up to three specs move at once, and Graham's part is still approving and merging.
- Up to three Opus builds can run at the same time on the subscription, which reaches its rate limits sooner. Lower `MAX_BUILDS` if runs start failing on limits.
- Conflicts become routine. The fix agent resolves them with a merge commit, so build branches show merges from main. A conflict it can't resolve in two rounds waits for Graham.
- Bigger issues make bigger PRs, so reviews (agent and Graham) take longer each, but there are fewer of them.
- The pipeline runs a few seconds of picker every 15 minutes, which costs Actions minutes but no agent spend.
- ADR 0008's "one build runs at a time" and ADR 0009's review-only fix rounds are replaced by this ADR. The rest of both stands.
