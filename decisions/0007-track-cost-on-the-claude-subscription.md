---
title: Run agents on Graham's Claude subscription to start
status: accepted
date: 2026-10-22
decided_by: Graham
---

## Context

The weekly metrics page reports AI spend per feature. That could come from a dedicated, metered API key, or from Graham's existing Claude subscription.

## Options considered

1. **Dedicated API key with a workspace spend limit.** Exact dollars per run; a second bill.
2. **Existing Claude subscription.** No new bill. Claude Code still reports tokens per run, so spend can be shown as an API-equivalent figure.

## Decision

Start on the subscription. The GitHub workflows authenticate with a token from `claude setup-token`, stored as the `CLAUDE_CODE_OAUTH_TOKEN` secret. Spend per feature is reported as API-equivalent dollars, with the plan fee as the real monthly total.

## Consequences

- The cap is the plan's usage allowance, not a dollar limit.
- If CI agents start hitting plan limits, switch to an API key. That is a secret swap and a new ADR; nothing else changes.
