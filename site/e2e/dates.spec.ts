import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { ADR_0002, decisionTable } from "./helpers";
import { routes } from "./pages";

// Spec 005 AC4: dates read like `Oct 23, 2026`, with a time as `Oct 23, 2026, 10:00 UTC`, inside a
// <time> element whose `datetime` holds the original ISO value. No raw ISO text is visible.

const ISO_TEXT = /\d{4}-\d{2}-\d{2}/;

/** The text AC4 expects for an ISO date or timestamp, built here independently of the site. */
function expected(iso: string): string {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(iso);
  const d = new Date(dateOnly ? iso + "T00:00:00Z" : iso);
  const day = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(d);
  if (dateOnly) return day;
  const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "UTC" }).format(d);
  return `${day}, ${time} UTC`;
}

test("AC4: the formatter in this test matches the spec's examples", () => {
  expect(expected("2026-10-23")).toBe("Oct 23, 2026");
  expect(expected("2026-10-23T10:00:00Z")).toBe("Oct 23, 2026, 10:00 UTC");
});

test("AC4: every Date in the decisions index reads like Oct 23, 2026 inside a <time> with the ISO datetime", async ({ page }) => {
  await page.goto("/decisions");
  const table = decisionTable(page);
  const times = table.locator("time");
  const count = await times.count();
  expect(count, "one date per ADR").toBeGreaterThanOrEqual(17);
  expect(count).toBe((await table.getByRole("row").count()) - 1);
  for (let i = 0; i < count; i++) {
    const iso = await times.nth(i).getAttribute("datetime");
    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    await expect(times.nth(i)).toHaveText(expected(iso!));
    await expect(times.nth(i)).toHaveText(/^[A-Z][a-z]{2} \d{1,2}, \d{4}$/);
  }
  await expect(table.getByText(ISO_TEXT)).toHaveCount(0);
});

test("AC4: the decisions index shows ADR 0002's date as Oct 22, 2026", async ({ page }) => {
  await page.goto("/decisions");
  const row = decisionTable(page)
    .getByRole("row")
    .filter({ has: page.getByRole("link", { name: "Six agent roles and five review gates" }) });
  await expect(row.locator("time")).toHaveAttribute("datetime", "2026-10-22");
  await expect(row.locator("time")).toHaveText("Oct 22, 2026");
});

test("AC4: an ADR page shows its date field as a formatted <time> with the front matter's ISO value", async ({ page }) => {
  // The ISO value comes from the ADR file itself, so the test cannot drift from the source.
  const file = path.resolve(__dirname, "..", "..", "decisions", "0002-six-agent-roles-and-five-gates.md");
  const iso = /^date:\s*(\d{4}-\d{2}-\d{2})/m.exec(readFileSync(file, "utf8"))![1];
  await page.goto(ADR_0002);
  const details = page.getByRole("definition").filter({ has: page.locator("time") });
  await expect(details).toHaveCount(1);
  await expect(details.locator("time")).toHaveAttribute("datetime", iso);
  await expect(details.locator("time")).toHaveText(expected(iso));
  // No raw ISO value in the details list (dates in the ADR's prose are left as written).
  for (const definition of await page.getByRole("definition").all()) {
    await expect(definition).not.toHaveText(ISO_TEXT);
  }
});

test.describe("fixture ledger dates", () => {
  test.skip(!!process.env.BASE_URL, "Metrics dates need the local fixture build (BASE_URL unset).");

  test("AC4: Newest run included reads like Oct 21, 2026, 14:05 UTC in a <time> with the ISO timestamp", async ({ page }) => {
    await page.goto("/metrics");
    const time = page.getByText("Newest run included:").locator("time");
    await expect(time).toHaveAttribute("datetime", "2026-10-21T14:05:00Z");
    await expect(time).toHaveText(expected("2026-10-21T14:05:00Z"));
    await expect(time).toHaveText("Oct 21, 2026, 14:05 UTC");
  });

  test("AC4: every Week starting cell reads like Oct 19, 2026 and no ISO date is visible on /metrics", async ({ page }) => {
    await page.goto("/metrics");
    const weeks = page.getByRole("table", { name: "Runs by week" });
    const rowHeaders = weeks.getByRole("rowheader");
    expect(await rowHeaders.count()).toBe(8);
    for (const header of await rowHeaders.all()) {
      const iso = await header.locator("time").getAttribute("datetime");
      await expect(header).toHaveText(expected(iso!));
    }
    await expect(page.getByRole("main").getByText(ISO_TEXT)).toHaveCount(0);
  });
});

for (const route of routes) {
  test(`AC4: every <time> on ${route} has text that matches its datetime`, async ({ page }) => {
    await page.goto(route);
    const pairs = await page.locator("time").evaluateAll((els) =>
      els.map((el) => ({ iso: el.getAttribute("datetime") ?? "", text: (el.textContent ?? "").trim() })),
    );
    for (const { iso, text } of pairs) {
      expect(iso, "datetime holds the ISO value").toMatch(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}.*)?$/);
      expect(text).toBe(expected(iso));
    }
  });
}
