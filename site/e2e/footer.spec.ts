import { expect, test } from "@playwright/test";
import { routes } from "./pages";

// Spec 005 AC9: every page has a footer (contentinfo landmark) with "© YYYY AI Engineering Scaffold",
// where YYYY is the build year read from the build's data-build-year attribute, and a "Contact us"
// mailto link. It stays on one or two lines at 375 px.

for (const route of routes) {
  test(`AC9: ${route} has a contentinfo footer with the build-year copyright`, async ({ page }) => {
    await page.goto(route);
    const footer = page.getByRole("contentinfo");
    await expect(footer).toHaveCount(1);
    await expect(footer).toBeVisible();
    const year = await footer.getAttribute("data-build-year");
    expect(year, "the build exposes its year as data-build-year").toMatch(/^\d{4}$/);
    await expect(footer).toContainText(`© ${year} AI Engineering Scaffold`);
    await expect(footer.getByText(`© ${year} AI Engineering Scaffold`)).toBeVisible();
  });

  test(`AC9: ${route} footer has a Contact us link to mailto:schill1025@gmail.com`, async ({ page }) => {
    await page.goto(route);
    const link = page.getByRole("contentinfo").getByRole("link", { name: "Contact us" });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", "mailto:schill1025@gmail.com");
  });

  test(`AC9: at 375 px the footer on ${route} is visible, on one or two lines, and inside the viewport`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto(route);
    const footer = page.getByRole("contentinfo");
    await expect(footer.getByRole("link", { name: "Contact us" })).toBeVisible();
    const result = await footer.evaluate((el) => {
      // Count visual lines from the vertical positions of every text fragment in the footer.
      const tops = new Set<number>();
      let right = 0;
      let left = Infinity;
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (!(node.textContent ?? "").trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const r of Array.from(range.getClientRects())) {
          if (r.width === 0) continue;
          tops.add(Math.round(r.top));
          right = Math.max(right, r.right);
          left = Math.min(left, r.left);
        }
      }
      return { lines: tops.size, right, left, scrollWidth: document.documentElement.scrollWidth };
    });
    expect(result.lines).toBeGreaterThanOrEqual(1);
    expect(result.lines).toBeLessThanOrEqual(2);
    expect(result.left).toBeGreaterThanOrEqual(0);
    expect(result.right).toBeLessThanOrEqual(375);
    expect(result.scrollWidth).toBeLessThanOrEqual(375);
  });
}

test("AC9: the footer sits below the main content on every page", async ({ page }) => {
  for (const route of routes) {
    await page.goto(route);
    const main = await page.getByRole("main").boundingBox();
    const footer = await page.getByRole("contentinfo").boundingBox();
    expect(footer!.y, route).toBeGreaterThanOrEqual(main!.y + main!.height - 1);
  }
});
