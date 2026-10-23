---
name: slice-issues
description: How to turn an approved spec into GitHub issues, usually one per spec. Use when planning the build of a spec.
---

# Slice a spec into issues

## How many issues

Default to **one issue for the whole spec** (ADR 0016). Every issue pays for its own build, CI run, review and merge, and the issues of one spec build one after another, so each extra issue adds a full round trip.

Split only when one of these is true, and say which in the first issue:

- One PR would be too big to review well: roughly over 1,000 changed lines, not counting tests and lockfiles.
- A risky or uncertain part (a new dependency, a data model, a build-system change) should land and prove itself before the rest is built on it.

Even then, use as few issues as the reason needs, normally two and rarely more than three.

## Each issue

- Ships something that works on its own. No "part 1 of 3" that leaves `main` broken.
- Title: `[SPEC-NNN] short imperative description`
- Body:

```markdown
Spec: specs/NNN-short-name.md
Covers: AC1, AC2, AC3

## What to build

Two or three sentences.

## Likely files

- site/app/...

## Done when

- [ ] AC1 to AC3 pass in Playwright on the preview deploy
- [ ] Unit tests cover the new logic
```

- Labels: `spec-NNN`. Never `design-needed`: there is no design gate (ADR 0012). A real technical choice goes in a `## Design` section of the first issue (options, choice, why), and that issue's PR adds the design doc and a proposed ADR. Builds start automatically (ADR 0008). A spec's issues build one at a time in issue-number order, while other specs build alongside them (ADR 0016), so create issues in the order they should be built.

## Creating and checking an issue

Issue bodies are long Markdown, so never pass one inline with `--body`, a heredoc or `$(...)`. The pipeline's planner may be refused those commands, which is the likely reason spec 004's first issue lost its Design section.

1. Write each issue's body to its own file under `/tmp/issue-bodies/` with the Write tool, named by build order: `/tmp/issue-bodies/<order>.md`.
2. Run `gh issue create --title "..." --label spec-NNN --body-file /tmp/issue-bodies/<order>.md`.
3. Run `gh issue view <number>` and check that every section you wrote is there, including `## Design` on the first issue. If one is missing, fix that issue's own file and run `gh issue edit <number> --body-file /tmp/issue-bodies/<order>.md`, then check again. Only edit issues you created in this run, only their body, and never change labels.
4. If a later issue refers to a decision ("the tokens from #N", "ADR NNNN"), check that the decision is written in the issue it points to.

## Unblocking a build

When a build opens no PR, the issue is labelled `blocked` and the tech lead gets one round on it (ADR 0015). Read the issue with `gh issue view <number> --comments`: the engineer's question, or the workflow's comment with the agent's last message and any refused tool calls, says what stopped it. Then read the spec it links.

- If the gap is yours to decide (ADR 0012), such as a missing Design section, an unclear file or test approach, or a technical detail, fix the issue. Write its whole updated body to `/tmp/unblock/body.md`, run `gh issue edit <number> --body-file /tmp/unblock/body.md`, check it with `gh issue view`, and comment on the issue with what changed and why. Keep the issue within the spec's acceptance criteria. If the build was stopped by a refused tool call, say in the issue how to do that step with the tools the engineer has.
- If it needs Graham, comment on the issue with the exact question and the options you see. That covers a change to the spec's scope or acceptance criteria, a conflict with the spec, a product or cost decision, and any change to workflows, permissions or protected files.

Edit only that issue's body. Never change labels: the workflow removes `blocked` when you resolved the issue, and keeps it when Graham must decide.

## Order

When a spec has more than one issue, create them in build order and say the order in the first issue. Put risky or uncertain work first so surprises land early.
