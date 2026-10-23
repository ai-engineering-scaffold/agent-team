import type { Metadata } from "next";
import Link from "next/link";
import { loadLedger } from "@/lib/ledger/load";
import {
  budgetStatus,
  EMPTY_MESSAGE,
  formatBudget,
  formatSpend,
  formatUtc,
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
          Newest run included: <time dateTime={state.newestRun}>{formatUtc(state.newestRun)}</time>. The page
          updates on every merge to main.
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

// Scrolls on its own like Spend by spec, so a narrow screen never scrolls the page (AC7).
function RunsByWeek({ rows }: { rows: WeekRow[] }) {
  return (
    <section>
      <h2 id="runs-by-week">Runs by week</h2>
      <div className="table-scroll" role="region" aria-labelledby="runs-by-week" tabIndex={0}>
        <table aria-labelledby="runs-by-week">
          <thead>
            <tr>
              <th scope="col">Week starting</th>
              <th scope="col">Runs</th>
              <th scope="col">Spend</th>
              <th scope="col">Runs not successful</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.weekStart}>
                <th scope="row">{row.weekStart}</th>
                <td>{row.runs}</td>
                <td>{formatWeekSpend(row)}</td>
                <td>{row.notSuccess}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// The region scrolls on its own, so a narrow screen never scrolls the whole page (AC7).
function SpendBySpec({ rows }: { rows: SpendRow[] }) {
  return (
    <section>
      <h2 id="spend-by-spec">Spend by spec</h2>
      <div className="table-scroll" role="region" aria-labelledby="spend-by-spec" tabIndex={0}>
        <table aria-labelledby="spend-by-spec">
          <thead>
            <tr>
              <th scope="col">Spec</th>
              <th scope="col">Title</th>
              <th scope="col">Spend</th>
              <th scope="col">Budget</th>
              <th scope="col">Status</th>
              <th scope="col">Runs</th>
              <th scope="col">Runs with no cost</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.spec}>
                <th scope="row">{row.label}</th>
                <td>{row.title ?? ""}</td>
                <td>{formatSpend(row)}</td>
                <td>{formatBudget(row)}</td>
                <td>{budgetStatus(row)}</td>
                <td>{row.runs}</td>
                <td>{row.noCostRuns}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
