// Spec 003. A static build holds one ledger, so the states the e2e fixture build can't show
// are checked here against the page's state function (design 003, ADR 0013).
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadLedger } from "../lib/ledger/load.ts";
import type { LedgerRecord } from "../lib/ledger/record.ts";
import { EMPTY_MESSAGE, formatUtc, metricsPageState, newestRun, UNAVAILABLE_MESSAGE } from "../lib/metrics.ts";

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
