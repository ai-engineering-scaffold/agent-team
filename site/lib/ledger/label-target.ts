// Which PRs or issue get the `over-budget` label after a run is recorded (spec 002, AC6).
// Pure: the record job lists open PRs and open `spec-NNN` issues, passes them in, and applies
// the label to whatever this returns. Applying and creating the label live in that job.
// Erasable syntax and relative `.ts` imports only, so Node's type stripping can run it too.
import { toMicros } from "./load.ts";

const SPEC_PATTERN = /^[0-9]{3}$/;

export interface OpenPullRequest {
  number: number;
  // The PR's head branch name, for example `spec-002/issue-22-over-budget-target`.
  branch: string;
}

export interface OpenIssue {
  number: number;
}

export interface LabelTargetInput {
  // A three-digit spec number, or "none".
  spec: string;
  // The spec's total after the new run, in micro-dollars, as in `SpecSummary`.
  totalCostMicros: number;
  budgetUsd: number | null;
  openPullRequests: readonly OpenPullRequest[];
  // Open issues labelled `spec-NNN` for this spec.
  openIssues: readonly OpenIssue[];
}

export type LabelTarget =
  | { kind: "pull-requests"; numbers: number[] }
  | { kind: "issue"; number: number }
  | { kind: "nothing"; message: string };

function dollars(micros: number): string {
  return `$${(micros / 1_000_000).toFixed(2)}`;
}

// Over budget by at least a whole cent, the same rule the spend line uses, so the label and
// the line never disagree. The /metrics page uses it too (spec 003, AC3).
export function isOverBudget(totalCostMicros: number, budgetUsd: number): boolean {
  return Math.round((totalCostMicros - toMicros(budgetUsd)) / 10_000) > 0;
}

export function labelTarget(input: LabelTargetInput): LabelTarget {
  const { spec, totalCostMicros, budgetUsd, openPullRequests, openIssues } = input;
  if (spec !== "none" && !SPEC_PATTERN.test(spec)) throw new Error("spec must be a three-digit string or none");
  if (!Number.isInteger(totalCostMicros) || totalCostMicros < 0) {
    throw new Error("total must be a non-negative integer of micro-dollars");
  }

  if (spec === "none") return { kind: "nothing", message: "Spec none has no budget, so nothing is labelled." };
  if (budgetUsd === null || !(Number.isFinite(budgetUsd) && budgetUsd > 0)) {
    return { kind: "nothing", message: `Spec ${spec} has no budget_usd, so nothing is labelled.` };
  }
  if (!isOverBudget(totalCostMicros, budgetUsd)) {
    return {
      kind: "nothing",
      message: `Spec ${spec} is within budget (${dollars(totalCostMicros)} of ${dollars(toMicros(budgetUsd))}), so nothing is labelled.`,
    };
  }

  // The trailing slash keeps `spec-0021/` and `spec-002-x/` out.
  const prefix = `spec-${spec}/`;
  const prs = openPullRequests
    .filter((pr) => pr.branch.startsWith(prefix))
    .map((pr) => pr.number)
    .sort((a, b) => a - b);
  if (prs.length > 0) return { kind: "pull-requests", numbers: prs };

  if (openIssues.length > 0) {
    return { kind: "issue", number: Math.min(...openIssues.map((issue) => issue.number)) };
  }

  return {
    kind: "nothing",
    message: `Spec ${spec} is over budget, but it has no open PR on a ${prefix} branch and no open spec-${spec} issue, so nothing is labelled.`,
  };
}
