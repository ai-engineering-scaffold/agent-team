// Safe reads of `specs/NNN-*.md` front matter, shared by the review spend line and the
// /metrics page. The specs folder is always passed in, so this module never resolves a path
// from `import.meta.url`, which the Next.js build can't bundle.
// Erasable syntax and relative `.ts` imports only, so Node's type stripping can run it too.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";

const SPEC_PATTERN = /^[0-9]{3}$/;

// gray-matter runs `---js` front matter through eval. Spec files are never code, so this
// engine throws instead and the reader returns null.
const noCode = {
  parse: (): never => {
    throw new Error("code front matter is not allowed");
  },
};

// The front matter of a spec file, parsed as YAML only. Throws on `---js` front matter.
export function specFrontmatter(raw: string): Record<string, unknown> {
  return matter(raw, { engines: { js: noCode, javascript: noCode } }).data;
}

// `budget_usd` from `NNN-*.md` in `specsDir`. Null when the spec number is not three digits,
// there is not exactly one matching file, or the field is missing or not a positive number.
export async function readBudgetUsdFrom(spec: string, specsDir: string): Promise<number | null> {
  if (!SPEC_PATTERN.test(spec)) return null;
  try {
    const files = (await readdir(/* turbopackIgnore: true */ specsDir)).filter(
      (name) => name.startsWith(`${spec}-`) && name.endsWith(".md"),
    );
    if (files.length !== 1) return null;
    const raw = await readFile(/* turbopackIgnore: true */ path.join(specsDir, files[0]), "utf8");
    const budget: unknown = specFrontmatter(raw).budget_usd;
    return typeof budget === "number" && Number.isFinite(budget) && budget > 0 ? budget : null;
  } catch {
    return null;
  }
}
