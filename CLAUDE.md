# AI Engineering Scaffold: agent-team

This is the home repo of an AI-native engineering org that runs in public. Agents hold defined roles; Graham (GitHub `GSchill25`) is the engineering manager. Everything here is public, so write every file, comment and commit as if a hiring manager will read it.

## How work flows

1. **Spec** (`spec-writer`): a brief becomes `specs/NNN-name.md`. Graham approves it (gate 1).
   Graham gives any design input in the spec's "Design input" section.
2. **Plan** (`tech-lead`): makes any real technical choice and writes it into the first issue. Work is sliced into one-PR issues. There is no design gate (ADR 0012).
3. **Build** (`engineer`, then `qa-automation`): code, unit tests, Playwright tests from the spec's criteria, one PR per issue. The first PR adds the design doc and proposed ADR when the issue has a design.
4. **CI** (gate 2): `site` and `e2e` checks must pass.
5. **Review** (`code-reviewer`, gate 3): a fresh-context review that must return PASS.
6. **Merge** (gate 4): Graham merges, except low-risk PRs that only touch paths in `.github/low-risk-paths.txt`, which auto-merge.

The roles, skills and hooks live in `plugin/` (the `scaffold-org` plugin). Decisions behind all of this are in `decisions/`.

## Definition of done

- `npm --prefix site run check` passes (lint, typecheck, unit tests, ADR validation).
- Every acceptance criterion the change covers has a Playwright test in `site/e2e/`, named after the criterion.
- The PR follows the template, links its issue and spec, and names any new dependency and why.
- Any decision of substance has an ADR.

## Conventions

- TypeScript everywhere. Next.js App Router in `site/`; the site is fully static, built from Markdown in this repo.
- Read `site/AGENTS.md` before changing Next.js code: this Next.js version differs from older training data.
- The site has structure only. Do not add visual design until Graham provides the theme.
- Locate elements in tests by role and visible text, never by CSS class.
- Branches: `spec-NNN/short-name` for spec work, `chore/short-name` otherwise.
- Commit messages: imperative, under 72 characters in the subject.

## Never

- Commit secrets or read `.env` files.
- Edit `.github/workflows/`, `.github/low-risk-paths.txt`, `.github/CODEOWNERS` or `plugin/hooks/` as an agent. Propose the change in a PR description instead.
- Mark an ADR `accepted`, or edit an accepted ADR's decision. Supersede it with a new one.
- Skip, weaken or delete a test to get CI green.
- Include anything from any employer, client or private project other than this one.
- Use product data that is not free and licensed for commercial use.

## Commands

```bash
npm --prefix site ci              # install
npm --prefix site run dev         # local site on :3000
npm --prefix site run check       # lint, types, unit tests
npm --prefix site run build       # static build
npm --prefix site run test:e2e    # Playwright against a local production build
```
