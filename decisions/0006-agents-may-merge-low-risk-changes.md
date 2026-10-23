---
title: Agents may merge low-risk changes
status: accepted
date: 2026-10-22
decided_by: Graham
---

## Context

If Graham must merge every change, the org's speed is capped by Graham's attention, including for changes where a human review adds little.

## Decision

A PR may merge without Graham when **every** changed file matches `.github/low-risk-paths.txt` and the CI and `agent-review` checks pass. The `merge-gate` check enforces this: it passes for a low-risk PR and turns on auto-merge, and for any other PR it passes only once Graham has approved the latest commit.

The allowlist starts narrow: docs, design docs, metrics snapshots and site copy.

## Consequences

- The allowlist file and the workflows are owned by Graham in `CODEOWNERS`, so widening the list always takes Graham's approval and a new ADR.
- Decisions are never low-risk: any change under `decisions/` needs Graham.
