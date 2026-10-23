---
spec: 006
title: Homepage workflow diagram
status: approved
budget_usd: 20
owner: Graham
---

## Problem

The homepage says that agents build the org's work under Graham's gates, but it never shows how. To see the flow, a visitor has to read the How we work page and several ADRs. One picture on the homepage would make the idea land in seconds, and a beautiful one would show the same care as the rest of the portfolio.

## Users and stories

- As a visitor, I want to see at a glance how an idea becomes merged work, so that I understand the org without reading the docs.
- As a visitor on a phone, I want the diagram to fit my screen and stay readable, so that I don't have to zoom or scroll sideways.

## Acceptance criteria

- **AC1.** Given the homepage, when it loads, then a figure titled "How work flows" shows these steps in this order: Spec, Plan, Build, CI, Review, Merge. Each step has a one-line description of at most eight words and says who does it: Graham, an agent (named by role), or automation. Spec names the spec writer, who drafts it, and Graham, who approves it. Plan names the tech lead. Build names the engineer and QA agents. Merge names Graham, plus automation for low-risk changes (ADR 0006).
- **AC2.** Given the same figure, when it renders, then it shows that a merge starts the next step on its own, and it shows the two recovery loops: the fix agent (review changes, red CI or a merge conflict, then back to CI) and the tech lead's one unblock round (a blocked build, then back to Build). Each loop's label says what triggers it.
- **AC3.** Given the figure, when a screen reader or test reads it, then every step, owner and loop is real text in the page, not baked into an image. The steps are an ordered list in the accessibility tree, and the figure has an accessible name.
- **AC4.** Given a 1280 px viewport, when the homepage loads, then the whole figure fits the width of the main content column, with no horizontal overflow or scroll. Given a 375 px viewport, then the figure reflows (for example, from a row to a column), neither the page nor the figure scrolls sideways, and no step text renders smaller than 14 px.
- **AC5.** Given the figure, when it renders, then any image it uses is served from this site, and all of its images together weigh at most 200 KB. If images are generated, the script that makes them is committed with its output. It is run once by hand, or on the existing Node toolchain, and never in the visitor's browser, so CI needs no new tools.
- **AC6.** Given the figure, when an automated contrast check runs on desktop and at 375 px, then it finds no WCAG AA violations, including text over the watercolor washes.
- **AC7.** Given the figure, when it renders, then its base colours and fonts are tokens from spec 005's theme ADR, which supersedes ADR 0014. If that ADR is not on main when this is built, the build stops and asks rather than drawing on the old theme. Any extra wash tints are listed in the new ADR that records the diagram's design, with the token each derives from.
- **AC8.** Given the gate list on the How we work page, when unit tests run, then a test fails if the diagram's gate steps (Spec, CI, Review, Merge) differ from that list in name, order or approver. Descriptions may differ. The gate list moves out of the page file into a shared module with a structured approver per gate (Spec: Graham; CI: automation; Review: the code reviewer agent; Merge: Graham, or automation for low-risk changes), and the diagram reads its gate approvers from it. The module also keeps the How we work page's approver sentences, so that page renders the same text its e2e test asserts (`site/e2e/how-we-work.spec.ts`). The spec writer and the engineer and QA agents are extra diagram text. The diagram can't quietly drift from the documented process.
- **AC9.** Given the existing Playwright suite, when it runs after this change, then every test passes unchanged, except where it located something on the homepage by text this spec moved on purpose. No assertion is removed or loosened.

## Design input

Graham, 2026-10-23 (his words are in quotes; the rest is the spec writer's reading of them):

- "Very concise and easy for people to consume. Make it beautiful and fit nicely on desktop and mobile."
- Watercolor style: soft washes with uneven edges and visible paper texture behind the steps and connectors, with crisp text. This is a design goal that Graham judges on the preview deploy, not something a test checks. "Maybe use watercolor style with OpenCV or another tool that will work well." The tech lead picks the technique. Options include OpenCV (for example `cv2.stylization`) run once over painted shapes to make wash textures, SVG turbulence and displacement filters, or hand-made textures with a free commercial licence. The ADR records the choice and the licence of any tool or asset.
- It should fit the redesigned site from spec 005 ([PR #55](https://github.com/ai-engineering-scaffold/agent-team/pull/55), github.com as the reference, superseding ADR 0014's theme), not compete with it. The watercolor is the one warm, human touch on an otherwise exact, technical page.
- Source content: the agent pipeline as it runs on main (`agent-pipeline`, `agent-build`, `agent-review`, `agent-fix`, `agent-unblock` and the merge gate). Check every step and loop against those workflows and ADRs 0006, 0008, 0009, 0015 and 0016.
- Build it as one issue.

## Non-goals

- A full, detailed map of every workflow, label and hook. That stays in the docs.
- Animation, interactivity or links inside the diagram, beyond ordinary links in its caption.
- Changing the pipeline itself.

## Success metric

Graham shows the homepage to someone outside the project, on a laptop and on a phone, and they can explain how work flows after one look.

## Open questions

- None for Graham. Build order: this spec should be built after spec 005's redesign merges, so it is drawn on the new theme. Merging this spec's PR after that build PR merges is the simplest way to ensure it.
