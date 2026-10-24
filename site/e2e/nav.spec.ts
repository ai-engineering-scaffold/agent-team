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
      // Spec 005: the current tab has a 2px bar (the ::after pseudo-element) in the highlight token.
      bar: (() => {
        const after = getComputedStyle(el, "::after");
        return {
          shown: after.content !== "none" && after.display !== "none",
          height: parseFloat(after.height),
          background: after.backgroundColor,
        };
      })(),
    };
  });
}

/** The current tab differs by weight and by a highlight bar that meets 3:1 on the canvas; others have no bar. */
function expectCurrentLook(a: Awaited<ReturnType<typeof look>>, b: Awaited<ReturnType<typeof look>>) {
  expect(a.fontWeight).not.toBe(b.fontWeight);
  expect(b.bar.shown, "a non-current tab has no bar").toBe(false);
  expect(a.bar.shown, "the current tab has a bar").toBe(true);
  expect(a.bar.height).toBeGreaterThanOrEqual(2);
  expect(toHex(a.bar.background)).toBe(tokenHex("highlight"));
  expect(contrastRatio(toHex(a.bar.background), tokenHex("canvas"))).toBeGreaterThanOrEqual(3);
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
    expectCurrentLook(a, b);
  });
}

test("AC4: on an ADR page the Decisions tab is marked as the current section", async ({ page }) => {
  await page.goto("/decisions/0002-six-agent-roles-and-five-gates");
  const decisions = nav(page).getByRole("link", { name: "Decisions" });
  await expect(decisions).toHaveAttribute("aria-current", "true");
  await expect(nav(page).locator("a[aria-current]")).toHaveCount(1);
  const other = await look(nav(page).getByRole("link", { name: "Metrics" }));
  const section = await look(decisions);
  expectCurrentLook(section, other);
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

test("AC8: hovering the site name and a content link changes their text decoration", async ({ page, isMobile }) => {
  test.skip(!!isMobile, "Hover needs a pointer; the desktop project covers it.");
  await page.goto("/decisions");
  const deco = (link: Locator) =>
    link.evaluate((el) => {
      const cs = getComputedStyle(el);
      return cs.textDecorationLine + " " + cs.textDecorationThickness + " " + cs.backgroundColor;
    });
  for (const link of [
    page.getByRole("link", { name: "AI Engineering Scaffold" }).first(),
    page.getByRole("table", { name: "Decision log" }).getByRole("link").first(),
    page.getByRole("contentinfo").getByRole("link", { name: "Contact us" }),
  ]) {
    const before = await deco(link);
    await link.hover();
    expect(await deco(link), "hover changes the link's look").not.toBe(before);
  }
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
  expect(after.bar).toEqual(before.bar);
});

test("AC4: keyboard focus gives every tab a visible outline of at least 2px and 3:1", async ({ page }) => {
  await page.goto("/");
  const headerBg = toHex(await page.locator("header").evaluate((el) => getComputedStyle(el).backgroundColor));
  expect(headerBg).toBe(tokenHex("canvas"));
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

  // Spec 005 AC8 at 375 px: the current page is marked and looks different by more than colour,
  // and every link has a keyboard focus outline.
  for (const { name, path } of tabs) {
    test(`AC8: at 375 px on ${path} only the ${name} tab is current, with a bar and heavier weight`, async ({ page }) => {
      await page.goto(path);
      const current = nav(page).locator('a[aria-current="page"]');
      await expect(current).toHaveCount(1);
      await expect(current).toHaveText(name);
      await expect(nav(page).locator("a[aria-current]")).toHaveCount(1);
      const other = nav(page).getByRole("link", { name: name === "Metrics" ? "Decisions" : "Metrics" });
      expectCurrentLook(await look(current), await look(other));
    });
  }

  test("AC8: at 375 px every tab and the site name show a keyboard focus outline of at least 2px and 3:1", async ({ page }) => {
    await page.goto("/how-we-work");
    for (const link of [page.getByRole("link", { name: "AI Engineering Scaffold" }).first(), ...tabs.map(({ name }) => nav(page).getByRole("link", { name }))]) {
      await link.focus();
      await page.keyboard.press("Shift+Tab");
      await page.keyboard.press("Tab");
      const outline = await link.evaluate((el) => {
        const cs = getComputedStyle(el);
        return { style: cs.outlineStyle, width: parseFloat(cs.outlineWidth), color: cs.outlineColor, active: el === document.activeElement };
      });
      expect(outline.active).toBe(true);
      expect(outline.style).not.toBe("none");
      expect(outline.width).toBeGreaterThanOrEqual(2);
      expect(contrastRatio(toHex(outline.color), tokenHex("canvas"))).toBeGreaterThanOrEqual(3);
    }
  });

  for (const { name, path } of tabs) {
    test(`AC5: the ${name} tab can be clicked and goes to ${path}`, async ({ page }) => {
      await page.goto("/");
      await nav(page).getByRole("link", { name }).click();
      await expect(page).toHaveURL(new RegExp(`${path}/?$`));
    });
  }
});
