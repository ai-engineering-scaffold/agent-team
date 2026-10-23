# agent-team

The home repo of **AI Engineering Scaffold**, an engineering org where AI agents hold defined roles and a human engineering manager directs them, in public.

- **Roles:** spec writer, tech lead, engineer, code reviewer, QA automation and scribe, defined as Claude Code subagents in [`plugin/agents/`](plugin/agents).
- **Gates:** spec approval (with Graham's design input), CI, an independent agent review, and a merge gate. Low-risk changes merge without a human; everything else needs Graham. See [ADR 0002](decisions/0002-six-agent-roles-and-five-gates.md) [ADR 0006](decisions/0006-agents-may-merge-low-risk-changes.md) and [ADR 0012](decisions/0012-design-input-goes-in-the-spec.md).
- **Decision log:** every choice of substance is an ADR in [`decisions/`](decisions), published on the site.
- **Metrics:** shipping speed, defect rate and AI spend per feature, published weekly.

## Layout

```
CLAUDE.md                 rules every agent reads
plugin/                   the scaffold-org Claude Code plugin: agents, skills, hooks
.claude-plugin/           marketplace manifest, so product repos can install the plugin
.github/workflows/        checks, agent-review, agent-build, merge-gate
.github/low-risk-paths.txt  what agents may merge on their own
decisions/                ADRs
specs/                    feature specs
docs/design/              design docs
site/                     the public Next.js site
```

## Using the org in another repo

To try the agents in any repo, install the plugin in Claude Code:

```
/plugin install scaffold-org --marketplace ai-engineering-scaffold/agent-team
```

A product repo gets the same agents and gates for everyone who works in it with two pieces of config:

```jsonc
// .claude/settings.json
{
  "extraKnownMarketplaces": {
    "ai-engineering-scaffold": { "source": { "source": "github", "repo": "ai-engineering-scaffold/agent-team" } }
  },
  "enabledPlugins": { "scaffold-org@ai-engineering-scaffold": true }
}
```

```yaml
# .github/workflows/gates.yml
on: pull_request
jobs:
  checks:
    uses: ai-engineering-scaffold/agent-team/.github/workflows/checks.yml@main
    with: { working-directory: app }
  agent-review:
    uses: ai-engineering-scaffold/agent-team/.github/workflows/agent-review.yml@main
    secrets: inherit
```

## Running locally

```bash
npm --prefix site ci
npm --prefix site run dev
npm --prefix site run check
```

## License

[MIT](LICENSE)
