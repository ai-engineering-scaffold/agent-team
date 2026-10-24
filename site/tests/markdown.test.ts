import { describe, expect, it } from "vitest";
import { renderAdrBody, TABLE_FALLBACK_LABEL } from "../lib/markdown";

const table = "| Role | Gate |\n| --- | --- |\n| engineer | CI |\n";
// Spec 005 (ADR 0017): tables no longer scroll in their own region. The heading-based label sits
// on the table itself.
const tableOpen = (label: string) => `<table role="table" aria-label="${label}">`;

describe("renderAdrBody", () => {
  it("labels a table with the heading before it, and puts it in no scroll region", () => {
    const html = renderAdrBody(`## The roles\n\nSome text.\n\n${table}`);
    expect(html).toContain(`<p>Some text.</p>\n${tableOpen("The roles")}\n<thead role="rowgroup">`);
    expect(html).toMatch(/<\/table>\n$/);
    expect(html).not.toContain("table-scroll");
    expect(html).not.toContain('role="region"');
    expect(html).not.toContain("tabindex");
  });

  it(`falls back to "${TABLE_FALLBACK_LABEL}" when no heading comes before the table`, () => {
    const html = renderAdrBody(`Intro.\n\n${table}\n## Later heading\n`);
    expect(html).toContain(tableOpen("Table"));
    expect(html).not.toContain('aria-label="Later heading"');
  });

  it("labels each table by its own nearest heading", () => {
    const html = renderAdrBody(`## First\n\n${table}\n## Second\n\n${table}\n${table}`);
    expect(html).toContain(tableOpen("First"));
    expect(html.match(new RegExp(tableOpen("Second"), "g"))).toHaveLength(2);
  });

  it("uses the heading's plain text and escapes it for the attribute", () => {
    const html = renderAdrBody(`## Costs for \`gh\` & "runs"\n\n${table}`);
    expect(html).toContain(tableOpen("Costs for gh &amp; &quot;runs&quot;"));
  });

  it("keeps the alignment the Markdown sets", () => {
    const html = renderAdrBody("| Name | Count |\n| :--- | ---: |\n| a | 1 |\n");
    expect(html).toContain('<th role="columnheader" scope="col" align="left">Name</th>');
    expect(html).toContain('<th role="columnheader" scope="col" align="right">Count</th>');
    expect(html).toContain(
      '<td role="cell" align="right"><span class="cell-label" aria-hidden="true">Count</span><span class="cell-value">1</span></td>',
    );
  });

  it("gives the table, row groups, rows, header cells and data cells explicit roles", () => {
    const html = renderAdrBody(table);
    expect(html).toBe(
      `${tableOpen("Table")}\n` +
        '<thead role="rowgroup">\n<tr role="row">\n' +
        '<th role="columnheader" scope="col">Role</th>\n' +
        '<th role="columnheader" scope="col">Gate</th>\n' +
        "</tr>\n</thead>\n" +
        '<tbody role="rowgroup">\n<tr role="row">\n' +
        '<td role="cell"><span class="cell-label" aria-hidden="true">Role</span><span class="cell-value">engineer</span></td>\n' +
        '<td role="cell"><span class="cell-label" aria-hidden="true">Gate</span><span class="cell-value">CI</span></td>\n' +
        "</tr>\n</tbody>\n</table>\n",
    );
  });

  it("labels each data cell with its column's plain header text, escaped", () => {
    const html = renderAdrBody('| `gh` & <b>"x"</b> | Plain |\n| --- | --- |\n| *one* | two |\n');
    expect(html).toContain('<span class="cell-label" aria-hidden="true">gh &amp; &lt;b&gt;&quot;x&quot;&lt;/b&gt;</span>');
    expect(html).toContain('<span class="cell-value"><em>one</em></span>');
    expect(html.match(/class="cell-label"/g)).toHaveLength(2);
  });

  it("still labels an empty cell", () => {
    const html = renderAdrBody("| Name | Note |\n| --- | --- |\n| a |  |\n");
    expect(html).toContain('<td role="cell"><span class="cell-label" aria-hidden="true">Note</span><span class="cell-value"></span></td>');
  });

  it("renders headings and other blocks as marked does", () => {
    const html = renderAdrBody("## Context\n\nWhy.\n");
    expect(html).toBe("<h2>Context</h2>\n<p>Why.</p>\n");
    expect(html).not.toContain("table-scroll");
  });
});
