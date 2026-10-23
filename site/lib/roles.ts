import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";

// Read only at build time; every page is prerendered, so the server never needs these files.
export const AGENTS_DIR = path.join(process.cwd(), "..", "plugin", "agents");

export interface Role {
  slug: string;
  name: string;
  description: string;
  model: string;
}

// "code-reviewer" becomes "Code reviewer".
export function sentenceCase(name: string): string {
  const words = name.replace(/[-_]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function parseRole(filename: string, raw: string): Role {
  const { data } = matter(raw);
  for (const key of ["name", "description", "model"]) {
    if (!data[key]) throw new Error(`${filename}: missing frontmatter field "${key}"`);
  }
  return {
    slug: filename.replace(/\.md$/, ""),
    name: sentenceCase(String(data.name)),
    description: String(data.description),
    model: String(data.model),
  };
}

export async function listRoles(dir = AGENTS_DIR): Promise<Role[]> {
  const files = (await readdir(/* turbopackIgnore: true */ dir)).filter((f) => f.endsWith(".md")).sort();
  return Promise.all(
    files.map(async (f) => parseRole(f, await readFile(path.join(/* turbopackIgnore: true */ dir, f), "utf8"))),
  );
}
