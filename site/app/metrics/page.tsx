import type { Metadata } from "next";
import Link from "next/link";
import Badge from "@/app/_components/badge";
import Cell from "@/app/_components/cell";
import DateTime from "@/app/_components/date-time";
import { loadLedger } from "@/lib/ledger/load";
import {
  budgetStatus,
  EMPTY_MESSAGE,
  formatBudget,
  formatSpend,
  formatWeekSpend,
  metricsPageState,
  runsByWeekRows,
  spendBySpecRows,
  UNAVAILABLE_MESSAGE,
  type SpendRow,
  type WeekRow,
} from "@/lib/metrics";
import { listSpecs } from "@/lib/specs";

export const metadata: Metadata = { title: "Metrics" };

const ADR_0007 = "/decisions/0007-track-cost-on-the-claude-subscription";
const ADR_0010 = "/decisions/0010-cost-ledger-lives-on-a-metrics-branch";

// Read once at build time; the page is static and rebuilds on every merge to main.
export default async function MetricsPage() {
  const ledger = await loadLedger();
  const state = metricsPageState(ledger);
  const spendRows = state.kind === "ready" ? spendBySpecRows(ledger.specs, await listSpecs()) : [];
  const weekRows = state.kind === "ready" ? runsByWeekRows(ledger.records) : [];
  return (
    <>
      <h1>Metrics</h1>
      {state.kind === "unavailable" && <p>{UNAVAILABLE_MESSAGE}</p>}
      {state.kind === "empty" && <p>{EMPTY_MESSAGE}</p>}
      {state.kind === "ready" && (
        <p>
          Newest run included: <DateTime iso={state.newestRun} />. The page updates on every merge to main.
        </p>
      )}
      <p>
        Dollar amounts are API-equivalent costs: agents run on a Claude subscription, so this is what the
        same usage would cost on the API, not money billed (<Link href={ADR_0007}>ADR 0007</Link>).
      </p>
      <p>
        Every agent run is recorded in the cost ledger on the repository&apos;s <code>metrics</code> branch (
        <Link href={ADR_0010}>ADR 0010</Link>).
      </p>
      {state.kind === "ready" && <SpendBySpec rows={spendRows} />}
      {state.kind === "ready" && <RunsByWeek rows={weekRows} />}
    </>
  );
}

// On a phone each row reflows into a card, so a narrow screen never scrolls sideways (spec 005, AC7).
function RunsByWeek({ rows }: { rows: WeekRow[] }) {
  return (
    <section>
      <h2 id="runs-by-week">Runs by week</h2>
      <table role="table" aria-labelledby="runs-by-week" className="data-table">
        <thead role="rowgroup">
          <tr role="row">
            <th role="columnheader" scope="col">
              Week starting
            </th>
            <th role="columnheader" scope="col" className="num">
              Runs
            </th>
            <th role="columnheader" scope="col" className="num">
              Spend
            </th>
            <th role="columnheader" scope="col" className="num">
              Runs not successful
            </th>
          </tr>
        </thead>
        <tbody role="rowgroup">
          {rows.map((row) => (
            <tr role="row" key={row.weekStart}>
              <th role="rowheader" scope="row">
                <DateTime iso={row.weekStart} />
              </th>
              <Cell label="Runs" className="num">
                {row.runs}
              </Cell>
              <Cell label="Spend" className="num mono">
                {formatWeekSpend(row)}
              </Cell>
              <Cell label="Runs not successful" className="num">
                {row.notSuccess}
              </Cell>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function SpendBySpec({ rows }: { rows: SpendRow[] }) {
  return (
    <section>
      <h2 id="spend-by-spec">Spend by spec</h2>
      <table role="table" aria-labelledby="spend-by-spec" className="data-table">
        <thead role="rowgroup">
          <tr role="row">
            <th role="columnheader" scope="col">
              Spec
            </th>
            <th role="columnheader" scope="col">
              Title
            </th>
            <th role="columnheader" scope="col" className="num">
              Spend
            </th>
            <th role="columnheader" scope="col" className="num">
              Budget
            </th>
            <th role="columnheader" scope="col">
              Status
            </th>
            <th role="columnheader" scope="col" className="num">
              Runs
            </th>
            <th role="columnheader" scope="col" className="num">
              Runs with no cost
            </th>
          </tr>
        </thead>
        <tbody role="rowgroup">
          {rows.map((row) => {
            // Empty when there is nothing to compare, and then no badge (AC5).
            const status = budgetStatus(row);
            return (
              <tr role="row" key={row.spec}>
                <th role="rowheader" scope="row" className="mono">
                  {row.label}
                </th>
                <Cell label="Title" className="wrap">
                  {row.title ?? ""}
                </Cell>
                <Cell label="Spend" className="num mono">
                  {formatSpend(row)}
                </Cell>
                <Cell label="Budget" className="num mono">
                  {formatBudget(row)}
                </Cell>
                <Cell label="Status">{status ? <Badge status={status} /> : null}</Cell>
                <Cell label="Runs" className="num">
                  {row.runs}
                </Cell>
                <Cell label="Runs with no cost" className="num">
                  {row.noCostRuns}
                </Cell>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
