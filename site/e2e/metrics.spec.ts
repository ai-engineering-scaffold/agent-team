import { expect, test } from "@playwright/test";

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
  await expect(page.getByText(/API-equivalent/)).toBeVisible();
  await expect(page.getByText(/subscription/)).toBeVisible();
  const link = page.getByRole("link", { name: "ADR 0007" });
  await expect(link).toHaveAttribute("href", /\/decisions\/0007-/);
  await link.click();
  await expect(page).toHaveURL(/\/decisions\/0007-/);
});

test("AC6: links ADR 0010 for where the data lives", async ({ page }) => {
  await page.goto("/metrics");
  const link = page.getByRole("link", { name: "ADR 0010" });
  await expect(link).toHaveAttribute("href", /\/decisions\/0010-/);
  await link.click();
  await expect(page).toHaveURL(/\/decisions\/0010-/);
});
