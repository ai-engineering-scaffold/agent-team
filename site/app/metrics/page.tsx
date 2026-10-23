import type { Metadata } from "next";
import Link from "next/link";
import { loadLedger } from "@/lib/ledger/load";
import { EMPTY_MESSAGE, formatUtc, metricsPageState, UNAVAILABLE_MESSAGE } from "@/lib/metrics";

export const metadata: Metadata = { title: "Metrics" };

const ADR_0007 = "/decisions/0007-track-cost-on-the-claude-subscription";
const ADR_0010 = "/decisions/0010-cost-ledger-lives-on-a-metrics-branch";

// Read once at build time; the page is static and rebuilds on every merge to main.
export default async function MetricsPage() {
  const state = metricsPageState(await loadLedger());
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
    </>
  );
}
