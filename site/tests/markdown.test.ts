import { describe, expect, it } from "vitest";
import { renderAdrBody, TABLE_FALLBACK_LABEL } from "../lib/markdown";

const table = "| Role | Gate |\n| --- | --- |\n| engineer | CI |\n";
const regionOpen = (label: string) =>
  `<div class="table-scroll" role="region" tabindex="0" aria-label="${label}">`;

describe("renderAdrBody", () => {
  it("wraps a table in a focusable scroll region named after the heading before it", () => {
    const html = renderAdrBody(`## The roles\n\nSome text.\n\n${table}`);
    expect(html).toContain(`${regionOpen("The roles")}\n<table>`);
    expect(html).toMatch(/<\/table>\n<\/div>/);
  });

  it(`falls back to "${TABLE_FALLBACK_LABEL}" when no heading comes before the table`, () => {
    const html = renderAdrBody(`Intro.\n\n${table}\n## Later heading\n`);
    expect(html).toContain(regionOpen("Table"));
    expect(html).not.toContain('aria-label="Later heading"');
  });

  it("labels each table by its own nearest heading", () => {
    const html = renderAdrBody(`## First\n\n${table}\n## Second\n\n${table}\n${table}`);
    expect(html).toContain(regionOpen("First"));
    expect(html.match(new RegExp(regionOpen("Second"), "g"))).toHaveLength(2);
  });

  it("uses the heading's plain text and escapes it for the attribute", () => {
    const html = renderAdrBody(`## Costs for \`gh\` & "runs"\n\n${table}`);
    expect(html).toContain(regionOpen("Costs for gh &amp; &quot;runs&quot;"));
  });

  it("keeps the alignment the Markdown sets", () => {
    const html = renderAdrBody("| Name | Count |\n| :--- | ---: |\n| a | 1 |\n");
    expect(html).toContain('<th align="right">Count</th>');
    expect(html).toContain('<td align="right">1</td>');
  });

  it("renders headings and other blocks as marked does", () => {
    const html = renderAdrBody("## Context\n\nWhy.\n");
    expect(html).toBe("<h2>Context</h2>\n<p>Why.</p>\n");
    expect(html).not.toContain("table-scroll");
  });
});
