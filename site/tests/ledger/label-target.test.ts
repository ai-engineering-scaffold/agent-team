import { describe, expect, it } from "vitest";
import { labelTarget, type LabelTargetInput } from "../../lib/ledger/label-target.ts";

// Spec 002 at $16.20 of a $15.00 budget, with nothing open.
function input(overrides: Partial<LabelTargetInput>): LabelTargetInput {
  return {
    spec: "002",
    totalCostMicros: 16_200_000,
    budgetUsd: 15,
    openPullRequests: [],
    openIssues: [],
    ...overrides,
  };
}

describe("AC6: the over-budget label goes on the spec's open PRs, else its lowest open issue", () => {
  it("labels every open PR on the spec's branches when the spec is over budget", () => {
    const target = labelTarget(
      input({
        openPullRequests: [
          { number: 41, branch: "spec-002/issue-22-over-budget-target" },
          { number: 30, branch: "chore/readme" },
          { number: 38, branch: "spec-002/issue-21-spend-line" },
        ],
        openIssues: [{ number: 22 }],
      }),
    );
    expect(target).toEqual({ kind: "pull-requests", numbers: [38, 41] });
  });

  it("labels the lowest-numbered open spec issue when the spec has no open PR", () => {
    const target = labelTarget(
      input({
        openPullRequests: [{ number: 30, branch: "chore/readme" }],
        openIssues: [{ number: 23 }, { number: 21 }, { number: 22 }],
      }),
    );
    expect(target).toEqual({ kind: "issue", number: 21 });
  });

  it("labels nothing, and says so for the job log, when there is neither", () => {
    expect(labelTarget(input({ openPullRequests: [{ number: 30, branch: "chore/readme" }] }))).toEqual({
      kind: "nothing",
      message:
        "Spec 002 is over budget, but it has no open PR on a spec-002/ branch and no open spec-002 issue, so nothing is labelled.",
    });
  });

  it("never labels the none group", () => {
    const target = labelTarget(
      input({
        spec: "none",
        budgetUsd: 15,
        openPullRequests: [{ number: 30, branch: "chore/readme" }],
        openIssues: [{ number: 5 }],
      }),
    );
    expect(target).toEqual({ kind: "nothing", message: "Spec none has no budget, so nothing is labelled." });
  });

  it("labels nothing when the spec is within budget", () => {
    const target = labelTarget(
      input({
        totalCostMicros: 4_250_000,
        openPullRequests: [{ number: 38, branch: "spec-002/issue-21-spend-line" }],
        openIssues: [{ number: 21 }],
      }),
    );
    expect(target).toEqual({
      kind: "nothing",
      message: "Spec 002 is within budget ($4.25 of $15.00), so nothing is labelled.",
    });
  });
});

describe("AC6: only branches of exactly this spec are picked", () => {
  const otherBranches = [
    { number: 50, branch: "spec-0021/issue-1-x" },
    { number: 51, branch: "spec-003/issue-30-y" },
    { number: 52, branch: "spec-002-typo/issue-2" },
    { number: 53, branch: "spec-002" },
    { number: 54, branch: "feature/spec-002/z" },
    { number: 55, branch: "SPEC-002/issue-3" },
  ];

  it("does not pick PRs on other specs' branches or branches that only share the digits", () => {
    expect(labelTarget(input({ openPullRequests: otherBranches }))).toMatchObject({ kind: "nothing" });
  });

  it("falls back to the spec's issue when only other specs' PRs are open", () => {
    expect(labelTarget(input({ openPullRequests: otherBranches, openIssues: [{ number: 22 }] }))).toEqual({
      kind: "issue",
      number: 22,
    });
  });

  it("picks this spec's PRs from among the others", () => {
    const target = labelTarget(
      input({ openPullRequests: [...otherBranches, { number: 40, branch: "spec-002/issue-22-a" }] }),
    );
    expect(target).toEqual({ kind: "pull-requests", numbers: [40] });
  });
});

describe("AC6: over budget means the same as in the spend line", () => {
  const open = { openPullRequests: [{ number: 40, branch: "spec-002/issue-22-a" }] };

  it("labels nothing at exactly the budget or less than a cent over", () => {
    expect(labelTarget(input({ ...open, totalCostMicros: 15_000_000 }))).toMatchObject({ kind: "nothing" });
    expect(labelTarget(input({ ...open, totalCostMicros: 15_004_000 }))).toMatchObject({ kind: "nothing" });
  });

  it("labels once the spec is a cent over", () => {
    expect(labelTarget(input({ ...open, totalCostMicros: 15_006_000 }))).toEqual({
      kind: "pull-requests",
      numbers: [40],
    });
  });

  it("labels nothing when the spec has no budget_usd", () => {
    expect(labelTarget(input({ ...open, budgetUsd: null }))).toEqual({
      kind: "nothing",
      message: "Spec 002 has no budget_usd, so nothing is labelled.",
    });
    expect(labelTarget(input({ ...open, budgetUsd: 0 }))).toMatchObject({ kind: "nothing" });
  });

  it("refuses a spec or total that is not valid", () => {
    expect(() => labelTarget(input({ spec: "2" }))).toThrow();
    expect(() => labelTarget(input({ spec: "../002" }))).toThrow();
    expect(() => labelTarget(input({ totalCostMicros: 0.5 }))).toThrow();
    expect(() => labelTarget(input({ totalCostMicros: -1 }))).toThrow();
  });
});
