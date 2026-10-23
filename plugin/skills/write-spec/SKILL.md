---
name: write-spec
description: Template and rules for writing a feature spec in specs/. Use whenever writing or revising a spec.
---

# Write a spec

A spec is done when an engineer can build it and QA can test it without asking a question.

## File

`specs/NNN-short-name.md`, where NNN is the next free three-digit number. Open it as a PR titled `spec: NNN short name`.

## Template

```markdown
---
spec: NNN
title: Short name of the feature
status: draft # draft | approved | shipped | dropped
budget_usd: 15 # AI spend allowed for this feature, all roles combined
owner: Graham
---

## Problem

Who has the problem, and what it costs them today. Two or three sentences.

## Users and stories

- As a <user>, I want <capability>, so that <outcome>.

## Acceptance criteria

- **AC1.** Given <state>, when <action>, then <observable result>.
- **AC2.** ...

## Non-goals

- What this spec deliberately does not do.

## Success metric

How we will know after release that it worked.

## Open questions

- Anything the brief left open. Do not guess the answer.
```

## Rules

- Every criterion is observable in a browser or a test. "Fast" is not a criterion; "the list renders within 1 second on the preview deploy" is.
- Number criteria AC1, AC2 and so on. Issues, tests and reviews refer to them by number.
- Keep it under one page. If it is longer, it is two specs.
