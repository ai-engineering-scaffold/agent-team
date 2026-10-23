---
title: The repository is public from day one
status: accepted
date: 2026-10-22
decided_by: Graham
---

## Context

The org exists partly to show how AI-native engineering is directed. A repository opened only after setup would hide the most instructive part: the early mistakes and course corrections.

## Options considered

1. **Private until the first feature ships.** Lets us tidy up first, but loses the record of the setup.
2. **Public from the first commit.** The build-up becomes part of the story.

## Decision

Public from the first commit.

## Consequences

- Secrets live only in GitHub Actions secrets, and agent workflows never run with secrets on pull requests from forks.
- Nothing from any previous employer, client or private work enters this repository.
