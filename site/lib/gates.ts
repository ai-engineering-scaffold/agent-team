// The gates work passes, in order, before it ships (ADR 0002, with the Design gate removed by
// ADR 0012). Gates change only through an ADR. The How we work page renders this list, and the
// homepage workflow diagram (spec 006) reads its gate approvers from it, so the two can't drift.

/** Who approves a gate. `scope` narrows an approver to part of the work: low-risk PRs (ADR 0006). */
export type Approver =
  | { kind: "graham"; scope?: "low-risk" }
  | { kind: "automation"; scope?: "low-risk" }
  | { kind: "agent"; role: string; scope?: "low-risk" };

/** A link to an ADR page: its number and its slug under /decisions. */
export type AdrRef = { number: number; slug: string };

export type Gate = {
  name: string;
  /** The How we work page's sentence for this gate. Its e2e test asserts these words. */
  sentence: string;
  /** ADRs the gate links to, in order. */
  adrs: readonly AdrRef[];
  approvers: readonly Approver[];
};

const ADR_0002: AdrRef = { number: 2, slug: "0002-six-agent-roles-and-five-gates" };
const ADR_0006: AdrRef = { number: 6, slug: "0006-agents-may-merge-low-risk-changes" };

export const GATES: readonly Gate[] = [
  {
    name: "Spec",
    sentence: "Graham approves the spec, including his design input.",
    adrs: [ADR_0002],
    approvers: [{ kind: "graham" }],
  },
  {
    name: "CI",
    sentence: "Lint, types, unit tests, build and Playwright pass as required checks.",
    adrs: [ADR_0002],
    approvers: [{ kind: "automation" }],
  },
  {
    name: "Review",
    sentence: "The reviewer agent finds no blocking issues.",
    adrs: [ADR_0002],
    approvers: [{ kind: "agent", role: "code-reviewer" }],
  },
  {
    name: "Merge",
    sentence: "Graham merges, except for low-risk changes.",
    adrs: [ADR_0002, ADR_0006],
    approvers: [{ kind: "graham" }, { kind: "automation", scope: "low-risk" }],
  },
];

/** "ADR 0006" */
export function adrLabel(adr: AdrRef): string {
  return `ADR ${String(adr.number).padStart(4, "0")}`;
}
