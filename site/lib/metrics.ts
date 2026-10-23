// What the /metrics page shows for a given ledger (spec 003). Pure, so the states a single
// static build can't show (AC5, and AC6's freshness line in those states) are unit-tested
// against this module rather than in Playwright (design 003).
import type { Ledger } from "./ledger/load.ts";
import type { LedgerRecord } from "./ledger/record.ts";

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
