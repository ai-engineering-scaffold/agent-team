// The build-time ledger loader (spec 002, AC4). The `prebuild` script
// (scripts/ledger/fetch.mjs) unpacks the `metrics` branch into `site/.ledger/`, so records sit
// at `.ledger/ledger/YYYY/MM/*.json`. Erasable syntax and relative `.ts` imports only, so Node's
// type stripping can run it too (design 002, section 3).
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { validateRecord, type LedgerRecord } from "./record.ts";

// Read only at build time, from the `site/` directory the build runs in.
export const LEDGER_DIR = path.join(process.cwd(), ".ledger");

export interface SpecSummary {
  // A three-digit spec number, or "none".
  spec: string;
  // Integer micro-dollars, so totals never drift; convert with `totalCostUsd`.
  totalCostMicros: number;
  totalCostUsd: number;
  runs: number;
  // Runs whose agent reported no result, so `cost_usd` is null.
  noCostRuns: number;
}

export interface Ledger {
  // False when there is no ledger to read (the fetch was skipped or failed), which is not
  // the same as a ledger with no runs in it.
  available: boolean;
  records: LedgerRecord[];
  specs: SpecSummary[];
}

const MICROS_PER_USD = 1_000_000;

export function toMicros(usd: number): number {
  return Math.round(usd * MICROS_PER_USD);
}

async function isDirectory(dir: string): Promise<boolean> {
  try {
    return (await stat(/* turbopackIgnore: true */ dir)).isDirectory();
  } catch {
    return false;
  }
}

// Walks real directories only; symlinks are skipped so a record can't point outside the ledger.
async function jsonFiles(dir: string): Promise<string[]> {
  const entries = await readdir(/* turbopackIgnore: true */ dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const full = path.join(/* turbopackIgnore: true */ dir, entry.name);
      if (entry.isDirectory()) return jsonFiles(full);
      if (entry.isFile() && entry.name.endsWith(".json")) return [full];
      return [];
    }),
  );
  return nested.flat();
}

async function readRecord(file: string): Promise<LedgerRecord | null> {
  try {
    const checked = validateRecord(JSON.parse(await readFile(/* turbopackIgnore: true */ file, "utf8")));
    return checked.ok ? checked.record : null;
  } catch {
    return null;
  }
}

// Spec numbers in order, with "none" as its own group at the end.
function compareSpecs(a: string, b: string): number {
  if (a === b) return 0;
  if (a === "none") return 1;
  if (b === "none") return -1;
  return a < b ? -1 : 1;
}

export function summarize(records: readonly LedgerRecord[]): SpecSummary[] {
  const bySpec = new Map<string, SpecSummary>();
  for (const record of records) {
    let summary = bySpec.get(record.spec);
    if (!summary) {
      summary = { spec: record.spec, totalCostMicros: 0, totalCostUsd: 0, runs: 0, noCostRuns: 0 };
      bySpec.set(record.spec, summary);
    }
    summary.runs += 1;
    if (record.cost_usd === null) summary.noCostRuns += 1;
    else summary.totalCostMicros += toMicros(record.cost_usd);
  }
  const specs = [...bySpec.values()].sort((a, b) => compareSpecs(a.spec, b.spec));
  for (const summary of specs) summary.totalCostUsd = summary.totalCostMicros / MICROS_PER_USD;
  return specs;
}

// Never throws: a missing ledger is `available: false`, and files that aren't valid records
// (bad JSON, extra fields, wrong types) are left out.
export async function loadLedger(dir = LEDGER_DIR): Promise<Ledger> {
  const ledgerDir = path.join(/* turbopackIgnore: true */ dir, "ledger");
  if (!(await isDirectory(ledgerDir))) return { available: false, records: [], specs: [] };

  let files: string[];
  try {
    files = (await jsonFiles(ledgerDir)).sort();
  } catch {
    return { available: false, records: [], specs: [] };
  }

  const records = (await Promise.all(files.map(readRecord))).filter((r): r is LedgerRecord => r !== null);
  // Oldest first; the sort is stable, so runs with the same start keep file order.
  records.sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  return { available: true, records, specs: summarize(records) };
}
