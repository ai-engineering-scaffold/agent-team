// Applies `over-budget` after a run is recorded (spec 002, AC6; design 002, section 5).
// Labelling must never fail the job, so every error is logged as a warning and it exits 0.
//
//   node label-over-budget.ts --spec <NNN|none> --ledger <dir>
import { parseArgs } from "node:util";
import { labelTarget, type OpenIssue, type OpenPullRequest } from "../../lib/ledger/label-target.ts";
import { loadLedger } from "../../lib/ledger/load.ts";
import { readBudgetUsd, summaryFor } from "../../lib/ledger/spend-line.ts";
import { defaultDeps, isMain, message, required, type Deps, type Env } from "./cli.ts";

export const LABEL = "over-budget";

export function parseLabelArgs(argv: string[]): { spec: string; ledger: string } {
  const { values } = parseArgs({ args: argv, options: { spec: { type: "string" }, ledger: { type: "string" } } });
  const spec = values.spec ?? "";
  if (spec !== "none" && !/^[0-9]{3}$/.test(spec)) throw new Error("--spec must be three digits or none");
  if (!values.ledger) throw new Error("--ledger is required");
  return { spec, ledger: values.ledger };
}

async function openWork(repo: string, spec: string, deps: Deps): Promise<{ prs: OpenPullRequest[]; issues: OpenIssue[] }> {
  if (spec === "none") return { prs: [], issues: [] };
  const prs = JSON.parse(
    await deps.gh(["pr", "list", "--repo", repo, "--state", "open", "--limit", "500", "--json", "number,headRefName"]),
  ) as { number: number; headRefName: string }[];
  const issues = JSON.parse(
    await deps.gh(["issue", "list", "--repo", repo, "--state", "open", "--label", `spec-${spec}`, "--limit", "500", "--json", "number"]),
  ) as OpenIssue[];
  return { prs: prs.map((p) => ({ number: p.number, branch: p.headRefName })), issues };
}

export async function labelOverBudget(argv: string[], env: Env = process.env, deps: Deps = defaultDeps, specsDir?: string): Promise<0> {
  try {
    const { spec, ledger } = parseLabelArgs(argv);
    const repo = required(env, "GITHUB_REPOSITORY");
    const summary = summaryFor((await loadLedger(ledger)).records, spec);
    const budgetUsd = spec === "none" ? null : await readBudgetUsd(spec, specsDir);
    const { prs, issues } = await openWork(repo, spec, deps);
    const target = labelTarget({
      spec,
      totalCostMicros: summary.totalCostMicros,
      budgetUsd,
      openPullRequests: prs,
      openIssues: issues,
    });
    if (target.kind === "nothing") {
      deps.log(target.message);
      return 0;
    }

    try {
      await deps.gh(["label", "create", LABEL, "--repo", repo, "--color", "D93F0B", "--description", "The spec has spent more than its budget_usd"]);
    } catch (error) {
      deps.log(`Did not create the ${LABEL} label (it may already exist): ${message(error)}`);
    }
    for (const n of target.kind === "issue" ? [target.number] : target.numbers) {
      try {
        await deps.gh(["api", "--method", "POST", `repos/${repo}/issues/${n}/labels`, "-f", `labels[]=${LABEL}`]);
        deps.log(`Spec ${spec} is over budget, so #${n} is labelled ${LABEL}.`);
      } catch (error) {
        deps.log(`::warning::Could not label #${n} ${LABEL}: ${message(error)}`);
      }
    }
  } catch (error) {
    deps.log(`::warning::Skipped the ${LABEL} label: ${message(error)}`);
  }
  return 0;
}

if (isMain(import.meta.url)) {
  process.exitCode = await labelOverBudget(process.argv.slice(2));
}
