---
title: Paint the homepage workflow diagram's watercolor washes once with a committed Node script in Playwright's Chromium
status: proposed
date: 2026-10-24
decided_by: Proposed by tech-lead agent, approved by Graham
---

## Context

Spec 006 adds a "How work flows" figure to the homepage: six steps and three loops as real text, with soft watercolor washes and paper texture behind them. Graham asked for a watercolor look, "maybe ... with OpenCV or another tool that will work well", and left the technique to the tech lead, who chose it in issue #59. The images must be served from this site and weigh at most 200 KB in total; any generator must be committed with its output and run by hand or on the existing Node toolchain, never in the visitor's browser (AC5). No text may sit on a wash, and axe must return no `incomplete` contrast result in the figure (AC6). The base colours and fonts are ADR 0017's tokens, and any wash tint must be listed here with the token it derives from (AC7). The design doc is `docs/design/006-homepage-workflow-diagram.md`.

## Options considered

1. **OpenCV, run once by hand (for example `cv2.stylization` over painted shapes).** Graham's suggestion. `opencv-python` is Apache 2.0, but it is a Python toolchain outside the repo's Node setup, so an agent rebuilding the textures would need `pip install`, which the build agent may not be allowed to run. Its filters are edge-preserving smoothing: they soften flat shapes but add no pigment pooling or bleed on their own, and the input shapes would still need painting some other way.
2. **Live SVG filters in the page (`feTurbulence` and `feDisplacementMap`).** No image bytes, and it reflows with any layout. But the filter runs in the visitor's browser on every paint, which is slow on phones and looks different per engine, and filtered layers near text make axe return `incomplete` for `color-contrast`.
3. **Hand-made or stock textures under a free commercial licence.** Can look good, but we would have to find a source and track its licence, and they can't be tuned to the token tints or regenerated.
4. **A committed Node script that paints the washes in the Chromium Playwright already installs, run once by hand, with WebP output committed.** Each wash is a seeded, noise-deformed polygon painted as many low-opacity layers (the layered-polygon watercolor technique), with faint strokes for pooled edges and an `feTurbulence` grain lift. No new dependency or tool, deterministic per seed, and the visitor's browser only shows static images. It needs Chromium to rerun, which the dev setup and CI already have.

## Decision

Option 4.

- **Script.** `site/scripts/workflow-washes/generate.ts`, run with `npm --prefix site run washes`. Node 22 strips its types. It launches `chromium` from `@playwright/test` (or `PW_CHROMIUM_PATH`), paints each wash on a canvas, and writes WebP files from `canvas.toDataURL("image/webp", q)` to `site/public/workflow/`. Seeds, tints, sizes and opacities are constants at its top. It is not part of `build`, `prebuild`, `check` or any workflow.
- **Output.** Seven washes (one per step and one for the loops, 320 × 240 or 440 × 220 px) and one 160 px paper tile, 164,082 bytes in total. `site/tests/workflow.test.ts` fails if the folder goes over 200 KB.
- **Tints.** Three wash tints and the grain, each from an ADR 0017 token. They live only inside the images; CSS uses tokens only.

| Tint | Hex | Derived from token | How |
| --- | --- | --- | --- |
| cool | `#5F9EE7` | `accent` (`#0969DA`) | 35% toward white, painted at 1.4% per layer |
| green | `#6AAC7D` | `success` (`#1A7F37`) | 35% toward white, painted at 1.4% per layer |
| warm | `#D38B59` | `highlight` (`#BC4C00`) | 35% toward white, painted at 1.4% per layer |
| grain | `#1F2328` | `fg` (`#1F2328`) | the token itself, at a noisy alpha of 0 to about 20% |

- **No text on a wash.** Every card is an opaque `canvas` box with `fg` or `fg-muted` text and a 1px `border`. The wash is an `aria-hidden` sibling element behind the card, never a background on an ancestor of the text or a pseudo-element. The paper grain is the background of the wrapper around the lists, behind the cards.
- **Licences.** The script, the images and the technique are ours, under this repo's licence. The only tools are Node 22 (MIT), `@playwright/test` (Apache 2.0, already a dev dependency) and the Chromium build it installs (BSD-3-Clause, used only to paint). No third-party image, texture or font is used.

## Consequences

- The washes cost about 160 KB, loaded only on the homepage, and no work in the visitor's browser beyond showing images.
- Changing a wash means editing the script's constants, running it by hand and committing the new files. The images can differ slightly between Chromium versions, so a rerun after a Playwright upgrade may change bytes but not the look.
- A new wash tint must come from a token and be added to this table, or need a new ADR.
- Graham's OpenCV suggestion is not used: it adds a Python toolchain and still needs painted input shapes. Revisit if the washes need effects a canvas can't paint, or if the images grow toward the 200 KB budget.
