import { expect, test, type Locator, type Page } from "@playwright/test";
import { ADR_0002, adrTable, decisionTable, spendTable, weeksTable } from "./helpers";

// Spec 005 AC7: at 375 px no page or table scrolls sideways, every cell's full text is visible, each
// cell's value sits next to its column's name, and tables keep their ARIA roles. The Playwright
// mobile project is 412 px wide, so every test sets its own 375 px viewport.

test.use({ viewport: { width: 375, height: 800 } });

type Target = {
  name: string;
  url: string;
  table: (page: Page) => Locator;
  columns: string[];
  fixtureOnly?: boolean;
};

const targets: Target[] = [
  { name: "the decisions index", url: "/decisions", table: decisionTable, columns: ["ADR", "Decision", "Status", "Date"] },
  { name: "ADR 0002", url: ADR_0002, table: adrTable, columns: [] },
  {
    name: "Spend by spec",
    url: "/metrics",
    table: spendTable,
    columns: ["Spec", "Title", "Spend", "Budget", "Status", "Runs", "Runs with no cost"],
    fixtureOnly: true,
  },
  {
    name: "Runs by week",
    url: "/metrics",
    table: weeksTable,
    columns: ["Week starting", "Runs", "Spend", "Runs not successful"],
    fixtureOnly: true,
  },
];

for (const target of targets) {
  test.describe(`${target.name} at 375 px`, () => {
    test.skip(!!target.fixtureOnly && !!process.env.BASE_URL, "Metrics tables need the local fixture build.");

    test(`AC7: neither the page nor ${target.name} or its containers scroll sideways`, async ({ page }) => {
      await page.goto(target.url);
      const table = target.table(page);
      await expect(table).toBeVisible();
      const result = await table.evaluate((el) => {
        const offenders: string[] = [];
        const check = (node: Element, label: string) => {
          if (node.scrollWidth > node.clientWidth) offenders.push(`${label} scrollWidth ${node.scrollWidth} > ${node.clientWidth}`);
          const overflowX = getComputedStyle(node).overflowX;
          if (overflowX === "auto" || overflowX === "scroll") offenders.push(`${label} overflow-x ${overflowX}`);
        };
        check(el, "table");
        for (let node = el.parentElement; node && node !== document.documentElement; node = node.parentElement) {
          check(node, node.tagName.toLowerCase());
        }
        for (const part of Array.from(el.querySelectorAll("tbody tr, tbody th, tbody td"))) check(part, part.tagName.toLowerCase());
        const doc = document.documentElement;
        if (doc.scrollWidth > doc.clientWidth) offenders.push(`document scrollWidth ${doc.scrollWidth} > ${doc.clientWidth}`);
        const rect = el.getBoundingClientRect();
        if (rect.left < 0 || rect.right > window.innerWidth) offenders.push(`table box ${rect.left}..${rect.right}`);
        return offenders;
      });
      expect(result).toEqual([]);
    });

    test(`AC7: every body cell of ${target.name} is fully visible and unclipped`, async ({ page }) => {
      await page.goto(target.url);
      const table = target.table(page);
      await expect(table).toBeVisible();
      const clipped = await table.evaluate((el) => {
        const bad: string[] = [];
        const cells = Array.from(el.querySelectorAll("tbody th, tbody td"));
        if (cells.length === 0) bad.push("no body cells");
        for (const cell of cells) {
          const label = (cell.textContent ?? "").trim().slice(0, 30);
          const cs = getComputedStyle(cell);
          if (cs.display === "none" || cs.visibility === "hidden") bad.push(`hidden cell: ${label}`);
          if (cs.overflow !== "visible") bad.push(`cell overflow ${cs.overflow}: ${label}`);
          if (cs.clipPath !== "none" || cs.textOverflow === "ellipsis") bad.push(`clipped cell: ${label}`);
          const box = cell.getBoundingClientRect();
          if (box.width === 0 || box.left < 0 || box.right > window.innerWidth) bad.push(`cell box ${box.left}..${box.right}: ${label}`);
          // Every text fragment inside the cell lies within the viewport and within the cell box.
          const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
          for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            if (!(node.textContent ?? "").trim()) continue;
            const parent = node.parentElement!;
            const pcs = getComputedStyle(parent);
            if (pcs.display === "none") bad.push(`text hidden: ${node.textContent!.trim()}`);
            const range = document.createRange();
            range.selectNodeContents(node);
            for (const r of Array.from(range.getClientRects())) {
              if (r.width === 0) continue;
              if (r.left < box.left - 1 || r.right > box.right + 1 || r.right > window.innerWidth) {
                bad.push(`text overflows: ${node.textContent!.trim()}`);
              }
            }
          }
          for (let a: Element | null = cell; a && a !== el; a = a.parentElement) {
            const acs = getComputedStyle(a);
            if (acs.opacity === "0") bad.push(`transparent: ${label}`);
          }
        }
        return [...new Set(bad)];
      });
      expect(clipped).toEqual([]);
    });

    test(`AC7: each data cell of ${target.name} shows its column's name next to its value`, async ({ page }) => {
      await page.goto(target.url);
      const table = target.table(page);
      await expect(table).toBeVisible();
      const problems = await table.evaluate((el) => {
        const bad: string[] = [];
        const headers = Array.from(el.querySelectorAll("thead th")).map((th) => (th.textContent ?? "").trim());
        const rows = Array.from(el.querySelectorAll("tbody tr"));
        if (rows.length === 0) bad.push("no body rows");
        for (const row of rows) {
          const cells = Array.from(row.children);
          cells.forEach((cell, i) => {
            if (cell.getAttribute("role") === "rowheader" || cell.tagName === "TH") return; // the card title
            const labelEl = cell.querySelector('[aria-hidden="true"]');
            const name = headers[i];
            if (!labelEl) return void bad.push(`no label in column ${name}`);
            if ((labelEl.textContent ?? "").trim() !== name) bad.push(`label "${labelEl.textContent}" is not "${name}"`);
            const lcs = getComputedStyle(labelEl);
            const lbox = labelEl.getBoundingClientRect();
            if (lcs.display === "none" || lcs.visibility === "hidden" || lbox.width === 0 || lbox.height === 0) {
              return void bad.push(`label ${name} not visible`);
            }
            // The value is the cell's other content (empty for an empty cell). It sits beside the label.
            const valueEl = Array.from(cell.children).find((c) => c !== labelEl);
            const text = (valueEl?.textContent ?? "").trim();
            if (text && valueEl) {
              const vbox = valueEl.getBoundingClientRect();
              const sameRow = vbox.top < lbox.bottom && vbox.bottom > lbox.top;
              if (!sameRow || vbox.left < lbox.right - 1) bad.push(`value of ${name} is not beside its label`);
            }
          });
        }
        return [...new Set(bad)];
      });
      expect(problems).toEqual([]);
    });

    test(`AC7: ${target.name} keeps its table, row, columnheader, rowheader and cell roles`, async ({ page }) => {
      await page.goto(target.url);
      const table = target.table(page);
      await expect(table).toBeVisible();
      await expect(table.getByRole("row").nth(1)).toBeAttached();
      expect(await table.getByRole("row").count()).toBeGreaterThan(1);
      expect(await table.getByRole("cell").count()).toBeGreaterThan(0);
      const names = await table.getByRole("columnheader").allTextContents();
      expect(names.length).toBeGreaterThan(0);
      if (target.columns.length > 0) expect(names.map((n) => n.trim())).toEqual(target.columns);
      if (target.columns.includes("Spec") || target.columns.includes("Week starting")) {
        expect(await table.getByRole("rowheader").count()).toBeGreaterThan(0);
      }
    });
  });
}

