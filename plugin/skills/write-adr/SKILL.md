---
name: write-adr
description: Template and rules for recording an architecture or org decision as an ADR in decisions/. Use when a choice of tool, vendor, model, role, gate, budget or architecture is made or reversed.
---

# Write an ADR

The decision log is public. It is the record of how the org is directed, so it must say who decided and why.

## What earns an ADR

- A choice of tool, model, vendor or dependency
- A change to an agent role, a review gate or the low-risk allowlist
- A budget change
- Anything reversed: write a new ADR that supersedes the old one

Routine implementation choices go in the PR description instead.

## File

`decisions/NNNN-short-title.md`, where NNNN is the next free four-digit number. Copy `decisions/0000-template.md`.

## Rules

- The title states what was chosen, not the topic: "Host on Vercel", not "Hosting".
- `status: proposed` until Graham accepts it. Agents never set `accepted`.
- `decided_by` is `Graham`, or `Proposed by <role> agent, approved by Graham`.
- List the options that were really considered, each with what it gives and what it costs.
- Never edit an accepted ADR's decision. To change it, write a new ADR and set the old one to `status: superseded` with `superseded_by`.
- `npm --prefix site run check` validates every ADR's frontmatter.
