import { expect, test, type Locator, type Page } from "@playwright/test";

// Spec 004: table styling (AC6), the over-budget row (AC7) and tables not scrolling the page (AC5).
// Tables and cells are located by role and visible text; computed styles are read in the browser.

type CellStyle = {
  background: string;
  fontWeight: number;
  textAlign: string;
  numeric: string;
  borderBottomWidth: number;
  borderLeftWidth: number;
  borderLeftColor: string;
};

/** Computed style of the header cell and of the first body cell in the column named `column`. */
async function columnStyles(table: Locator, column: string): Promise<{ head: CellStyle; body: CellStyle }> {
  return table.evaluate((el, name) => {
    const read = (cell: Element): CellStyle => {
      const cs = getComputedStyle(cell);
      return {
        background: cs.backgroundColor,
        fontWeight: parseInt(cs.fontWeight, 10),
        textAlign: cs.textAlign,
        numeric: cs.fontVariantNumeric,
        borderBottomWidth: parseFloat(cs.borderBottomWidth),
        borderLeftWidth: parseFloat(cs.borderLeftWidth),
        borderLeftColor: cs.borderLeftColor,
      };
    };
    const headers = Array.from(el.querySelectorAll("thead th"));
    const index = headers.findIndex((th) => (th.textContent ?? "").trim() === name);
    if (index < 0) throw new Error("No column header named " + name);
    const bodyRow = el.querySelector("tbody tr");
    if (!bodyRow) throw new Error("Table has no body rows");
    return { head: read(headers[index]), body: read(bodyRow.children[index]) };
  }, column);
}

/** The header row is set apart from body cells, and body cells have a visible bottom separator. */
async function expectHeaderSetApart(table: Locator, column: string) {
  const { head, body } = await columnStyles(table, column);
  const differs = head.background !== body.background || head.fontWeight !== body.fontWeight;
  expect(differs, "header background or weight differs from body in column " + column).toBe(true);
  expect(body.borderBottomWidth, "body cells have a bottom border").toBeGreaterThan(0);
}

async function expectNumeric(table: Locator, column: string) {
  const { head, body } = await columnStyles(table, column);
  for (const [where, s] of [["header", head], ["body", body]] as const) {
    expect(s.textAlign, `${column} ${where} is right-aligned`).toBe("right");
    expect(s.numeric, `${column} ${where} uses tabular figures`).toContain("tabular-nums");
  }
}

async function expectText(table: Locator, column: string) {
  const { head, body } = await columnStyles(table, column);
  for (const [where, s] of [["header", head], ["body", body]] as const) {
    expect(["left", "start"], `${column} ${where} is left-aligned`).toContain(s.textAlign);
  }
}

const spendTable = (page: Page) => page.getByRole("table", { name: "Spend by spec" });
const weeksTable = (page: Page) => page.getByRole("table", { name: "Runs by week" });
const decisionTable = (page: Page) => page.getByRole("table", { name: "Decision log" });
// The table in ADR 0002 has no caption, so find it by its column headers.
const adrTable = (page: Page) =>
  page.getByRole("table").filter({ has: page.getByRole("columnheader", { name: "Role" }) });

const ADR_0002 = "/decisions/0002-six-agent-roles-and-five-gates";

test.describe("fixture ledger tables", () => {
  test.skip(!!process.env.BASE_URL, "Metrics tables need the local fixture build (BASE_URL unset).");

  test("AC6: Spend by spec has a distinct header, separators, and right-aligned tabular numbers", async ({ page }) => {
    await page.goto("/metrics");
    const table = spendTable(page);
    await expect(table).toBeVisible();
    await expectHeaderSetApart(table, "Spend");
    for (const column of ["Spend", "Budget", "Runs", "Runs with no cost"]) await expectNumeric(table, column);
    for (const column of ["Spec", "Title", "Status"]) await expectText(table, column);
  });

  test("AC6: Runs by week has a distinct header, separators, and right-aligned tabular numbers", async ({ page }) => {
    await page.goto("/metrics");
    const table = weeksTable(page);
    await expect(table).toBeVisible();
    await expectHeaderSetApart(table, "Runs");
    for (const column of ["Runs", "Spend", "Runs not successful"]) await expectNumeric(table, column);
    await expectText(table, "Week starting");
  });

  test("AC7: the over-budget 002 row looks different from 003 and still says Over budget", async ({ page }) => {
    await page.goto("/metrics");
    const table = spendTable(page);
    const over = table.getByRole("row", { name: /^002 / });
    const normal = table.getByRole("row", { name: /^003 / });
    await expect(over).toContainText("Over budget");
    await expect(normal).not.toContainText("Over budget");

    const first = (row: Locator) =>
      row.evaluate((el) => {
        const cs = getComputedStyle(el.children[0]);
        return { background: cs.backgroundColor, borderLeftWidth: parseFloat(cs.borderLeftWidth), borderLeftColor: cs.borderLeftColor };
      });
    const a = await first(over);
    const b = await first(normal);
    const differs =
      a.background !== b.background ||
      a.borderLeftWidth !== b.borderLeftWidth ||
      a.borderLeftColor !== b.borderLeftColor;
    expect(differs, "over-budget row background or left border differs from a normal row").toBe(true);
  });
});

test("AC6: the decisions index has a distinct header, separators, and left-aligned text columns", async ({ page }) => {
  await page.goto("/decisions");
  const table = decisionTable(page);
  await expect(table).toBeVisible();
  await expectHeaderSetApart(table, "Decision");
  for (const column of ["ADR", "Decision", "Status", "Date"]) await expectText(table, column);
});

test("AC6: the Markdown table in ADR 0002 has a distinct header, separators, and left-aligned text", async ({ page }) => {
  await page.goto(ADR_0002);
  const table = adrTable(page);
  await expect(table).toBeVisible();
  await expectHeaderSetApart(table, "Role");
  for (const column of ["Role", "Owns"]) await expectText(table, column);
});

for (const [name, url, ready] of [
  ["/decisions", "/decisions", (page: Page) => decisionTable(page)],
  ["ADR 0002", ADR_0002, (page: Page) => adrTable(page)],
  ["/metrics", "/metrics", (page: Page) => spendTable(page)],
] as const) {
  test(`AC5: tables do not scroll the page at 375 px on ${name}`, async ({ page }) => {
    test.skip(url === "/metrics" && !!process.env.BASE_URL, "Metrics tables need the local fixture build.");
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto(url);
    await expect(ready(page)).toBeVisible();
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  });
}
