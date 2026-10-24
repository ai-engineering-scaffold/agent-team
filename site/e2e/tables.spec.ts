import { expect, test, type Locator, type Page } from "@playwright/test";
import { contrastRatio, tokenHex } from "../lib/theme";
import { ADR_0002, adrTable, decisionTable, opaqueHex, spendTable, weeksTable } from "./helpers";

// Spec 004 table tests as rewritten for spec 005 (AC6 table styling and no-wrap at 1280 px, AC5 the
// Over budget badge) plus spec 004's tables-do-not-scroll-the-page test.
// Tables and cells are located by role and visible text; computed styles are read in the browser.

type CellStyle = {
  background: string;
  fontWeight: number;
  textAlign: string;
  numeric: string;
  borderBottomWidth: number;
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

/**
 * Cells whose text wraps onto a second line: every header cell, and every body cell outside the
 * free-text columns named in `freeText`. Returns "column: text" for each offender.
 */
async function wrappedCells(table: Locator, freeText: string[]): Promise<string[]> {
  return table.evaluate((el, free) => {
    const headers = Array.from(el.querySelectorAll("thead th"));
    const names = headers.map((th) => (th.textContent ?? "").trim());
    const wraps = (cell: Element) => {
      // A wrapped text node has client rects at more than one vertical position.
      const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (!(node.textContent ?? "").trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        const tops = new Set(Array.from(range.getClientRects()).filter((r) => r.width > 0).map((r) => Math.round(r.top)));
        if (tops.size > 1) return true;
      }
      return false;
    };
    const bad: string[] = [];
    headers.forEach((th, i) => {
      if (wraps(th)) bad.push("header: " + names[i]);
    });
    for (const row of Array.from(el.querySelectorAll("tbody tr"))) {
      Array.from(row.children).forEach((cell, i) => {
        if (free.includes(names[i])) return;
        if (wraps(cell)) bad.push(names[i] + ": " + (cell.textContent ?? "").trim());
      });
    }
    return bad;
  }, freeText);
}

// Spec 005 AC6: the layout checks run at 1280 px, where cards do not apply (cards are below 40rem,
// and the Pixel 7 project is 412 px wide).
test.describe("at 1280 px", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

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

    test("AC6: at 1280 px no Spend by spec header, date, number, identifier or badge cell wraps", async ({ page }) => {
      await page.goto("/metrics");
      await expect(spendTable(page)).toBeVisible();
      expect(await wrappedCells(spendTable(page), ["Title"])).toEqual([]);
    });

    test("AC6: at 1280 px no Runs by week header, date or number cell wraps", async ({ page }) => {
      await page.goto("/metrics");
      await expect(weeksTable(page)).toBeVisible();
      expect(await wrappedCells(weeksTable(page), [])).toEqual([]);
    });

    test("AC5: the over-budget 002 row shows a danger Over budget badge, unlike 003's Within budget badge", async ({
      page,
    }) => {
      await page.goto("/metrics");
      const table = spendTable(page);
      const over = table.getByRole("row", { name: /^002 / });
      const normal = table.getByRole("row", { name: /^003 / });
      await expect(over).toContainText("Over budget");
      await expect(normal).not.toContainText("Over budget");

      const overBadge = over.getByText("Over budget", { exact: true });
      const withinBadge = normal.getByText("Within budget", { exact: true });
      await expect(overBadge).toBeVisible();
      await expect(withinBadge).toBeVisible();
      const style = (badge: Locator) =>
        badge.evaluate((el) => {
          const cs = getComputedStyle(el);
          return {
            border: cs.borderTopColor,
            borderWidth: parseFloat(cs.borderTopWidth),
            fill: cs.backgroundColor,
            radius: parseFloat(cs.borderTopLeftRadius),
          };
        });
      const a = await style(overBadge);
      const b = await style(withinBadge);
      expect(a.borderWidth, "the badge has a border").toBeGreaterThan(0);
      expect(a.radius, "the badge is a pill").toBeGreaterThan(0);
      expect(opaqueHex(a.border)).toBe(tokenHex("danger"));
      expect(opaqueHex(a.fill)).toBe(tokenHex("danger-subtle"));
      expect(opaqueHex(b.border)).toBe(tokenHex("success"));
      expect(a.border !== b.border && a.fill !== b.fill, "Over and Within budget badges differ").toBe(true);
    });

    test("AC2: the Over budget badge border meets 3:1 against the row background and its own fill", async ({
      page,
    }) => {
      await page.goto("/metrics");
      const over = spendTable(page).getByRole("row", { name: /^002 / });
      const badge = over.getByText("Over budget", { exact: true });
      await expect(badge).toBeVisible();

      // Walk up to the first opaque background: that is what the badge sits on.
      const { border, fill, behind } = await badge.evaluate((el) => {
        const cs = getComputedStyle(el);
        let behind = "rgba(0, 0, 0, 0)";
        for (let node = el.parentElement; node; node = node.parentElement) {
          const c = getComputedStyle(node).backgroundColor;
          if (!/,\s*0\)$/.test(c) && c !== "transparent") {
            behind = c;
            break;
          }
        }
        return { border: cs.borderTopColor, fill: cs.backgroundColor, behind };
      });
      expect(contrastRatio(opaqueHex(border), opaqueHex(behind)), `border ${border} on ${behind}`).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(opaqueHex(border), opaqueHex(fill)), `border ${border} on fill ${fill}`).toBeGreaterThanOrEqual(3);
    });
  });

  test("AC6: the decisions index has a distinct header, separators, and left-aligned text columns", async ({ page }) => {
    await page.goto("/decisions");
    const table = decisionTable(page);
    await expect(table).toBeVisible();
    await expectHeaderSetApart(table, "Decision");
    for (const column of ["ADR", "Decision", "Status", "Date"]) await expectText(table, column);
  });

  test("AC6: at 1280 px no decisions index header, date, identifier or badge cell wraps", async ({ page }) => {
    await page.goto("/decisions");
    await expect(decisionTable(page)).toBeVisible();
    expect(await wrappedCells(decisionTable(page), ["Decision"])).toEqual([]);
  });

  test("AC6: the Markdown table in ADR 0002 has a distinct header, separators, and left-aligned text", async ({ page }) => {
    await page.goto(ADR_0002);
    const table = adrTable(page);
    await expect(table).toBeVisible();
    await expectHeaderSetApart(table, "Role");
    for (const column of ["Role", "Owns"]) await expectText(table, column);
  });
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
