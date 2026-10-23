import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { listDecisions, parseDecision } from "../lib/decisions";

const adr = (fields: string) => `---\n${fields}\n---\n\n## Context\n\nWhy.\n`;
const valid = 'title: Use Vercel\nstatus: accepted\ndate: 2026-10-22\ndecided_by: Graham';

describe("parseDecision", () => {
  it("reads number, slug and frontmatter", () => {
    const d = parseDecision("0005-use-vercel.md", adr(valid));
    expect(d).toMatchObject({
      slug: "0005-use-vercel",
      number: 5,
      title: "Use Vercel",
      status: "accepted",
      date: "2026-10-22",
      decidedBy: "Graham",
    });
    expect(d.body).toContain("## Context");
  });

  it("rejects a bad file name", () => {
    expect(() => parseDecision("use-vercel.md", adr(valid))).toThrow(/0001-short-title/);
  });

  it("rejects a missing field", () => {
    expect(() => parseDecision("0005-x.md", adr("title: X\nstatus: accepted\ndate: 2026-10-22"))).toThrow(
      /decided_by/,
    );
  });

  it("rejects an unknown status", () => {
    expect(() => parseDecision("0005-x.md", adr(valid.replace("accepted", "maybe")))).toThrow(/status/);
  });
});

describe("listDecisions", () => {
  it("skips the template and sorts newest number first", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "adr-"));
    await writeFile(path.join(dir, "0000-template.md"), "not an adr");
    await writeFile(path.join(dir, "0001-first.md"), adr(valid));
    await writeFile(path.join(dir, "0002-second.md"), adr(valid));
    await writeFile(path.join(dir, "README.md"), "ignored");

    const list = await listDecisions(dir);
    expect(list.map((d) => d.number)).toEqual([2, 1]);
  });
});

describe("the repo's own decision log", () => {
  it("parses every ADR in decisions/", async () => {
    const list = await listDecisions();
    expect(list.length).toBeGreaterThan(0);
    expect(new Set(list.map((d) => d.number)).size).toBe(list.length);
  });
});
