import type { Metadata } from "next";
import Link from "next/link";
import { listRoles } from "@/lib/roles";

export const metadata: Metadata = { title: "How we work" };

async function RoleList() {
  const roles = await listRoles();
  return (
    <ul aria-label="Agent roles">
      {roles.map((r) => (
        <li key={r.slug}>
          <h3>{r.name}</h3>
          <p>{r.description}</p>
          <p>
            Model: <code>{r.model}</code>
          </p>
        </li>
      ))}
    </ul>
  );
}

const ADR_0002 = "/decisions/0002-six-agent-roles-and-five-gates";
const ADR_0006 = "/decisions/0006-agents-may-merge-low-risk-changes";

// Gates change only through an ADR, so they are stated here (ADR 0002, with Design removed by ADR 0012).
const GATES = [
  { name: "Spec", approver: "Graham approves the spec, including his design input.", extra: false },
  {
    name: "CI",
    approver: "Lint, types, unit tests, build and Playwright pass as required checks.",
    extra: false,
  },
  { name: "Review", approver: "The reviewer agent finds no blocking issues.", extra: false },
  { name: "Merge", approver: "Graham merges, except for low-risk changes.", extra: true },
];

function GateList() {
  return (
    <ol aria-label="Gates">
      {GATES.map((g) => (
        <li key={g.name}>
          <h3>{g.name}</h3>
          <p>{g.approver}</p>
          <p>
            <Link href={ADR_0002}>ADR 0002</Link>
            {g.extra && (
              <>
                {" "}
                <Link href={ADR_0006}>ADR 0006</Link>
              </>
            )}
          </p>
        </li>
      ))}
    </ol>
  );
}

export default function HowWeWorkPage() {
  return (
    <>
      <h1>How we work</h1>
      <section aria-labelledby="roles-heading">
        <h2 id="roles-heading">Roles</h2>
        <p>Each role is an agent defined in the repo. This list is read from those definitions.</p>
        <RoleList />
      </section>
      <section aria-labelledby="gates-heading">
        <h2 id="gates-heading">Gates</h2>
        <p>Work passes four gates, in order, before it ships.</p>
        <GateList />
      </section>
    </>
  );
}
