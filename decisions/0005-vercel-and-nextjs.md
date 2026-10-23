---
title: Host on Vercel, build the site with Next.js
status: accepted
date: 2026-10-22
decided_by: Graham
---

## Context

The org's first product is its own public site: the decision log, design docs and metrics page. It needs preview deploys per PR so QA can test what will ship.

## Options considered

1. **Cloudflare Pages and Astro.** Lightest for a content site.
2. **Vercel and Next.js.** Graham knows both well; preview deploys per PR come built in.

## Decision

Vercel and Next.js (App Router), in TypeScript. The site reads Markdown from the repo at build time.

## Consequences

- Graham's familiarity makes Graham's reviews faster, which matters more than raw build size.
- The site stays unstyled beyond basic structure until Graham provides a design theme.
