// The spend line in the agent review comment (spec 002, AC5). The review job builds it from
// the ledger before Claude runs, and the line goes into the review prompt, so it carries only
// numbers and the spec number, never free text from a record (design 002, section 5).
// Erasable syntax and relative `.ts` imports only, so Node's type stripping can run it too.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { summarize, toMicros, type SpecSummary } from "./load.ts";
import type { LedgerRecord } from "./record.ts";

// Read only by scripts and at build time, like DECISIONS_DIR.
export const SPECS_DIR = path.join(process.cwd(), "..", "specs");

const SPEC_PATTERN = /^[0-9]{3}$/;

// The review run that is posting the comment: its PR and the run's `run_started_at`, which is
// what the record job writes as `date`.
export interface CurrentRun {
  pr: number;
  startedAt: string;
}

// Leaves out the current review run, so a re-run whose earlier attempt was already recorded
// doesn't count its own cost against the spec.
export function excludeCurrentRun(records: readonly LedgerRecord[], current: CurrentRun): LedgerRecord[] {
  const started = Date.parse(current.startedAt);
  if (Number.isNaN(started)) throw new Error("current run start time is not a valid timestamp");
  return records.filter(
    (r) => !(r.workflow === "review" && r.pr === current.pr && Date.parse(r.date) === started),
  );
}

// The summary for one spec, or an empty one when the spec has no runs yet.
export function summaryFor(records: readonly LedgerRecord[], spec: string): SpecSummary {
  const found = summarize(records.filter((r) => r.spec === spec))[0];
  return found ?? { spec, totalCostMicros: 0, totalCostUsd: 0, runs: 0, noCostRuns: 0 };
}

function isCount(n: number): boolean {
  return Number.isInteger(n) && n >= 0;
}

function dollars(micros: number): string {
  return `$${(micros / 1_000_000).toFixed(2)}`;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

// One line. For a spec, spend against `budget_usd`; for spec "none", the total with no budget.
// Throws on anything that isn't a valid spec or count, rather than print it into the prompt.
export function formatSpendLine(summary: SpecSummary, budgetUsd: number | null): string {
  const { spec, totalCostMicros, runs, noCostRuns } = summary;
  if (spec !== "none" && !SPEC_PATTERN.test(spec)) throw new Error("spec must be a three-digit string or none");
  if (!isCount(totalCostMicros) || !isCount(runs) || !isCount(noCostRuns) || noCostRuns > runs) {
    throw new Error("summary totals must be non-negative integers");
  }

  const tail = `${plural(runs, "run")}, ${noCostRuns} with no cost recorded.`;
  const spent = dollars(totalCostMicros);

  if (spec === "none") return `Spend on chore PRs (spec none) so far: ${spent} across ${tail}`;

  if (budgetUsd === null || !(Number.isFinite(budgetUsd) && budgetUsd > 0)) {
    return `Spend on spec ${spec} so far: ${spent} (no budget_usd set) across ${tail}`;
  }

  const budgetMicros = toMicros(budgetUsd);
  const percent = Math.round((totalCostMicros / budgetMicros) * 100);
  const over = totalCostMicros - budgetMicros;
  const status = over > 0 ? `${percent}%, over by ${dollars(over)}` : `${percent}%`;
  return `Spend on spec ${spec} so far: ${spent} of ${dollars(budgetMicros)} budget (${status}) across ${tail}`;
}

// `budget_usd` from `specs/NNN-*.md`. Null when the spec number is not three digits, there is
// not exactly one matching file, or the field is missing or not a positive number.
export async function readBudgetUsd(spec: string, specsDir = SPECS_DIR): Promise<number | null> {
  if (!SPEC_PATTERN.test(spec)) return null;
  try {
    const files = (await readdir(/* turbopackIgnore: true */ specsDir)).filter(
      (name) => name.startsWith(`${spec}-`) && name.endsWith(".md"),
    );
    if (files.length !== 1) return null;
    const raw = await readFile(/* turbopackIgnore: true */ path.join(specsDir, files[0]), "utf8");
    const budget: unknown = matter(raw).data.budget_usd;
    return typeof budget === "number" && Number.isFinite(budget) && budget > 0 ? budget : null;
  } catch {
    return null;
  }
}
