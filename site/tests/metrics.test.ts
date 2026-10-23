// Spec 003. A static build holds one ledger, so the states the e2e fixture build can't show
// are checked here against the page's state function (design 003, ADR 0013).
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadLedger, summarize, type SpecSummary } from "../lib/ledger/load.ts";
import type { LedgerRecord } from "../lib/ledger/record.ts";
import {
  budgetStatus,
  EMPTY_MESSAGE,
  formatBudget,
  formatSpend,
  formatUtc,
  metricsPageState,
  newestRun,
  NOT_RECORDED,
  OVER_BUDGET,
  spendBySpecRows,
  UNAVAILABLE_MESSAGE,
  WITHIN_BUDGET,
} from "../lib/metrics.ts";
import { listSpecs, type SpecInfo } from "../lib/specs.ts";

// The ledger the e2e build copies into `.ledger/` (see its README.txt).
const e2eFixture = path.join(__dirname, "..", "e2e", "fixtures", "ledger");

function run(date: string, cost_usd: number | null = 1): LedgerRecord {
  return {
    date,
    workflow: "build",
    spec: "003",
    issue: 34,
    pr: 35,
    cost_usd,
    turns: cost_usd === null ? null : 3,
    duration_s: 60,
    outcome: cost_usd === null ? "cancelled" : "success",
  };
}

describe("AC5: the page says why there is nothing to show", () => {
  it("AC5: an unreadable ledger is unavailable, not empty, and says so", () => {
    expect(metricsPageState({ available: false, records: [] })).toEqual({ kind: "unavailable" });
    expect(UNAVAILABLE_MESSAGE).toBe("Spend data is unavailable for this build.");
  });

  it("AC5: an unavailable ledger stays unavailable even if records were passed", () => {
    expect(metricsPageState({ available: false, records: [run("2026-10-21T14:05:00Z")] }).kind).toBe("unavailable");
  });

  it("AC5: an empty ledger says no runs are recorded yet", () => {
    expect(metricsPageState({ available: true, records: [] })).toEqual({ kind: "empty" });
    expect(EMPTY_MESSAGE).toBe("No agent runs recorded yet.");
  });
});

describe("AC6: the page states when its newest run was", () => {
  it("AC6: the freshness line is left out when the ledger is unavailable or empty", () => {
    for (const ledger of [
      { available: false, records: [] },
      { available: true, records: [] },
    ]) {
      expect(metricsPageState(ledger)).not.toHaveProperty("newestRun");
    }
  });

  it("AC6: a ledger with runs gives the newest run, whatever the record order", () => {
    const records = [run("2026-10-20T09:00:00Z"), run("2026-10-21T14:05:00Z", null), run("2026-09-01T10:00:00Z")];
    expect(metricsPageState({ available: true, records })).toEqual({
      kind: "ready",
      newestRun: "2026-10-21T14:05:00Z",
    });
    expect(newestRun([])).toBeNull();
  });

  it("AC6: the newest run is shown as a UTC date and time", () => {
    expect(formatUtc("2026-10-21T14:05:00Z")).toBe("2026-10-21 14:05 UTC");
    expect(formatUtc("2026-10-21T23:59:59.900Z")).toBe("2026-10-21 23:59 UTC");
    expect(() => formatUtc("not a date")).toThrow(/invalid timestamp/);
  });
});

describe("the e2e fixture ledger", () => {
  it("holds only valid records, newest at 2026-10-21T14:05:00Z, a Wednesday", async () => {
    const ledger = await loadLedger(e2eFixture);
    expect(ledger.records).toHaveLength(13);
    expect(metricsPageState(ledger)).toEqual({ kind: "ready", newestRun: "2026-10-21T14:05:00Z" });
    expect(new Date("2026-10-21T14:05:00Z").getUTCDay()).toBe(3);
  });

  it("matches the per-spec totals its README promises", async () => {
    const { specs } = await loadLedger(e2eFixture);
    expect(specs.map((s) => [s.spec, s.totalCostUsd, s.runs, s.noCostRuns])).toEqual([
      ["002", 16.1, 5, 1],
      ["003", 6.95, 4, 0],
      ["999", 2.95, 2, 0],
      ["none", 0.75, 2, 0],
    ]);
  });
});

function summary(spec: string, totalCostMicros: number, runs: number, noCostRuns = 0): SpecSummary {
  return { spec, totalCostMicros, totalCostUsd: totalCostMicros / 1_000_000, runs, noCostRuns };
}

const SPECS: SpecInfo[] = [
  { number: "003", title: "Metrics page", budgetUsd: 15 },
  { number: "001", title: "How we work page", budgetUsd: 15 },
  { number: "002", title: "Cost and cycle-time ledger", budgetUsd: 15 },
];

