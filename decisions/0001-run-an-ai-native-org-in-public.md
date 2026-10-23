---
title: Run an AI-native engineering org, in public
status: accepted
date: 2026-10-22
decided_by: Graham
---

## Context

AI agents can now write specs, code, reviews and tests. The open question for an engineering manager is no longer whether agents can do the work, but how to direct them: what roles they hold, where humans stay in the loop, and how to know whether the org is any good.

## Options considered

1. **Use agents ad hoc on a side project.** Fast to start, but leaves no evidence of how the work was directed.
2. **Build an org with defined roles, gates and metrics, and publish everything.** Slower to set up, but the setup itself is the demonstration.

## Decision

Build AI Engineering Scaffold: an engineering org where Claude agents hold defined roles and Graham is the engineering manager. Graham sets goals, approves specs and designs, and owns every merge that is not explicitly low-risk.

The org publishes its specs, decisions, design docs and a weekly metrics page covering shipping speed, defect rate and AI spend per feature.

## Consequences

- Every decision of substance gets an ADR in this folder, including the ones that turn out wrong.
- The org's first product is its own public site, so the pipeline runs on real work before a product is chosen.
- Any product the org builds must rely only on data that is free and licensed for commercial use.
