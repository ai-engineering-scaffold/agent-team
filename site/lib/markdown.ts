import { Marked, type Tokens } from "marked";

/** The label a Markdown table gets when no heading comes before it. */
export const TABLE_FALLBACK_LABEL = "Table";

/** Escapes text for an HTML attribute value or for element content. */
function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Renders an ADR body to HTML. Tables get the same structure as the site's
 * other tables (spec 005, AC6 and AC7; ADR 0017):
 *
 * - explicit `table`, `rowgroup`, `row`, `columnheader` and `cell` roles, so
 *   the phone layout, which sets the parts to `display: block`, still exposes
 *   a table;
 * - an `aria-label` from the nearest heading before the table, or "Table"
 *   when there is none;
 * - in each data cell, an `aria-hidden` `.cell-label` span with its column's
 *   header text (shown only on a phone), then the value in `.cell-value`.
 *
 * Marked's column alignment (`align`) is kept. Tables never scroll on their
 * own: on a phone each row reflows into a card.
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
      table(token: Tokens.Table) {
        const label = escapeHtml(lastHeading || TABLE_FALLBACK_LABEL);
        const align = (cell: Tokens.TableCell) => (cell.align ? ` align="${cell.align}"` : "");
        const columnNames = token.header.map((cell) =>
          escapeHtml(this.parser.parseInline(cell.tokens, this.parser.textRenderer).trim()),
        );

        const head = token.header
          .map((cell) => `<th role="columnheader" scope="col"${align(cell)}>${this.parser.parseInline(cell.tokens)}</th>\n`)
          .join("");
        const rows = token.rows
          .map((row) => {
            const cells = row
              .map(
                (cell, i) =>
                  `<td role="cell"${align(cell)}><span class="cell-label" aria-hidden="true">${columnNames[i] ?? ""}</span>` +
                  `<span class="cell-value">${this.parser.parseInline(cell.tokens)}</span></td>\n`,
              )
              .join("");
            return `<tr role="row">\n${cells}</tr>\n`;
          })
          .join("");
        const body = rows ? `<tbody role="rowgroup">\n${rows}</tbody>\n` : "";
        return (
          `<table role="table" aria-label="${label}">\n` +
          `<thead role="rowgroup">\n<tr role="row">\n${head}</tr>\n</thead>\n` +
          body +
          `</table>\n`
        );
      },
    },
  });
  return md.parse(markdown, { async: false });
}
