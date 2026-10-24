import type { Metadata } from "next";
import Link from "next/link";
import Badge from "@/app/_components/badge";
import Cell from "@/app/_components/cell";
import DateTime from "@/app/_components/date-time";
import { listDecisions } from "@/lib/decisions";

export const metadata: Metadata = { title: "Decisions" };

// Explicit roles keep this a table when the phone layout reflows each row into a card (spec 005, AC7).
async function DecisionTable() {
  const decisions = await listDecisions();
  return (
    <table role="table" aria-label="Decision log" className="data-table">
      <thead role="rowgroup">
        <tr role="row">
          <th role="columnheader" scope="col">
            ADR
          </th>
          <th role="columnheader" scope="col">
            Decision
          </th>
          <th role="columnheader" scope="col">
            Status
          </th>
          <th role="columnheader" scope="col">
            Date
          </th>
        </tr>
      </thead>
      <tbody role="rowgroup">
        {decisions.map((d) => (
          <tr role="row" key={d.slug}>
            <Cell label="ADR" className="mono">
              {String(d.number).padStart(4, "0")}
            </Cell>
            <Cell label="Decision" className="wrap">
              <Link href={`/decisions/${d.slug}`}>{d.title}</Link>
            </Cell>
            <Cell label="Status">
              <Badge status={d.status} />
            </Cell>
            <Cell label="Date">
              <DateTime iso={d.date} />
            </Cell>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function DecisionsPage() {
  return (
    <>
      <h1>Decision log</h1>
      <p>Every choice of tool, role, gate or budget, with who made it. Newest first.</p>
      <DecisionTable />
    </>
  );
}
