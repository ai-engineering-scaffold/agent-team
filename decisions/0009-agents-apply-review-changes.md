---
title: Agents apply the reviewer's requested changes
status: proposed
date: 2026-10-23
decided_by: Proposed by Claude, requested by Graham
---

## Context

Since ADR 0008, merges start each build without a click. A CHANGES_REQUESTED verdict from the reviewer agent still stopped the build PR until someone fixed the findings by hand, which is the same kind of manual step 0008 removed. Two smaller frictions came up on the same PRs: an approval added a second, green `merge-gate` check next to the old red one, and the engineer ran on Sonnet while the reviewer that judged its work ran on Opus.

## Options considered

1. **Fix findings by hand.** Keeps a person on every round, but the findings so far were small test fixes that an engineer agent can make.
2. **The engineer applies the review on build PRs, with a round limit.** The fix is pushed to the PR and goes through CI and a fresh review, like any other commit.
3. **The reviewer fixes what it finds.** Fewer moving parts, but the reviewer would grade its own work, which removes the point of a fresh-context review.

## Decision

Option 2. When the reviewer returns CHANGES_REQUESTED on a build PR (branch `spec-NNN/issue-N-*`), `agent-review` starts the `agent-fix` workflow. The engineer fixes every blocking finding, applies small suggestions within the PR's files, runs the checks and pushes a commit whose subject starts "Address agent review". The push runs CI and the review again. After two such rounds the PR is labelled `blocked` and waits for Graham. PRs opened by hand are never changed.

In the same change:

- An approval or dismissal re-runs the PR's existing `merge-gate` run instead of adding a second check.
- The engineer agent runs on Opus.

## Consequences

- A build PR reaches Graham only once the reviewer passes it, or once it is blocked.
- The merge gate is unchanged: an approval covers one commit, so an automatic fix after Graham approves still needs a new approval.
- Each fix round costs a build-sized run, and Opus raises the cost of every build. The two-round cap bounds it, and the cost ledger will show whether to revisit.
