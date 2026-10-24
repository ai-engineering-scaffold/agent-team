# Design: homepage workflow diagram (spec 006)

Spec: [specs/006-homepage-workflow-diagram.md](../../specs/006-homepage-workflow-diagram.md) · Issue: #59 · ADR: [0018](../../decisions/0018-homepage-workflow-diagram.md)

## Summary

The homepage gets a "How work flows" figure between the intro and "Latest decisions". It shows the six steps (Spec, Plan, Build, CI, Review, Merge) as an ordered list of text cards, each with an owner line and a description of at most eight words, then three loops: a merge starts the next step, the fix agent, and the tech lead's unblock round. Watercolor washes and paper grain sit behind the cards. They are WebP files made once by a committed Node script that paints in the Chromium Playwright already installs. The How we work gate list moves into a shared module with structured approvers, and the diagram reads its gate approvers from it, so the two can't drift. It ships in one PR (spec, Design input; ADR 0016).

## 1. The watercolor technique (Design input, AC5)

| Option | Gives | Costs |
| --- | --- | --- |
| A. OpenCV run once by hand (`cv2.stylization` over painted shapes), Graham's suggestion | A known tool (`opencv-python`, Apache 2.0) | A Python toolchain outside the repo's Node setup; an agent rebuilding the textures would need `pip install`. Its filters are edge-preserving smoothing: no pigment pooling or bleed on their own, and the input shapes still need painting some other way |
| B. Live SVG filters in the page (`feTurbulence`, `feDisplacementMap`) | No image bytes; reflows with any layout | Computed in the visitor's browser on every paint, slow on phones and different per engine. Filtered layers near text make axe return `incomplete` for `color-contrast`, which AC6 forbids |
| C. Hand-made or stock textures under a free commercial licence | Can look good | A source and licence to track; can't be tuned to the token tints or regenerated |
| **D. A committed Node script that paints the washes in Playwright's Chromium, run once by hand, with WebP output committed** | Generated on the existing Node toolchain; nothing runs in the visitor's browser; deterministic per seed; all ours | Needs Chromium when it is rerun, which the dev setup and CI already install |

**Choice: D.** It meets AC5 exactly and looks closer to watercolor than A's filter alone. B's runtime cost and `incomplete` risk and A's reproducibility problem rule them out.

### How the script paints

`site/scripts/workflow-washes/generate.ts`, run with `npm --prefix site run washes` (or `node site/scripts/workflow-washes/generate.ts`; Node 22 strips the types, as the ledger scripts rely on). It is not part of `build`, `prebuild`, `check` or any workflow.

1. It launches headless Chromium through `@playwright/test` (honouring `PW_CHROMIUM_PATH`, as `playwright.config.ts` does) and opens a blank page.
2. For each wash, a seeded PRNG (mulberry32) builds a superellipse of 14 points that fills most of the canvas, each point with its own variance, and deforms it three times by splitting every edge at a Gaussian-jittered midpoint.
3. It paints three groups of 18 layers. Each group starts from a variant of the base and each layer deforms that variant three more times, then fills at 1.4% opacity. Every third layer also gets a faint 1.5 px stroke at 5% opacity, so pigment pools at the edge.
4. It lifts some pigment out in a grain pattern: an `feTurbulence` noise image, drawn with `destination-out` at 30% opacity.
5. The paper tile is `feTurbulence` noise in the `fg` colour with a low alpha, stitched so it repeats without seams.
6. It exports each canvas with `toDataURL("image/webp", q)` (0.5 for washes, 0.4 for grain) and writes `site/public/workflow/*.webp`.

Seeds, tints, sizes and opacities are constants at the top of the script, so a rerun on the same Chromium gives the same files.

### Output

| File | Size (px) | Tint |
| --- | --- | --- |
| `wash-spec.webp` | 320 × 240 | warm |
| `wash-plan.webp` | 320 × 240 | cool |
| `wash-build.webp` | 320 × 240 | cool |
| `wash-ci.webp` | 320 × 240 | green |
| `wash-review.webp` | 320 × 240 | cool |
| `wash-merge.webp` | 320 × 240 | warm |
| `wash-loop.webp` | 440 × 220 | cool |
| `paper.webp` | 160 × 160, repeated | grain |

Together they weigh 164,082 bytes (about 160 KB), under AC5's 200 KB. `site/tests/workflow.test.ts` checks the total and the file list.

### Tints (AC7)

Each wash tint is a theme token (ADR 0017) mixed toward white, then painted in thin layers, so the colour on the page is paler still. The tints live only inside the images: CSS may not use them, because the theme tests fail on any computed colour that is not a token.

| Tint | Hex | Derived from token | How |
| --- | --- | --- | --- |
| cool | `#5F9EE7` | `accent` (`#0969DA`) | 35% toward white, painted at 1.4% per layer |
| green | `#6AAC7D` | `success` (`#1A7F37`) | 35% toward white, painted at 1.4% per layer |
| warm | `#D38B59` | `highlight` (`#BC4C00`) | 35% toward white, painted at 1.4% per layer |
| grain | `#1F2328` | `fg` (`#1F2328`) | the token itself, at a noisy alpha of 0 to about 20% |

The warm wash marks the steps where Graham decides (Spec and Merge), the green wash marks CI, and the cool wash the agent steps and the loops.

