---
title: Each merge to main starts the next agent step
status: proposed
date: 2026-10-23
decided_by: Proposed by Claude, approved by Graham
---

## Context

Week 1 started a build when Graham added the `agent:build` label to an issue. That meant one manual step for every issue, on top of the merges Graham already does. Graham wants work to move on by itself once a gate is passed.

## Options considered

1. **A label per issue.** Explicit, but the label adds no judgement that the spec approval didn't already give, and it is easy to forget.
2. **Every merge to main starts the next step.** The pipeline picks the next unbuilt issue of an approved spec, and the gates stay where they are.
3. **Build every issue of a spec at once.** Faster, but later issues often depend on earlier ones, and parallel builds multiply cost.

## Decision

Option 2. The `agent-pipeline` workflow runs on every push to main. Pushes only come from merged PRs, so each run follows a gate Graham passed. It takes the first matching step:

- An approved spec with no issues gets planned. The tech lead slices it, then the first build starts.
- Otherwise, the lowest-numbered open issue of an approved spec gets built, unless it is labelled `design-needed` (waiting on gate 2) or `blocked`, or a PR for it is already open.

Build branches are named `spec-NNN/issue-N-short-name`, so the pipeline can tell which issue a PR builds. One build runs at a time. A build that ends without a PR labels its issue `blocked`, so the pipeline doesn't retry it on every merge.

## Consequences

- Graham's work becomes reviewing and merging. Nothing else needs a click.
- An open build PR holds up the next build, including builds for other specs. If that becomes a bottleneck, revisit with one build per spec.
- The `agent:build` label is retired. Graham can still start one issue by hand with the `agent-build` workflow's Run button.
