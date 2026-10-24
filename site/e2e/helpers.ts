import type { Locator, Page } from "@playwright/test";

// Shared helpers for the spec 005 tests (site redesign). Everything is located by role and visible
// text; the only attribute selectors are `time[datetime]` and `[aria-hidden]`, which the spec names.

/** A table cell's value text: its text without the aria-hidden phone column label. */
export function cellValues(row: Locator): Promise<string[]> {
  return row.evaluate((el) =>
    Array.from(el.querySelectorAll('[role="cell"], td')).map((cell) => {
      const clone = cell.cloneNode(true) as Element;
      clone.querySelectorAll('[aria-hidden="true"]').forEach((n) => n.remove());
      return (clone.textContent ?? "").trim();
    }),
  );
}

/** The `datetime` attribute of every `<time>` element under a locator, in document order. */
export function datetimes(scope: Locator): Promise<string[]> {
  return scope.locator("time").evaluateAll((els) => els.map((el) => el.getAttribute("datetime") ?? ""));
}

/** The row of a table that holds a `<time>` with this `datetime` value. */
export function rowWithDate(table: Locator, iso: string): Locator {
  return table.getByRole("row").filter({ has: table.page().locator(`time[datetime="${iso}"]`) });
}

/** Converts a computed `rgb()`/`rgba()` colour to upper-case hex; throws on translucent colours. */
export function opaqueHex(value: string): string {
  const m = /^rgba?\(([^)]+)\)$/.exec(value.trim());
  if (!m) throw new Error("Not an rgb() colour: " + value);
  const parts = m[1].split(/[\s,/]+/).filter(Boolean);
  if (parts.length > 3 && parseFloat(parts[3]) < 1) throw new Error("Colour is not opaque: " + value);
  return (
    "#" +
    parts
      .slice(0, 3)
      .map((p) => Math.round(parseFloat(p)).toString(16).padStart(2, "0"))
      .join("")
  ).toUpperCase();
}

export const ADR_0002 = "/decisions/0002-six-agent-roles-and-five-gates";

export const spendTable = (page: Page) => page.getByRole("table", { name: "Spend by spec" });
export const weeksTable = (page: Page) => page.getByRole("table", { name: "Runs by week" });
export const decisionTable = (page: Page) => page.getByRole("table", { name: "Decision log" });
// The table in ADR 0002 is labelled from its heading; find it by its column headers.
export const adrTable = (page: Page) =>
  page.getByRole("table").filter({ has: page.getByRole("columnheader", { name: "Role" }) });
