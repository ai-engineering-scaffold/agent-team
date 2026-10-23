import type { Metadata } from "next";
import Link from "next/link";
import { listDecisions } from "@/lib/decisions";

export const metadata: Metadata = { title: "Decisions" };

// Scrolls inside its own box, so a narrow screen never scrolls the page (spec 004, AC5).
async function DecisionTable() {
  const decisions = await listDecisions();
  return (
    <div className="table-scroll" role="region" aria-label="Decision log" tabIndex={0}>
      <table aria-label="Decision log">
        <thead>
          <tr>
            <th scope="col">ADR</th>
            <th scope="col">Decision</th>
            <th scope="col">Status</th>
            <th scope="col">Date</th>
          </tr>
        </thead>
        <tbody>
          {decisions.map((d) => (
            <tr key={d.slug}>
              <td>{String(d.number).padStart(4, "0")}</td>
              <td>
                <Link href={`/decisions/${d.slug}`}>{d.title}</Link>
              </td>
              <td>{d.status}</td>
              <td>{d.date}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
