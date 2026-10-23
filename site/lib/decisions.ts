import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";

// Read only at build time; every page is prerendered, so the server never needs these files.
export const DECISIONS_DIR = path.join(process.cwd(), "..", "decisions");

export type DecisionStatus = "proposed" | "accepted" | "superseded" | "rejected";

export interface Decision {
  slug: string;
  number: number;
  title: string;
  status: DecisionStatus;
  date: string;
  decidedBy: string;
  supersededBy?: number;
  body: string;
}

const STATUSES: DecisionStatus[] = ["proposed", "accepted", "superseded", "rejected"];

// Files look like 0004-reviewer-uses-fresh-context.md; 0000 is the template.
const FILE_PATTERN = /^(\d{4})-[a-z0-9-]+\.md$/;

export function parseDecision(filename: string, raw: string): Decision {
  const match = FILE_PATTERN.exec(filename);
  if (!match) throw new Error(`${filename}: name must look like 0001-short-title.md`);

  const { data, content } = matter(raw);
  const required = ["title", "status", "date", "decided_by"];
  for (const key of required) {
    if (!data[key]) throw new Error(`${filename}: missing frontmatter field "${key}"`);
  }
  if (!STATUSES.includes(data.status)) {
    throw new Error(`${filename}: status must be one of ${STATUSES.join(", ")}`);
  }

  // gray-matter turns unquoted YYYY-MM-DD into a Date; keep it a plain string.
  const date = data.date instanceof Date ? data.date.toISOString().slice(0, 10) : String(data.date);

  return {
    slug: filename.replace(/\.md$/, ""),
    number: Number(match[1]),
    title: String(data.title),
    status: data.status,
    date,
    decidedBy: String(data.decided_by),
    supersededBy: data.superseded_by ? Number(data.superseded_by) : undefined,
    body: content.trim(),
  };
}

export async function listDecisions(dir = DECISIONS_DIR): Promise<Decision[]> {
  const files = (await readdir(/* turbopackIgnore: true */ dir)).filter((f) => FILE_PATTERN.test(f) && !f.startsWith("0000-"));
  const decisions = await Promise.all(
    files.map(async (f) => parseDecision(f, await readFile(path.join(/* turbopackIgnore: true */ dir, f), "utf8"))),
  );
  return decisions.sort((a, b) => b.number - a.number);
}

export async function getDecision(slug: string, dir = DECISIONS_DIR): Promise<Decision | undefined> {
  const all = await listDecisions(dir);
  return all.find((d) => d.slug === slug);
}
