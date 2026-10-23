// The spec list for the /metrics "Spend by spec" table (spec 003, AC2). Front matter is read
// with the spend line's YAML-only parser and budget reader, so the page, the review comment's
// spend line and the over-budget label all read a budget the same way.
// Erasable syntax and relative `.ts` imports only, like the ledger modules it uses.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { readBudgetUsd, specFrontmatter } from "./ledger/spend-line.ts";

// Read only at build time, from the `site/` directory the build runs in.
export const SPECS_DIR = path.join(process.cwd(), "..", "specs");

export interface SpecInfo {
  // Three digits, as in the ledger's `spec` field.
  number: string;
  title: string;
  budgetUsd: number | null;
}

// Files look like 003-metrics-page.md; README.md and anything else is skipped.
const FILE_PATTERN = /^([0-9]{3})-.+\.md$/;

// Every spec file in spec order. Throws when two files share a number, since their spend
// can't be told apart, and when a file has no title or unsafe front matter.
export async function listSpecs(dir = SPECS_DIR): Promise<SpecInfo[]> {
  const files = (await readdir(/* turbopackIgnore: true */ dir)).filter((f) => FILE_PATTERN.test(f)).sort();
  const seen = new Set<string>();
  const specs: SpecInfo[] = [];
  for (const file of files) {
    const number = file.slice(0, 3);
    if (seen.has(number)) throw new Error(`${file}: more than one spec file is numbered ${number}`);
    seen.add(number);

    const raw = await readFile(/* turbopackIgnore: true */ path.join(dir, file), "utf8");
    let title: unknown;
    try {
      title = specFrontmatter(raw).title;
    } catch {
      throw new Error(`${file}: front matter must be YAML`);
    }
    if (typeof title !== "string" || title.trim() === "") throw new Error(`${file}: missing frontmatter field "title"`);

    specs.push({ number, title: title.trim(), budgetUsd: await readBudgetUsd(number, dir) });
  }
  return specs;
}
