import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadLedger, summarize, toMicros } from "../../lib/ledger/load.ts";
import type { LedgerRecord } from "../../lib/ledger/record.ts";

// Holds ledger/2026/{09,10}/*.json, laid out like the metrics branch.
const fixture = path.join(__dirname, "..", "fixtures", "ledger");

function record(spec: string, cost_usd: number | null): LedgerRecord {
  return {
    date: "2026-10-01T00:00:00Z",
    workflow: "review",
    spec,
    issue: null,
    pr: 1,
    cost_usd,
    turns: cost_usd === null ? null : 1,
    duration_s: 10,
    outcome: cost_usd === null ? "cancelled" : "success",
  };
}

const temps: string[] = [];
afterEach(async () => {
  await Promise.all(temps.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "ledger-load-"));
  temps.push(dir);
  return dir;
}

describe("AC4: the loader returns every record and per-spec totals", () => {
  it("returns every valid record in the fixture ledger, oldest first", async () => {
    const ledger = await loadLedger(fixture);
    expect(ledger.available).toBe(true);
    expect(ledger.records).toHaveLength(8);
    expect(ledger.records.map((r) => r.date)).toEqual([...ledger.records.map((r) => r.date)].sort());
    expect(ledger.records[0]).toEqual({
      date: "2026-09-30T09:00:00Z",
      workflow: "plan",
      spec: "001",
      issue: null,
      pr: null,
      cost_usd: 0.1,
      turns: 12,
      duration_s: 140,
      outcome: "success",
    });
  });

  it("leaves out files that fail validation, are not JSON, or are not .json", async () => {
    const ledger = await loadLedger(fixture);
    // 9001 has an extra "prompt" field and would add $5 to spec 001; 9002 is truncated JSON.
    expect(ledger.records.some((r) => r.pr === 32)).toBe(false);
    expect(ledger.specs.find((s) => s.spec === "001")?.runs).toBe(2);
  });

  it("totals cost, runs and no-cost runs per spec, with none as its own group last", async () => {
    const { specs } = await loadLedger(fixture);
    expect(specs).toEqual([
      { spec: "001", totalCostMicros: 300_000, totalCostUsd: 0.3, runs: 2, noCostRuns: 0 },
      { spec: "002", totalCostMicros: 1_300_000, totalCostUsd: 1.3, runs: 4, noCostRuns: 2 },
      { spec: "none", totalCostMicros: 700_000, totalCostUsd: 0.7, runs: 2, noCostRuns: 1 },
    ]);
  });

  it("sums money without floating-point drift", () => {
    expect(0.1 + 0.2).not.toBe(0.3);
    const [summary] = summarize([record("001", 0.1), record("001", 0.2)]);
    expect(summary.totalCostUsd).toBe(0.3);

    const many = summarize(Array.from({ length: 1000 }, () => record("003", 0.01)));
    expect(many[0].totalCostUsd).toBe(10);
    expect(many[0].totalCostMicros).toBe(10_000_000);
  });

  it("keeps sub-cent costs to the micro-dollar", () => {
    expect(toMicros(0.000001)).toBe(1);
    expect(toMicros(1.234567)).toBe(1_234_567);
    const [summary] = summarize([record("004", 0.0049), record("004", 0.0051), record("004", null)]);
    expect(summary).toEqual({ spec: "004", totalCostMicros: 10_000, totalCostUsd: 0.01, runs: 3, noCostRuns: 1 });
  });

  it("reports an unavailable ledger, distinct from an empty one, when the folder is missing", async () => {
    const dir = await tempDir();
    await expect(loadLedger(path.join(dir, "does-not-exist"))).resolves.toEqual({
      available: false,
      records: [],
      specs: [],
    });
    // The tarball unpacked but holds no ledger/ folder.
    await expect(loadLedger(dir)).resolves.toEqual({ available: false, records: [], specs: [] });
  });

  it("returns an available ledger with no records when the ledger folder is empty", async () => {
    const dir = await tempDir();
    await mkdir(path.join(dir, "ledger", "2026", "10"), { recursive: true });
    await expect(loadLedger(dir)).resolves.toEqual({ available: true, records: [], specs: [] });
  });
});
