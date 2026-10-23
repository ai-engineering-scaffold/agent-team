import { expect, test, type Locator, type Page } from "@playwright/test";
import { contrastRatio, tokenHex } from "../lib/theme";
import { routes } from "./pages";

// Spec 004: Site theme, AC4 (current-page nav, hover and focus) and AC5 (reachable at 375 px).

const tabs = [
  { name: "How we work", path: "/how-we-work" },
  { name: "Decisions", path: "/decisions" },
  { name: "Metrics", path: "/metrics" },
];

const nav = (page: Page) => page.getByRole("navigation", { name: "Main" });

function toHex(rgb: string): string {
  const m = /^rgba?\((\d+)[, ]+(\d+)[, ]+(\d+)/.exec(rgb.trim());
  if (!m) throw new Error(`Not an rgb colour: ${rgb}`);
  return "#" + [m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, "0")).join("").toUpperCase();
}

function look(link: Locator) {
  return link.evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      fontWeight: cs.fontWeight,
      background: cs.backgroundColor,
      border: cs.borderTopWidth + " " + cs.borderTopStyle + " " + cs.borderTopColor,
      decoration: cs.textDecorationLine,
    };
  });
}

for (const { name, path } of tabs) {
  test(`AC4: on ${path} only the ${name} tab is the current page, and it looks different`, async ({ page }) => {
    await page.goto(path);
    const current = nav(page).locator('a[aria-current="page"]');
    await expect(current).toHaveCount(1);
    await expect(current).toHaveText(name);
    await expect(nav(page).locator("a[aria-current]")).toHaveCount(1);

    const other = nav(page).getByRole("link", { name: name === "Metrics" ? "Decisions" : "Metrics" });
    await expect(other).not.toHaveAttribute("aria-current", /.*/);
    const a = await look(current);
    const b = await look(other);
    expect(a.fontWeight).not.toBe(b.fontWeight);
    expect(a.background !== b.background || a.border !== b.border).toBe(true);
  });
}

test("AC4: on an ADR page the Decisions tab is marked as the current section", async ({ page }) => {
  await page.goto("/decisions/0002-six-agent-roles-and-five-gates");
  const decisions = nav(page).getByRole("link", { name: "Decisions" });
  await expect(decisions).toHaveAttribute("aria-current", "true");
  await expect(nav(page).locator("a[aria-current]")).toHaveCount(1);
  const other = await look(nav(page).getByRole("link", { name: "Metrics" }));
  const section = await look(decisions);
  expect(section.fontWeight).not.toBe(other.fontWeight);
  expect(section.background).not.toBe(other.background);
});

test("AC4: the home page has no current tab", async ({ page }) => {
  await page.goto("/");
  await expect(nav(page).getByRole("link")).toHaveCount(3);
  await expect(nav(page).locator("a[aria-current]")).toHaveCount(0);
});

test("AC4: hovering a tab changes its background or text decoration", async ({ page, isMobile }) => {
  test.skip(!!isMobile, "Hover needs a pointer; the desktop project covers it.");
  await page.goto("/");
  const link = nav(page).getByRole("link", { name: "Metrics" });
  const before = await look(link);
  await link.hover();
  const after = await look(link);
  expect(after.background !== before.background || after.decoration !== before.decoration).toBe(true);
});

test("AC4: the current tab keeps its fill and weight when hovered", async ({ page, isMobile }) => {
  test.skip(!!isMobile, "Hover needs a pointer; the desktop project covers it.");
  await page.goto("/metrics");
  const link = nav(page).getByRole("link", { name: "Metrics" });
  const before = await look(link);
  await link.hover();
  const after = await look(link);
  expect(after.background).toBe(before.background);
  expect(after.fontWeight).toBe(before.fontWeight);
});

test("AC4: keyboard focus gives every tab a visible outline of at least 2px and 3:1", async ({ page }) => {
  await page.goto("/");
  const headerBg = toHex(await page.locator("header").evaluate((el) => getComputedStyle(el).backgroundColor));
  expect(headerBg).toBe(tokenHex("white"));
  for (const { name } of tabs) {
    const link = nav(page).getByRole("link", { name });
    let focused = false;
    for (let i = 0; i < 12 && !focused; i++) {
      await page.keyboard.press("Tab");
      focused = await link.evaluate((el) => el === document.activeElement);
    }
    expect(focused, `${name} should be reachable with the Tab key`).toBe(true);
    const outline = await link.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { style: cs.outlineStyle, width: parseFloat(cs.outlineWidth), color: cs.outlineColor };
    });
    expect(outline.style).not.toBe("none");
    expect(outline.width).toBeGreaterThanOrEqual(2);
    expect(contrastRatio(toHex(outline.color), headerBg)).toBeGreaterThanOrEqual(3);
  }
});

test.describe("at 375 px", () => {
  test.use({ viewport: { width: 375, height: 800 } });

  for (const route of routes) {
    test(`AC5: ${route} shows every nav link inside the viewport without sideways scroll`, async ({ page }) => {
      await page.goto(route);
      for (const { name } of tabs) {
        const link = nav(page).getByRole("link", { name });
        await expect(link).toBeVisible();
        const box = await link.boundingBox();
        expect(box, `${name} has a box`).not.toBeNull();
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(375);
        expect(box!.y).toBeGreaterThanOrEqual(0);
        expect(box!.y + box!.height).toBeLessThanOrEqual(800);
      }
      const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
    });
  }

  for (const { name, path } of tabs) {
    test(`AC5: the ${name} tab can be clicked and goes to ${path}`, async ({ page }) => {
      await page.goto("/");
      await nav(page).getByRole("link", { name }).click();
      await expect(page).toHaveURL(new RegExp(`${path}/?$`));
    });
  }
});
