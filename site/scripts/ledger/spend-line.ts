// Prints the AC5 spend line for the review prompt (spec 002; design 002, section 5). Runs from
// a checkout of `main`, never the PR. The line is numbers and the spec number only; on any
// problem it prints a fixed fallback line and still exits 0, so the review always runs.
//
//   node spend-line.ts --ledger <dir> --branch <head ref> --pr <n> --started-at <run_started_at>
import { parseArgs } from "node:util";
import { loadLedger } from "../../lib/ledger/load.ts";
import { specFor } from "../../lib/ledger/record.ts";
import { excludeCurrentRun, formatSpendLine, readBudgetUsd, summaryFor } from "../../lib/ledger/spend-line.ts";
import { isMain, message, positiveInt } from "./cli.ts";

export const UNAVAILABLE = "Spend so far: not available.";

export function parseSpendArgs(argv: string[]): { ledger: string; spec: string; pr: number; startedAt: string } {
  const { values } = parseArgs({
    args: argv,
    options: {
      ledger: { type: "string" },
      branch: { type: "string", default: "" },
      pr: { type: "string" },
      "started-at": { type: "string" },
    },
  });
  if (!values.ledger) throw new Error("--ledger is required");
  const pr = positiveInt(values.pr, "--pr");
  if (pr === null) throw new Error("--pr is required");
  const startedAt = values["started-at"] ?? "";
  if (Number.isNaN(Date.parse(startedAt))) throw new Error("--started-at must be a timestamp");
  // specFor only ever returns three digits or "none", so the branch name goes no further.
  return { ledger: values.ledger, spec: specFor(null, values.branch), pr, startedAt };
}

export async function spendLine(argv: string[], specsDir?: string): Promise<string> {
  const args = parseSpendArgs(argv);
  const ledger = await loadLedger(args.ledger);
  if (!ledger.available) return UNAVAILABLE;
  const records = excludeCurrentRun(ledger.records, { pr: args.pr, startedAt: args.startedAt });
  const budget = args.spec === "none" ? null : await readBudgetUsd(args.spec, specsDir);
  return formatSpendLine(summaryFor(records, args.spec), budget);
}

export async function main(argv: string[], log: (m: string) => void = console.error, specsDir?: string): Promise<string> {
  try {
    return await spendLine(argv, specsDir);
  } catch (error) {
    log(`::warning::No spend line: ${message(error)}`);
    return UNAVAILABLE;
  }
}

if (isMain(import.meta.url)) {
  console.log(await main(process.argv.slice(2)));
}
