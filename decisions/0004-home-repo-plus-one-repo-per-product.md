---
title: One home repo, plus one repo per product
status: accepted
date: 2026-10-22
decided_by: Graham
---

## Context

The org will build more than one product. The way of working (roles, gates, CI) should be defined once, while each product keeps its own history, issues and deploys.

## Options considered

1. **One monorepo for everything.** Simple at first; products' issues, access and deploys tangle as they grow.
2. **Fully separate repos, each with its own copy of the agents and CI.** Clean, but copies drift.
3. **A home repo that the product repos plug into.** The way of working lives in one place and is versioned.

## Decision

`agent-team` is the org's home. It holds the org plugin (agents, skills, hooks), reusable CI workflows, org-level ADRs and the public site. Each product gets its own repo that:

- enables the org plugin in its `.claude/settings.json`,
- calls the home repo's reusable workflows for its gates,
- keeps its own `specs/` and `decisions/`, which the public site and metrics job read through the GitHub API.

## Consequences

- A change to a role or a gate ships to every repo through one reviewed PR; product repos can pin a tagged version.
- The site lives in the home repo until a second product exists.
