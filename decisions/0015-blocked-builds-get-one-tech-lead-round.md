---
title: A blocked build gets one tech-lead round before it waits for Graham
status: proposed
date: 2026-10-23
decided_by: Proposed by Claude, requested by Graham
---

## Context

ADR 0008 labels an issue `blocked` when its build opens no PR, and the pipeline then skips it until Graham removes the label. On spec 004, issue #43 was blocked because planning had lost its Design section. The engineer asked for the design on the issue, correctly, and the spec stalled until someone wrote that section by hand. The missing piece was the tech lead's to decide (ADR 0012), so the wait for Graham added nothing. The next issue, #44, was blocked with no comment at all, because the action hides the agent's output and nothing recorded why the engineer stopped.

## Options considered

1. **Keep blocking for Graham.** Simple and safe, but every gap in an issue stops the spec until Graham reads it, even when he has nothing to decide.
2. **Let the planner change labels.** It runs once per spec, before any build, so it is never there when a build blocks. It would also be able to unblock work that is waiting on Graham.
3. **Send a blocked issue back to the tech lead once.** The tech lead fills in what is its to decide and the build retries, or it asks Graham the exact question. One round per issue, so a disagreement between the two agents can't loop.

## Decision

Option 3.

- When a build opens no PR, `agent-build` labels the issue `blocked` and comments with the agent's last message and any tool calls its permissions refused, so the reason is on the issue rather than in a hidden log. It then starts `agent-unblock`, unless the issue is labelled `unblock-tried`.
- `agent-unblock` labels the issue `unblock-tried` and runs the tech lead on it. The tech lead either rewrites the issue body to close the gap and says what changed, or comments with the question for Graham. It may edit only that issue's body.
- The workflow, not the agent, sets the labels. It removes `blocked` and restarts the pipeline only when the tech lead reports the issue resolved. Otherwise `blocked` stays and the issue waits for Graham.
- Scope, acceptance criteria, product and cost decisions, and changes to workflows, permissions or protected files always go to Graham.
- The round is recorded in the cost ledger as workflow `unblock`.

## Consequences

- A gap the tech lead can fill no longer waits for Graham, at the cost of one short tech-lead run and a second build attempt.
- An issue that blocks again after its round waits for Graham. To give it another round, he removes both `blocked` and `unblock-tried`.
- The blocked comment shows refused tool calls by tool and target only, so a missing permission is visible without exposing the agent's full output.
