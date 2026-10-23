---
name: slice-issues
description: How to break an approved spec into GitHub issues that each fit in one PR. Use when planning the build of a spec.
---

# Slice a spec into issues

## Each issue

- Fits in one PR that a reviewer can read in 15 minutes: roughly under 400 changed lines.
- Ships something that works on its own. No "part 1 of 3" that leaves `main` broken.
- Title: `[SPEC-NNN] short imperative description`
- Body:

```markdown
Spec: specs/NNN-short-name.md
Covers: AC1, AC3

## What to build

Two or three sentences.

## Likely files

- site/app/...

## Done when

- [ ] AC1 and AC3 pass in Playwright on the preview deploy
- [ ] Unit tests cover the new logic
```

- Labels: `spec-NNN`, plus `design-needed` if Graham must approve a design first. Builds start automatically after each merge to main, in issue-number order (ADR 0008), so create issues in the order they should be built.

## Order

Create issues in build order and say the order in the first issue. Put risky or uncertain work first so surprises land early.
