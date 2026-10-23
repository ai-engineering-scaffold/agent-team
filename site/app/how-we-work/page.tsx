import type { Metadata } from "next";
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

export default function HowWeWorkPage() {
  return (
    <>
      <h1>How we work</h1>
      <section aria-labelledby="roles-heading">
        <h2 id="roles-heading">Roles</h2>
        <p>Each role is an agent defined in the repo. This list is read from those definitions.</p>
        <RoleList />
      </section>
    </>
  );
}
