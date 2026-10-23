import { expect, test } from "@playwright/test";

test("home page links to the latest decisions", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.getByRole("link", { name: "All decisions" }).click();
  await expect(page).toHaveURL(/\/decisions$/);
});

test("decision log lists ADRs newest first and opens one", async ({ page }) => {
  await page.goto("/decisions");
  const rows = page.getByRole("row");
  await expect(rows.nth(1)).toContainText("0007");
  await page.getByRole("link", { name: "Run an AI-native engineering org, in public" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Run an AI-native engineering org, in public" })).toBeVisible();
  await expect(page.getByText("Decided by")).toBeVisible();
});

test("an unknown decision returns 404", async ({ page }) => {
  const response = await page.goto("/decisions/9999-nope");
  expect(response?.status()).toBe(404);
});
