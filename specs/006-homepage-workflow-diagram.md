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

- **AC1.** Given the homepage, when it loads, then a figure titled "How work flows" shows these steps in this order: Spec, Plan, Build, CI, Review, Merge. Each step has a one-line description of at most eight words and says who does it: Graham, an agent (named by role), or automation.
- **AC2.** Given the same figure, when it renders, then it shows that a merge starts the next step on its own, and it shows the two recovery loops: the fix agent (review changes, red CI or a merge conflict, then back to CI) and the tech lead's one unblock round (a blocked build, then back to Build). Each loop's label says what triggers it.
- **AC3.** Given the figure, when a screen reader or test reads it, then every step, owner and loop is real text in the page, not baked into an image. The steps are an ordered list in the accessibility tree, and the figure has an accessible name.
- **AC4.** Given a 1280 px viewport, when the homepage loads, then the whole figure fits inside the main content column without scrolling. Given a 375 px viewport, then the figure reflows (for example, from a row to a column), neither the page nor the figure scrolls sideways, and no step text renders smaller than 14 px.
- **AC5.** Given the figure, when it renders, then it has a hand-painted watercolor look: soft washes with uneven edges and visible paper texture behind the steps and connectors, while the text stays crisp. Any image it uses is served from this site, all of its images together weigh at most 200 KB, and if images are generated, the script that makes them is committed and runs at build time or once by hand, never in the visitor's browser.
- **AC6.** Given the figure, when an automated contrast check runs on desktop and at 375 px, then it finds no WCAG AA violations, including text over the watercolor washes.
- **AC7.** Given the figure, when it renders, then its base colours and fonts are tokens from the site's current theme ADR. Any extra wash tints are listed in the new ADR that records the diagram's design, with the token each derives from.
- **AC8.** Given the gate list on the How we work page, when unit tests run, then a test fails if the diagram's gate steps (CI, Review, Merge, and Spec's approval) differ from that list. The diagram can't quietly drift from the documented process.
- **AC9.** Given the existing Playwright suite, when it runs after this change, then every test passes unchanged, except where it located something on the homepage by text this spec moved on purpose. No assertion is removed or loosened.

## Design input

Graham, 2026-10-23:

- "Very concise and easy for people to consume. Make it beautiful and fit nicely on desktop and mobile."
- Watercolor style. "Maybe use watercolor style with OpenCV or another tool that will work well." The tech lead picks the technique. Options include OpenCV (for example `cv2.stylization`) run once over painted shapes to make wash textures, SVG turbulence and displacement filters, or hand-made textures with a free commercial licence. The ADR records the choice and the licence of any tool or asset.
- It should fit the redesigned site from spec 005 (github.com as the reference), not compete with it. The watercolor is the one warm, human touch on an otherwise exact, technical page.
- Source content: the agent pipeline as it runs on main (`agent-pipeline`, `agent-build`, `agent-fix`, `agent-unblock` and the merge gate). The map Graham asked for in the "Diagram the agent pipeline system" thread is a starting point, but it predates parallel specs (ADR 0016), so check it against the workflows.
- Build it as one issue.

## Non-goals

- A full, detailed map of every workflow, label and hook. That stays in the docs.
- Animation, interactivity or links inside the diagram, beyond ordinary links in its caption.
- Changing the pipeline itself.

## Success metric

Graham shows the homepage to someone outside the project, on a laptop and on a phone, and they can explain how work flows after one look.

## Open questions

- None for Graham. Build order: this spec should be built after spec 005's redesign merges, so it is drawn on the new theme. Merging this spec's PR after that build PR merges is the simplest way to ensure it.