test.describe("column labels do not change accessible names", () => {
  test("AC7: a decisions index row and its first cell are named from content only", async ({ page }) => {
    await page.goto("/decisions");
    const table = decisionTable(page);
    const row = table.getByRole("row").nth(1);
    const name = await row.evaluate((el) => (el as HTMLElement).innerText);
    expect(name).toBeTruthy();
    // Row names start with the ADR number, not the "ADR" label, and carry no column label text.
    await expect(table.getByRole("row", { name: /^\d{4} / }).first()).toBeAttached();
    const bodyRows = table.getByRole("rowgroup").last().getByRole("row");
    await expect(bodyRows.filter({ hasText: /./ }).first()).toBeAttached();
    await expect(bodyRows.and(page.getByRole("row", { name: /^ADR / }))).toHaveCount(0);
    await expect(bodyRows.and(page.getByRole("row", { name: /\bStatus\b/ }))).toHaveCount(0);
    await expect(row.getByRole("cell").first()).toHaveAccessibleName(/^\d{4}$/);
  });

  test("AC7: a Runs by week row is named from its date and values only", async ({ page }) => {
    test.skip(!!process.env.BASE_URL, "Metrics tables need the local fixture build.");
    await page.goto("/metrics");
    const row = weeksTable(page).getByRole("row", { name: "Oct 19, 2026 2 $1.80 0" });
    await expect(row).toHaveCount(1);
  });

  test("AC7: an empty cell still shows its column label with no value", async ({ page }) => {
    test.skip(!!process.env.BASE_URL, "Metrics tables need the local fixture build.");
    await page.goto("/metrics");
    // Spec 001 has no budget, so its Status cell is empty. Its label stays; no badge appears.
    const row = spendTable(page).getByRole("row", { name: /^001 / });
    const status = row.getByRole("cell").nth(3);
    await expect(status).toBeVisible();
    await expect(status.getByText("Status", { exact: true })).toBeVisible();
    await expect(status.getByText(/budget/i)).toHaveCount(0);
    const shown = await status.evaluate((el) => (el as HTMLElement).innerText.trim());
    expect(shown).toBe("Status");
  });
});
