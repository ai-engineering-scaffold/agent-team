import { expect, test, type Page } from "@playwright/test";

// Spec 003: Metrics page. Runs against the local production build, which prebuild fills with the
// fixture ledger in e2e/fixtures/ledger (see its README.txt). A BASE_URL preview reads live
// `metrics` data, so these tests are skipped there rather than asserting numbers that would differ.
test.skip(!!process.env.BASE_URL, "Metrics tests need the local fixture build (BASE_URL unset).");

test("AC1: /metrics shows a level-one heading 'Metrics'", async ({ page }) => {
  await page.goto("/metrics");
  await expect(page.getByRole("heading", { level: 1, name: "Metrics" })).toBeVisible();
});

test("AC1: the main navigation has a Metrics link on every page", async ({ page }) => {
  for (const url of ["/", "/how-we-work", "/decisions", "/metrics"]) {
    await page.goto(url);
    const link = page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Metrics" });
    await expect(link, `nav link on ${url}`).toBeVisible();
    await expect(link, `nav link target on ${url}`).toHaveAttribute("href", "/metrics");
  }
  await page.goto("/");
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Metrics" }).click();
  await expect(page).toHaveURL(/\/metrics$/);
  await expect(page.getByRole("heading", { level: 1, name: "Metrics" })).toBeVisible();
});

test("AC6: states the newest run's date and time in UTC", async ({ page }) => {
  await page.goto("/metrics");
  // Newest fixture run is 5013 at 2026-10-21T14:05:00Z.
  await expect(page.getByText("2026-10-21 14:05 UTC")).toBeVisible();
});

test("AC6: says dollars are API-equivalent and links ADR 0007", async ({ page }) => {
  await page.goto("/metrics");
  await expect(page.getByText(/API-equivalent costs: agents run on a Claude subscription/)).toBeVisible();
  const link = page.getByRole("link", { name: "ADR 0007" });
  await expect(link).toHaveAttribute("href", /\/decisions\/0007-/);
  await link.click();
  await expect(page).toHaveURL(/\/decisions\/0007-/);
});

// Spend by spec (issue 35). Rows are located by role and visible text; none of these tests counts
// rows, because specs/ grows with every spec.
const spendTable = (page: Page) => page.getByRole("table", { name: "Spend by spec" });

test("AC2: Spend by spec lists specs 001, 002, 003, Unknown spec 999, then Chores last, in order", async ({ page }) => {
  await page.goto("/metrics");
  await expect(page.getByRole("heading", { level: 2, name: "Spend by spec" })).toBeVisible();
  const table = spendTable(page);
  const labels = await table.getByRole("rowheader").allTextContents();
  const wanted = ["001", "002", "003", "Unknown spec 999", "Chores"];
  for (const label of wanted) {
    expect(labels, `row ${label}`).toContain(label);
  }
  const positions = wanted.map((label) => labels.indexOf(label));
  expect(positions, "rows appear in spec order, unknown specs, then Chores").toEqual(
    [...positions].sort((a, b) => a - b),
  );
  expect(labels[labels.length - 1]).toBe("Chores");

  // Spend and budget for the fixture rows.
  const row002 = table.getByRole("row", { name: /^002 / });
  await expect(row002).toContainText("$16.10");
  await expect(row002).toContainText("$15.00");
  await expect(table.getByRole("row", { name: /^003 / })).toContainText("$6.95");
  await expect(table.getByRole("row", { name: /^Unknown spec 999/ })).toContainText("$2.95");
  await expect(table.getByRole("row", { name: /^Chores/ })).toContainText("$0.75");
});

test("AC3: spec 002 says Over budget and spec 001 says Not recorded", async ({ page }) => {
  await page.goto("/metrics");
  const table = spendTable(page);
  await expect(table.getByRole("row", { name: /^002 / })).toContainText("Over budget");
  const row001 = table.getByRole("row", { name: /^001 / });
  await expect(row001).toContainText("Not recorded");
  await expect(row001).not.toContainText("$0.00");
  await expect(table.getByRole("row", { name: /^003 / })).not.toContainText("Over budget");
});

// Runs by week (issue 36). The fixture ledger's weeks are listed in e2e/fixtures/ledger/README.txt.
const weeksTable = (page: Page) => page.getByRole("table", { name: "Runs by week" });

// Week starting, runs, spend, runs not successful.
const fixtureWeeks: [string, string, string, string][] = [
  ["2026-10-19", "2", "$1.80", "0"],
  ["2026-10-12", "2", "$6.35", "1"],
  ["2026-10-05", "0", "$0.00", "0"],
  ["2026-09-28", "2", "$1.28", "1"],
  ["2026-09-21", "1", "$0.80", "0"],
  ["2026-09-14", "2", "$7.77", "0"],
  ["2026-09-07", "2", "$1.10", "1"],
  ["2026-08-31", "1", "$6.40", "0"],
];

test("AC4: Runs by week lists 8 weeks, newest first, starting 2026-10-19", async ({ page }) => {
  await page.goto("/metrics");
  await expect(page.getByRole("heading", { level: 2, name: "Runs by week" })).toBeVisible();
  const table = weeksTable(page);
  await expect(table).toBeVisible();
  const weeks = await table.getByRole("rowheader").allTextContents();
  expect(weeks).toHaveLength(8);
  expect(weeks[0]).toBe("2026-10-19");
  expect(weeks).toEqual(fixtureWeeks.map(([week]) => week));
  expect(weeks, "newest first").toEqual([...weeks].sort().reverse());
  // 2026-08-24 holds run 5001 but is older than 8 weeks.
  expect(weeks).not.toContain("2026-08-24");
});

test("AC4: every Runs by week row shows its runs, spend and not-successful counts", async ({ page }) => {
  await page.goto("/metrics");
  const table = weeksTable(page);
  for (const [week, runs, spend, notSuccess] of fixtureWeeks) {
    const row = table.getByRole("row", { name: new RegExp(`^${week} `) });
    await expect(row.getByRole("rowheader")).toHaveText(week);
    await expect(row.getByRole("cell"), `row ${week}`).toHaveText([runs, spend, notSuccess]);
  }
});

test("AC4: the empty week 2026-10-05 shows zeros", async ({ page }) => {
  await page.goto("/metrics");
  const row = weeksTable(page).getByRole("row", { name: /^2026-10-05 / });
  await expect(row).toBeVisible();
  await expect(row.getByRole("cell")).toHaveText(["0", "$0.00", "0"]);
});

test("AC4: a week with a run that was not a success counts it", async ({ page }) => {
  await page.goto("/metrics");
  const table = weeksTable(page);
  // 2026-10-12 has 5011 (max_turns) among 2 runs; 2026-10-19 has none.
  await expect(table.getByRole("row", { name: /^2026-10-12 / }).getByRole("cell").nth(2)).toHaveText("1");
  await expect(table.getByRole("row", { name: /^2026-10-19 / }).getByRole("cell").nth(2)).toHaveText("0");
});

test("AC7: at 375 px the page does not scroll horizontally with both tables", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/metrics");
  await expect(spendTable(page)).toBeVisible();
  await expect(weeksTable(page)).toBeVisible();
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
});

test("AC6: links ADR 0010 for where the data lives", async ({ page }) => {
  await page.goto("/metrics");
  const link = page.getByRole("link", { name: "ADR 0010" });
  await expect(link).toHaveAttribute("href", /\/decisions\/0010-/);
  await link.click();
  await expect(page).toHaveURL(/\/decisions\/0010-/);
});