## 2. Contrast: text never sits on a wash (AC6)

- Every step and loop card is an opaque `canvas` box with `fg` or `fg-muted` text and a 1px `border` outline.
- The wash is an `aria-hidden` `<span>` that is a sibling of the card inside its `<li>`, positioned behind it (`z-index: 0` under the card's `1`). It extends past the card by `--space-2` at the top and left and `--space-5` at the bottom and right, as if painted slightly off register. It is not a background on an ancestor of the text, and not a pseudo-element, so axe meets the card's opaque fill first and returns no `incomplete`.
- The paper grain is the background of `.flow-paper`, the wrapper around the two lists, behind the cards. The caption sits above it on the plain `canvas` page.
- Connectors and the loop mark are inline SVG with an `fg-muted` stroke, `aria-hidden`. The order they show is the list order.

## 3. Layout (AC4)

- The figure uses the main column's width. `.flow-paper` has `--space-5` padding, which holds the washes' outset, so neither the figure nor the page overflows.
- Below 40rem the steps and loops are one column, with arrows pointing down in the gaps. From 40rem the steps are a 3 + 3 grid and the loops a row of three; the arrow after the third step is hidden, because it would point off the grid. From 64rem the six steps are one row, with arrows pointing right.
- Grids use `minmax(0, 1fr)` and cards `overflow-wrap: anywhere`; nothing uses `overflow-x`. Card text is `0.875rem` and step and loop names `1rem`, so no text in the figure is under 14 px.
- Every margin, padding and gap is a `--space-*` value or 0 (ADR 0017). The washes' outset uses `inset`, not negative margins.
- Checked at 1280, 768 and 375 px: the figure's `scrollWidth` equals its `clientWidth`, it sits within `main`, the page doesn't scroll sideways, the 375 px cards stack, and axe `color-contrast` scoped to the figure returns no violations and no `incomplete` nodes.

## 4. Semantics (AC3)

- `<figure aria-labelledby="flow-heading">` with a `<figcaption>` holding the visible `<h2>` "How work flows" and one line linking to How we work and the decision log. There are no other links (non-goal).
- The steps are `<ol aria-label="Steps">`, one `<li>` per step. Each card has the step name as an `<h3>`, the owner line and the description, all as text.
- The loops are `<ul aria-label="Loops">`. Each card has the loop name as an `<h3>`, a "When:" line naming its trigger and a "Then:" line naming where the work returns.
- Washes and grain are CSS backgrounds on `aria-hidden` elements, so they have no alternative text to give.

## 5. Shared gates and content (AC1, AC2, AC8)

- `site/lib/gates.ts` exports `GATES` in order Spec, CI, Review, Merge. Each gate has `name`, `sentence` (the How we work sentence, unchanged), `adrs` (number and slug) and structured `approvers`: `{ kind: "graham" }`, `{ kind: "automation" }` or `{ kind: "agent", role }`, with `scope: "low-risk"` on Merge's automation approver.
- `site/app/how-we-work/page.tsx` renders the gate list from `GATES`. Its output is unchanged, and `site/e2e/how-we-work.spec.ts` passes untouched.
- `site/lib/workflow.ts` holds the six steps and three loops. The gate steps take their approvers from `GATES`; the spec writer, the tech lead, and the engineer and QA agents are extra diagram text added there. `formatOwners()` formats every owner line from the structured participants.
- `site/tests/workflow.test.ts` fails if the gate steps and `GATES` differ in name, order or approvers, and proves it with mutated copies of each side. It also checks the step names and order, the eight-word limit, the owner lines, that every loop has a trigger and targets that are steps or Graham, and the 200 KB image budget.

The content was checked against the workflows on main and ADRs 0006, 0008, 0009, 0015 and 0016.

| Step | Owner | Description |
| --- | --- | --- |
| Spec | Spec writer agent drafts; Graham approves | A brief becomes a spec with acceptance criteria. |
| Plan | Tech lead agent | Makes the technical choices and writes the issue. |
| Build | Engineer and QA agents | Code, unit and Playwright tests in one PR. |
| CI | Automation | Lint, types, unit tests, build and e2e pass. |
| Review | Code reviewer agent | A fresh-context review must pass. |
| Merge | Graham; automation for low-risk changes (ADR 0006) | Approved PRs merge into main. |

| Loop | When | Then |
| --- | --- | --- |
| A merge starts the next step (ADRs 0008, 0016) | A spec or build PR merges. | Plan starts for a merged spec, and Build for the spec's next issue. No one starts them by hand. |
| Fix agent (ADRs 0009, 0016) | Review asks for changes, CI fails, or the PR conflicts with main. | The fix agent pushes, so the PR goes back to CI. After two rounds for one reason, it goes to Graham. |
| Unblock round (ADR 0015) | A build opens no PR. | The tech lead gets one round, then the issue goes back to Build, or to Graham if it needs his decision. |

## Files

- `site/app/page.tsx`, `site/app/_components/workflow-diagram.tsx`
- `site/app/how-we-work/page.tsx`
- `site/app/globals.css` (the figure section)
- `site/lib/gates.ts`, `site/lib/workflow.ts`
- `site/scripts/workflow-washes/generate.ts`, `site/package.json` (the `washes` script)
- `site/public/workflow/*.webp`
- `site/tests/workflow.test.ts`
