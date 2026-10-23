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

- Labels: `spec-NNN`. Never `design-needed`: there is no design gate (ADR 0012). A real technical choice goes in a `## Design` section of the first issue (options, choice, why), and that issue's PR adds the design doc and a proposed ADR. Builds start automatically after each merge to main, in issue-number order (ADR 0008), so create issues in the order they should be built.

## Creating and checking an issue

Issue bodies are long Markdown, so never pass one inline with `--body`, a heredoc or `$(...)`. The pipeline's planner may be refused those commands, which is the likely reason spec 004's first issue lost its Design section.

1. Write the body to a file under `/tmp/issue-bodies/` with the Write tool, for example `/tmp/issue-bodies/1.md`.
2. Run `gh issue create --title "..." --label spec-NNN --body-file /tmp/issue-bodies/1.md`.
3. Run `gh issue view <number>` and check that every section you wrote is there, including `## Design` on the first issue. If one is missing, fix it with `gh issue edit <number> --body-file /tmp/issue-bodies/1.md` and check again.
4. If a later issue refers to a decision ("the tokens from #N", "ADR NNNN"), check that the decision is written in the issue it points to.

## Order

Create issues in build order and say the order in the first issue. Put risky or uncertain work first so surprises land early.
