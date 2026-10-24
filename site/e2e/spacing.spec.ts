import { expect, test, type Page } from "@playwright/test";
import { routes } from "./pages";

// Spec 005 AC3: every margin, padding and gap comes from the spacing scale (ADR 0017), or is 0, or
// is `auto` where it centres a block. Authored values are read from the stylesheet rules, because
// computed style reports `auto` as pixels. Computed values are checked as well, so nothing the
// browser adds by default (a list's indent, a heading's margin) can slip past the rules.

const SCALE_PX = [4, 8, 12, 16, 24, 32, 48, 64];

/** Every spacing declaration in the site's stylesheets, with `var(--space-N)` resolved to pixels. */
async function authoredSpacing(page: Page) {
  return page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    const rootPx = parseFloat(root.fontSize);
    const found: { selector: string; prop: string; value: string; bad: string[] }[] = [];
    const toPx = (token: string): string => {
      const t = token.trim();
      if (t === "auto" || t === "0" || t === "0px") return t;
      const v = /^var\((--space-\d)\)$/.exec(t);
      if (v) {
        const raw = root.getPropertyValue(v[1]).trim();
        const rem = /^([\d.]+)rem$/.exec(raw);
        return rem ? String(parseFloat(rem[1]) * rootPx) : "unresolved:" + raw;
      }
      return "not-a-token:" + t;
    };
    const walk = (rules: CSSRuleList) => {
      for (const rule of Array.from(rules)) {
        if (rule instanceof CSSStyleRule) {
          for (const decl of rule.style.cssText.split(";")) {
            const i = decl.indexOf(":");
            if (i < 0) continue;
            const prop = decl.slice(0, i).trim();
            if (!/^(?:margin|padding)(?:-[a-z]+)*$|^(?:row-|column-)?gap$/.test(prop)) continue;
            const value = decl.slice(i + 1).trim();
            // Split on top-level spaces so `var(--space-2)` stays one token.
            const tokens = value.match(/var\([^)]*\)|[^\s]+/g) ?? [];
            found.push({ selector: rule.selectorText, prop, value, bad: tokens.map(toPx) });
          }
        } else if ("cssRules" in rule) {
          walk((rule as CSSGroupingRule).cssRules);
        }
      }
    };
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        walk(sheet.cssRules);
      } catch {
        // A cross-origin sheet cannot be read; the site loads none.
      }
    }
    return found;
  });
}

for (const route of routes) {
  test(`AC3: every margin, padding and gap rule on ${route} is a scale value, 0 or auto`, async ({ page }) => {
    await page.goto(route);
    const rules = await authoredSpacing(page);
    expect(rules.length, "the site styles define spacing rules").toBeGreaterThan(20);
    const offenders: string[] = [];
    for (const { selector, prop, value, bad } of rules) {
      for (const token of bad) {
        if (token === "auto" || token === "0" || token === "0px") continue;
        if (SCALE_PX.includes(Number(token))) continue;
        offenders.push(`${selector} { ${prop}: ${value} } -> ${token}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  for (const width of [1280, 375]) {
    test(`AC3: computed spacing on ${route} at ${width} px stays on the scale`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(route);
      const offenders = await page.evaluate(
        ({ scale }) => {
          const props = [
            "margin-top", "margin-right", "margin-bottom", "margin-left",
            "padding-top", "padding-right", "padding-bottom", "padding-left",
            "row-gap", "column-gap",
          ];
          const bad = new Set<string>();
          const selectors = ["header", "header div", "nav", "nav ul", "nav li", "nav a", "main", "main > *", "h1", "h2", "h3", "h4",
            "p", "ul", "ol", "li", "dl", "dt", "dd", "table", "th", "td", "tr", "footer", "footer div", "pre", "code", "blockquote",
            "article", "section", "span"];
          for (const el of Array.from(document.querySelectorAll(selectors.join(",")))) {
            const cs = getComputedStyle(el);
            if (cs.display === "none") continue;
            for (const prop of props) {
              const raw = cs.getPropertyValue(prop);
              if (raw === "normal") continue;
              const px = parseFloat(raw);
              if (px === 0 || scale.includes(px)) continue;
              // A block centred with `margin-inline: auto` has equal side margins of any size.
              if (prop === "margin-left" || prop === "margin-right") {
                if (cs.marginLeft === cs.marginRight && ["main", "div"].includes(el.tagName.toLowerCase())) continue;
              }
              bad.add(`${el.tagName.toLowerCase()} ${prop}: ${raw}`);
            }
          }
          return [...bad];
        },
        { scale: SCALE_PX },
      );
      expect(offenders).toEqual([]);
    });
  }

  test(`AC3: main content on ${route} has a maximum width and centres on a wide screen`, async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 900 });
    await page.goto(route);
    const main = page.getByRole("main");
    const { left, right, width, maxWidth } = await main.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return {
        left: r.left,
        right: window.innerWidth - r.right,
        width: r.width,
        maxWidth: getComputedStyle(el).maxWidth,
      };
    });
    expect(maxWidth, "main sets a max-width").not.toBe("none");
    expect(width).toBeLessThan(1920);
    expect(Math.abs(left - right), "equal space on both sides").toBeLessThanOrEqual(1);
    expect(left).toBeGreaterThan(0);
  });

  test(`AC3: at 375 px main content on ${route} has side gutters of at least 16 px`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 900 });
    await page.goto(route);
    const gutters = await page.getByRole("main").evaluate((el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return {
        left: r.left + parseFloat(cs.paddingLeft) + parseFloat(cs.borderLeftWidth),
        right: window.innerWidth - r.right + parseFloat(cs.paddingRight) + parseFloat(cs.borderRightWidth),
      };
    });
    expect(gutters.left).toBeGreaterThanOrEqual(16);
    expect(gutters.right).toBeGreaterThanOrEqual(16);
    // The visible heading starts inside the gutter too.
    const heading = await page.getByRole("heading", { level: 1 }).first().boundingBox();
    expect(heading!.x).toBeGreaterThanOrEqual(16);
  });
}
