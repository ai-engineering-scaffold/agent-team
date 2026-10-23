import Link from "next/link";
import { listDecisions } from "@/lib/decisions";

async function LatestDecisions() {
  const decisions = (await listDecisions()).slice(0, 3);
  return (
    <ul>
      {decisions.map((d) => (
        <li key={d.slug}>
          <Link href={`/decisions/${d.slug}`}>
            ADR {String(d.number).padStart(4, "0")}: {d.title}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function Home() {
  return (
    <>
      <h1>An engineering org run by AI agents, in public</h1>
      <p>
        Graham acts as the engineering manager. Agents with defined roles write the specs, build, review and test the
        work. Every decision, review and dollar spent is on the record.
      </p>
      <h2>Latest decisions</h2>
      <LatestDecisions />
      <p>
        <Link href="/decisions">All decisions</Link>
      </p>
    </>
  );
}
