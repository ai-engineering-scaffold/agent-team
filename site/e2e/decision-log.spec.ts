import { readdirSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

// Tests run from site/, ADRs live one level up. The newest ADR is read from disk so a new ADR can't break this test.
const DECISIONS_DIR = path.resolve(__dirname, "..", "..", "decisions");
const newestAdr = readdirSync(DECISIONS_DIR)
  .filter((f) => /^\d{4}-.+\.md$/.test(f) && !f.startsWith("0000-"))
  .sort()
  .at(-1)
  ?.slice(0, 4);

test("home page links to the latest decisions", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.getByRole("link", { name: "All decisions" }).click();
  await expect(page).toHaveURL(/\/decisions$/);
});

test("decision log lists ADRs newest first and opens one", async ({ page }) => {
  await page.goto("/decisions");
  expect(newestAdr).toBeDefined();
  const rows = page.getByRole("row");
  await expect(rows.nth(1)).toContainText(newestAdr!);
  await page.getByRole("link", { name: "Run an AI-native engineering org, in public" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Run an AI-native engineering org, in public" })).toBeVisible();
  await expect(page.getByText("Decided by")).toBeVisible();
});

test("an unknown decision returns 404", async ({ page }) => {
  const response = await page.goto("/decisions/9999-nope");
  expect(response?.status()).toBe(404);
});
