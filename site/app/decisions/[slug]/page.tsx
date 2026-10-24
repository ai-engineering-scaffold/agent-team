import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Badge from "@/app/_components/badge";
import DateTime from "@/app/_components/date-time";
import { getDecision, listDecisions } from "@/lib/decisions";
import { renderAdrBody } from "@/lib/markdown";

// Only ADRs that exist at build time get a page; anything else is a 404.
export const dynamicParams = false;

export async function generateStaticParams() {
  return (await listDecisions()).map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: PageProps<"/decisions/[slug]">): Promise<Metadata> {
  const decision = await getDecision((await params).slug);
  return { title: decision ? decision.title : "Decision not found" };
}

export default async function DecisionPage({ params }: PageProps<"/decisions/[slug]">) {
  const decision = await getDecision((await params).slug);
  if (!decision) notFound();

  // ADRs are written by Graham and the agents and land only through reviewed PRs.
  const html = renderAdrBody(decision.body);

  return (
    <article>
      <p className="eyebrow mono">ADR {String(decision.number).padStart(4, "0")}</p>
      <h1>{decision.title}</h1>
      <dl className="adr-meta">
        <dt>Status</dt>
        <dd>
          <Badge status={decision.status} />
          {decision.supersededBy ? `, superseded by ADR ${String(decision.supersededBy).padStart(4, "0")}` : null}
        </dd>
        <dt>Date</dt>
        <dd>
          <DateTime iso={decision.date} />
        </dd>
        <dt>Decided by</dt>
        <dd>{decision.decidedBy}</dd>
      </dl>
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </article>
  );
}
