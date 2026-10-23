---
title: Design input goes in the spec, not a separate gate
status: proposed
date: 2026-10-23
decided_by: Proposed by Claude, requested by Graham
---

## Context

ADR 0002 set a design gate: when the tech lead flagged `design-needed`, Graham approved the design before anything was built. On spec 002 the gate held five build issues until a design PR merged, and the approval added a step for Graham between two things he already reviews: the spec and the build PRs. Graham would rather give design input once, when the spec is written.

## Options considered

1. **Keep the design gate.** Graham sees every real technical choice before code exists, at the cost of a stop in every spec that needs one.
2. **Design input in the spec, design shipped with the first build.** Graham states his constraints and preferences while the spec is written. The tech lead makes the remaining choices, and they land in the first build PR, where the reviewer agent checks them and Graham sees them at merge.
3. **No design records.** Fastest, but loses the public record of why things were built a certain way.

## Decision

Option 2. This supersedes the Design gate in ADR 0002; its roles and the other four gates stand.

- Specs gain an optional "Design input" section with Graham's constraints on how the feature is built. The tech lead treats it as fixed.
- When a spec needs a real technical choice, the tech lead decides it while planning and writes the options, the choice and the reasons into a "Design" section of the first issue. No issue is labelled `design-needed`.
- The engineer building that issue adds the design doc in `docs/design/` and a proposed ADR in `decisions/` in the same PR as the code. It never edits a spec or an ADR that is already on main, and the path guard hook enforces this.

The gates are now Spec, CI, Review and Merge.

## Consequences

- No step waits on Graham between a merged spec and its first build PR.
- A design Graham disagrees with is found at the first build PR rather than before it. Putting the riskiest work first keeps that PR small, and Graham can close it and add design input to the spec.
- ADRs written this way stay `proposed` until Graham accepts them, as before.
