import { expect, test, type Locator, type Page } from "@playwright/test";
import { contrastRatio, tokenHex } from "../lib/theme";
import { ADR_0002, cellValues, decisionTable, opaqueHex, spendTable } from "./helpers";

// Spec 005 AC5: an ADR status or a budget status is a badge: a pill with its own border and fill
// that still contains the word. Each status has one badge style wherever it appears.

type BadgeLook = {
  text: string;
  color: string;
  border: string;
  borderWidth: number;
  fill: string;
  radius: number;
  weight: string;
  fontSize: string;
  padding: string;
  behind: string;
};

/** Computed look of a badge element, and the first opaque background behind it. */
function look(badge: Locator): Promise<BadgeLook> {
  return badge.evaluate((el) => {
    const cs = getComputedStyle(el);
    let behind = "rgb(255, 255, 255)";
    for (let node = el.parentElement; node; node = node.parentElement) {
      const c = getComputedStyle(node).backgroundColor;
      if (!/,\s*0\)$/.test(c) && c !== "transparent") {
        behind = c;
        break;
      }
    }
    return {
      text: (el.textContent ?? "").trim(),
      color: cs.color,
      border: cs.borderTopColor,
      borderWidth: parseFloat(cs.borderTopWidth),
      fill: cs.backgroundColor,
      radius: parseFloat(cs.borderTopLeftRadius),
      weight: cs.fontWeight,
      fontSize: cs.fontSize,
      padding: cs.padding,
      behind,
    };
  });
}

/** What makes one status look the same wherever it appears. */
const styleKey = (b: BadgeLook) =>
  [b.color, b.border, b.borderWidth, b.fill, b.radius, b.weight, b.fontSize, b.padding].join("|");

// The tone each status must use (ADR 0017): its border colour and fill tokens.
const tones: Record<string, { border: string; fill: string }> = {
  proposed: { border: "accent", fill: "accent-subtle" },
  accepted: { border: "success", fill: "success-subtle" },
  superseded: { border: "fg-muted", fill: "neutral-subtle" },
  rejected: { border: "danger", fill: "danger-subtle" },
  "Within budget": { border: "success", fill: "success-subtle" },
  "Over budget": { border: "danger", fill: "danger-subtle" },
};

function expectBadge(b: BadgeLook) {
  expect(tones[b.text], `"${b.text}" is a known status`).toBeDefined();
  expect(b.borderWidth, `${b.text} badge has a border`).toBeGreaterThan(0);
  expect(b.radius, `${b.text} badge is a pill`).toBeGreaterThanOrEqual(6);
  expect(opaqueHex(b.border), `${b.text} border token`).toBe(tokenHex(tones[b.text].border as never));
  expect(opaqueHex(b.fill), `${b.text} fill token`).toBe(tokenHex(tones[b.text].fill as never));
  expect(opaqueHex(b.color), `${b.text} text token`).toBe(tokenHex(tones[b.text].border as never));
  // AC2: the border carries the meaning, so it needs 3:1 against what is behind the badge.
  expect(contrastRatio(opaqueHex(b.border), opaqueHex(b.behind)), `${b.text} border on ${b.behind}`).toBeGreaterThanOrEqual(3);
  expect(contrastRatio(opaqueHex(b.color), opaqueHex(b.fill)), `${b.text} text on its fill`).toBeGreaterThanOrEqual(4.5);
}

/** The status badge inside a decisions-index row, found by its visible word. */
const statusBadge = (row: Locator, status: string) => row.getByText(status, { exact: true });

test("AC5: every ADR status in the decisions index is a badge containing the word", async ({ page }) => {
  await page.goto("/decisions");
  const rows = decisionTable(page).getByRole("row");
  const count = await rows.count();
  expect(count).toBeGreaterThan(2);
  const seen = new Set<string>();
  for (let i = 1; i < count; i++) {
    // Cells are ADR, Decision, Status, Date.
    const status = (await cellValues(rows.nth(i)))[2];
    expect(Object.keys(tones), `row ${i} status`).toContain(status);
    const badge = statusBadge(rows.nth(i), status);
    await expect(badge).toHaveCount(1);
    expectBadge(await look(badge));
    seen.add(status);
  }
  expect(seen.size, "the log shows at least two different statuses").toBeGreaterThanOrEqual(2);
});

test("AC5: each ADR status has one badge style across the decisions index", async ({ page }) => {
  await page.goto("/decisions");
  const rows = decisionTable(page).getByRole("row");
  const byStatus = new Map<string, Set<string>>();
  for (let i = 1; i < (await rows.count()); i++) {
    const status = (await cellValues(rows.nth(i)))[2];
    const key = styleKey(await look(statusBadge(rows.nth(i), status)));
    byStatus.set(status, (byStatus.get(status) ?? new Set()).add(key));
  }
  for (const [status, keys] of byStatus) expect(keys.size, `${status} badge styles`).toBe(1);
  // Different statuses look different.
  const all = [...byStatus.values()].map((k) => [...k][0]);
  expect(new Set(all).size).toBe(all.length);
});

async function adrStatusBadge(page: Page, url: string, status: string) {
  await page.goto(url);
  const badge = page.getByRole("definition").getByText(status, { exact: true });
  await expect(badge).toHaveCount(1);
  return badge;
}

test("AC5: an accepted ADR page shows its status as the same badge as the index", async ({ page }) => {
  const onPage = await look(await adrStatusBadge(page, ADR_0002, "accepted"));
  expectBadge(onPage);
  await page.goto("/decisions");
  const row = decisionTable(page).getByRole("row").filter({ hasText: "Six agent roles and five review gates" });
  expect(styleKey(await look(statusBadge(row, "accepted")))).toBe(styleKey(onPage));
});

test("AC5: a proposed ADR page shows its status as the same badge as the index", async ({ page }) => {
  const onPage = await look(await adrStatusBadge(page, "/decisions/0017-site-redesign-theme", "proposed"));
  expectBadge(onPage);
  await page.goto("/decisions");
  const row = decisionTable(page).getByRole("row").filter({ has: page.getByRole("link", { name: /redesign/i }) });
  expect(styleKey(await look(statusBadge(row.first(), "proposed")))).toBe(styleKey(onPage));
});

test.describe("fixture ledger budget badges", () => {
  test.skip(!!process.env.BASE_URL, "Metrics tables need the local fixture build (BASE_URL unset).");

  test("AC5: Within budget and Over budget are badges with the word, in the success and danger styles", async ({ page }) => {
    await page.goto("/metrics");
    const table = spendTable(page);
    const over = statusBadge(table.getByRole("row", { name: /^002 / }), "Over budget");
    const within = statusBadge(table.getByRole("row", { name: /^003 / }), "Within budget");
    await expect(over).toHaveCount(1);
    await expect(within).toHaveCount(1);
    expectBadge(await look(over));
    expectBadge(await look(within));
  });

  test("AC5: every Over budget and Within budget badge in the table shares one style per status", async ({ page }) => {
    await page.goto("/metrics");
    const table = spendTable(page);
    for (const status of ["Over budget", "Within budget"]) {
      const badges = table.getByText(status, { exact: true });
      const n = await badges.count();
      expect(n, `${status} badges`).toBeGreaterThan(0);
      const keys = new Set<string>();
      for (let i = 0; i < n; i++) keys.add(styleKey(await look(badges.nth(i))));
      expect(keys.size, `${status} styles`).toBe(1);
    }
  });
});
