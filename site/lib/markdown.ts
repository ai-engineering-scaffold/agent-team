import { Marked, Renderer } from "marked";

/** The label a Markdown table's scroll region gets when no heading comes before it. */
export const TABLE_FALLBACK_LABEL = "Table";

function escapeAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Renders an ADR body to HTML. Each table is wrapped in a focusable
 * `.table-scroll` region, as the site's other tables are, so a wide table
 * scrolls inside its own box rather than scrolling the page (spec 004, AC5).
 * The region is labelled by the nearest heading before the table, or
 * "Table" when there is none.
 */
export function renderAdrBody(markdown: string): string {
  // Marked renders tokens in document order, so the last heading rendered is
  // the nearest one before the table. A fresh instance per call keeps that
  // state local to this render.
  let lastHeading = "";
  const md = new Marked({
    renderer: {
      heading({ tokens }) {
        lastHeading = this.parser.parseInline(tokens, this.parser.textRenderer).trim();
        return false;
      },
      table(token) {
        const label = escapeAttribute(lastHeading || TABLE_FALLBACK_LABEL);
        const table = Renderer.prototype.table.call(this, token);
        return `<div class="table-scroll" role="region" tabindex="0" aria-label="${label}">\n${table}</div>\n`;
      },
    },
  });
  return md.parse(markdown, { async: false });
}
