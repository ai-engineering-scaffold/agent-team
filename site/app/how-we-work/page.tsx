import type { Metadata } from "next";
import Link from "next/link";
import { Fragment } from "react";
import { GATES, adrLabel } from "@/lib/gates";
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

// Gates change only through an ADR. They live in lib/gates.ts, which the homepage diagram shares.
function GateList() {
  return (
    <ol aria-label="Gates">
      {GATES.map((g) => (
        <li key={g.name}>
          <h3>{g.name}</h3>
          <p>{g.sentence}</p>
          <p>
            {g.adrs.map((adr, i) => (
              <Fragment key={adr.slug}>
                {i > 0 && " "}
                <Link href={`/decisions/${adr.slug}`}>{adrLabel(adr)}</Link>
              </Fragment>
            ))}
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
