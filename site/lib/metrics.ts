// What the /metrics page shows for a given ledger (spec 003). Pure, so the states a single
// static build can't show (AC5, and AC6's freshness line in those states) are unit-tested
// against this module rather than in Playwright (design 003).
import { isOverBudget } from "./ledger/label-target.ts";
import { toMicros, type Ledger, type SpecSummary } from "./ledger/load.ts";
import type { LedgerRecord } from "./ledger/record.ts";
import type { SpecInfo } from "./specs.ts";

// Shared by the page and its tests, so both check the same words.
export const UNAVAILABLE_MESSAGE = "Spend data is unavailable for this build.";
export const EMPTY_MESSAGE = "No agent runs recorded yet.";

export type MetricsPageState =
  | { kind: "unavailable" }
  | { kind: "empty" }
  // `newestRun` is the ISO timestamp of the newest run included.
  | { kind: "ready"; newestRun: string };

// The ISO `date` of the newest record, or null for no records. Doesn't rely on the loader's order.
export function newestRun(records: readonly Pick<LedgerRecord, "date">[]): string | null {
  let newest: string | null = null;
  for (const { date } of records) {
    if (newest === null || Date.parse(date) > Date.parse(newest)) newest = date;
  }
  return newest;
}

// A failed or skipped download (`available: false`) is never shown as an empty ledger, so it
// can't read as $0 (AC5).
export function metricsPageState(ledger: Pick<Ledger, "available" | "records">): MetricsPageState {
  if (!ledger.available) return { kind: "unavailable" };
  const newest = newestRun(ledger.records);
  if (newest === null) return { kind: "empty" };
  return { kind: "ready", newestRun: newest };
}

// "2026-10-21 14:05 UTC". Always UTC, whatever the build machine's time zone.
export function formatUtc(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) throw new Error(`invalid timestamp: ${iso}`);
  const text = new Date(ms).toISOString();
  return `${text.slice(0, 10)} ${text.slice(11, 16)} UTC`;
}

export const NOT_RECORDED = "Not recorded";
export const OVER_BUDGET = "Over budget";
export const WITHIN_BUDGET = "Within budget";

// One row of the "Spend by spec" table (AC2, AC3).
export interface SpendRow {
  kind: "spec" | "unknown" | "chores";
  // The ledger's spec value: three digits, or "none" for Chores.
  spec: string;
  // What the row is called: "001", "Unknown spec 999" or "Chores".
  label: string;
  // From the spec's front matter; null for unknown specs and Chores.
  title: string | null;
  // Null for unknown specs, Chores, and specs with no valid `budget_usd`.
  budgetUsd: number | null;
  totalCostMicros: number;
  runs: number;
  noCostRuns: number;
  // Over by at least a whole cent, the rule the spend line and the over-budget label use.
  overBudget: boolean;
}

function spendRow(
  kind: SpendRow["kind"],
  spec: string,
  label: string,
  title: string | null,
  budgetUsd: number | null,
  summary: SpecSummary | undefined,
): SpendRow {
  const totalCostMicros = summary?.totalCostMicros ?? 0;
  return {
    kind,
    spec,
    label,
    title,
    budgetUsd,
    totalCostMicros,
    runs: summary?.runs ?? 0,
    noCostRuns: summary?.noCostRuns ?? 0,
    overBudget: budgetUsd !== null && isOverBudget(totalCostMicros, budgetUsd),
  };
}

function byNumber(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

// Every spec file in spec order, then each ledger spec with no file ("Unknown spec NNN") in
// number order, so no spend drops out, then Chores (spec "none"), always last and always there.
// `summaries` is the loader's `ledger.specs`, in integer micro-dollars.
export function spendBySpecRows(summaries: readonly SpecSummary[], specs: readonly SpecInfo[]): SpendRow[] {
  const bySpec = new Map(summaries.map((s) => [s.spec, s]));
  const known = new Set(specs.map((s) => s.number));

  const specRows = [...specs]
    .sort((a, b) => byNumber(a.number, b.number))
    .map((s) => spendRow("spec", s.number, s.number, s.title, s.budgetUsd, bySpec.get(s.number)));
  const unknownRows = summaries
    .map((s) => s.spec)
    .filter((spec) => spec !== "none" && !known.has(spec))
    .sort(byNumber)
    .map((spec) => spendRow("unknown", spec, `Unknown spec ${spec}`, null, null, bySpec.get(spec)));
  const chores = spendRow("chores", "none", "Chores", null, null, bySpec.get("none"));

  return [...specRows, ...unknownRows, chores];
}

function dollars(micros: number): string {
  return `$${(micros / 1_000_000).toFixed(2)}`;
}

// "Not recorded" for a row with no runs, so it never reads as $0.00 (AC3).
export function formatSpend(row: Pick<SpendRow, "runs" | "totalCostMicros">): string {
  return row.runs === 0 ? NOT_RECORDED : dollars(row.totalCostMicros);
}

export function formatBudget(row: Pick<SpendRow, "budgetUsd">): string {
  return row.budgetUsd === null ? "None" : dollars(toMicros(row.budgetUsd));
}

// Empty when there is nothing to compare: no budget, or no runs yet.
export function budgetStatus(row: Pick<SpendRow, "budgetUsd" | "runs" | "overBudget">): string {
  if (row.overBudget) return OVER_BUDGET;
  if (row.budgetUsd === null || row.runs === 0) return "";
  return WITHIN_BUDGET;
}