describe("AC2: the Spend by spec rows", () => {
  it("AC2: spec files come first in spec order, then unknown specs in number order, then Chores last", () => {
    const rows = spendBySpecRows(
      [summary("002", 1_000_000, 1), summary("999", 2_000_000, 1), summary("none", 500_000, 1), summary("004", 1, 1)],
      SPECS,
    );
    expect(rows.map((r) => [r.kind, r.label])).toEqual([
      ["spec", "001"],
      ["spec", "002"],
      ["spec", "003"],
      ["unknown", "Unknown spec 004"],
      ["unknown", "Unknown spec 999"],
      ["chores", "Chores"],
    ]);
    expect(rows[1]).toMatchObject({ title: "Cost and cycle-time ledger", budgetUsd: 15, runs: 1 });
  });

  it("AC2: a ledger spec with no spec file keeps its spend and has no title or budget", () => {
    const [unknown] = spendBySpecRows([summary("999", 2_950_000, 2)], []);
    expect(unknown).toMatchObject({ label: "Unknown spec 999", title: null, budgetUsd: null, runs: 2, overBudget: false });
    expect(formatSpend(unknown)).toBe("$2.95");
    expect(formatBudget(unknown)).toBe("None");
    expect(budgetStatus(unknown)).toBe("");
  });

  it("AC2: Chores is shown with no budget even when there are no chore runs", () => {
    const rows = spendBySpecRows([summary("001", 1_000_000, 1)], SPECS);
    const chores = rows.at(-1)!;
    expect(chores).toMatchObject({ kind: "chores", spec: "none", budgetUsd: null, runs: 0, noCostRuns: 0 });
    expect(formatSpend(chores)).toBe(NOT_RECORDED);
    expect(formatBudget(chores)).toBe("None");
    expect(spendBySpecRows([], []).map((r) => r.label)).toEqual(["Chores"]);
  });

  it("AC2: runs with a null cost count as runs and as no-cost runs, but add no spend", () => {
    const records: LedgerRecord[] = [
      { ...run("2026-10-20T09:00:00Z", 1.25), spec: "002" },
      { ...run("2026-10-21T09:00:00Z", null), spec: "002" },
    ];
    const row = spendBySpecRows(summarize(records), SPECS).find((r) => r.spec === "002")!;
    expect(row).toMatchObject({ totalCostMicros: 1_250_000, runs: 2, noCostRuns: 1 });
    expect(formatSpend(row)).toBe("$1.25");

    const onlyNull = spendBySpecRows(summarize([{ ...run("2026-10-21T09:00:00Z", null), spec: "002" }]), SPECS)[1];
    expect(onlyNull).toMatchObject({ runs: 1, noCostRuns: 1 });
    // A run was recorded, so the row says $0.00 rather than "Not recorded".
    expect(formatSpend(onlyNull)).toBe("$0.00");
  });

  it("AC2: spend and budget are shown in US dollars to the cent", () => {
    expect(formatSpend({ runs: 5, totalCostMicros: 16_100_000 })).toBe("$16.10");
    expect(formatSpend({ runs: 1, totalCostMicros: 1_234_567 })).toBe("$1.23");
    expect(formatBudget({ budgetUsd: 15 })).toBe("$15.00");
    expect(formatBudget({ budgetUsd: 12.5 })).toBe("$12.50");
  });
});

describe("AC3: over budget and not recorded", () => {
  it("AC3: a spec with no runs says Not recorded, not $0.00", () => {
    const [first] = spendBySpecRows([], SPECS);
    expect(first).toMatchObject({ spec: "001", runs: 0, overBudget: false });
    expect(formatSpend(first)).toBe("Not recorded");
    expect(budgetStatus(first)).toBe("");
  });

  it("AC3: a spec over its budget by a whole cent or more says Over budget", () => {
    const row = spendBySpecRows([summary("002", 16_100_000, 5, 1)], SPECS)[1];
    expect(row.overBudget).toBe(true);
    expect(budgetStatus(row)).toBe("Over budget");
    expect(OVER_BUDGET).toBe("Over budget");
    expect(spendBySpecRows([summary("002", 15_010_000, 1)], SPECS)[1].overBudget).toBe(true);
  });

  it("AC3: a spec over by less than a cent is not over budget, matching the label and spend line", () => {
    for (const micros of [15_000_000, 15_000_001, 15_004_999]) {
      const row = spendBySpecRows([summary("003", micros, 1)], SPECS)[2];
      expect(row.overBudget, `${micros} micro-dollars`).toBe(false);
      expect(budgetStatus(row)).toBe(WITHIN_BUDGET);
    }
    // $15.005 rounds to a whole cent over, the same as label-target.ts.
    expect(spendBySpecRows([summary("003", 15_005_000, 1)], SPECS)[2].overBudget).toBe(true);
  });

  it("AC3: a spec with no budget is never over budget", () => {
    const rows = spendBySpecRows([summary("004", 99_000_000, 1)], [{ number: "004", title: "No budget", budgetUsd: null }]);
    expect(rows[0].overBudget).toBe(false);
    expect(budgetStatus(rows[0])).toBe("");
  });
});

describe("listSpecs", () => {
  const fixtures = path.join(__dirname, "fixtures");

  it("lists NNN-*.md files in spec order with title and budget, skipping README.md", async () => {
    expect(await listSpecs(path.join(fixtures, "spec-list"))).toEqual([
      { number: "001", title: "First fixture spec", budgetUsd: 12.5 },
      { number: "002", title: "Second fixture spec", budgetUsd: null },
    ]);
  });

  it("refuses two spec files with the same number, since their spend can't be told apart", async () => {
    // The spend-line fixtures have 104-first.md and 104-second.md.
    await expect(listSpecs(path.join(fixtures, "specs"))).rejects.toThrow(/more than one spec file is numbered 104/);
  });

  it("reads the real specs folder, which includes specs 001 to 003", async () => {
    const specs = await listSpecs(path.join(__dirname, "..", "..", "specs"));
    expect(specs.slice(0, 3).map((s) => s.number)).toEqual(["001", "002", "003"]);
    expect(specs[2]).toMatchObject({ title: "Metrics page", budgetUsd: 15 });
  });
});
