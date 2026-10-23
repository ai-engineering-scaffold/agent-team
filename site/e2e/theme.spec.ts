import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { ALLOWED_COLOURS, contrastRatio, tokenHex } from "../lib/theme";
import { routes } from "./pages";

// Spec 004: Site theme, AC1 and AC2 (text, links, focus ring). Colours come from the tokens in
// lib/theme.ts (ADR 0014).

const allowed = new Set(ALLOWED_COLOURS.map((c) => c.toUpperCase()));

type Seen = { where: string; value: string };

/** Collects every colour rendered on the page, as "where: value" pairs, in the browser. */
async function collectComputedColours(page: Page): Promise<Seen[]> {
  return page.evaluate(() => {
    const out: { where: string; value: string }[] = [];
    const sides = ["top", "right", "bottom", "left"];
    const label = (el: Element) => el.tagName.toLowerCase();
    const add = (el: Element, prop: string, value: string) => out.push({ where: label(el) + " " + prop, value });
    const all = [document.documentElement, document.body, ...Array.from(document.body.querySelectorAll("*"))];
    for (const el of all) {
      const cs = getComputedStyle(el);
      if (cs.display === "none") continue;
      add(el, "color", cs.color);
      add(el, "background-color", cs.backgroundColor);
      for (const side of sides) {
        if (cs.getPropertyValue("border-" + side + "-style") === "none") continue;
        if (parseFloat(cs.getPropertyValue("border-" + side + "-width")) === 0) continue;
        add(el, "border-" + side + "-color", cs.getPropertyValue("border-" + side + "-color"));
      }
      if (cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0) add(el, "outline-color", cs.outlineColor);
      if (cs.textDecorationLine !== "none") add(el, "text-decoration-color", cs.textDecorationColor);
    }
    return out;
  });
}

/** Converts a computed `rgb()`/`rgba()` string to upper-case hex; returns null for transparent. */
function toHex(value: string): string | null {
  const m = /^rgba?\(([^)]+)\)$/.exec(value.trim());
  if (!m) return value; // Not an rgb() value: pass it through so the assertion reports it.
  const parts = m[1].split(/[\s,/]+/).filter(Boolean);
  const alpha = parts.length > 3 ? parseFloat(parts[3]) : 1;
  if (alpha === 0) return null;
  if (alpha < 1) return value; // Translucent colours are not allowed.
  const hex = parts
    .slice(0, 3)
    .map((p) => Math.round(parseFloat(p)).toString(16).padStart(2, "0"))
    .join("");
  return ("#" + hex).toUpperCase();
}

function offenders(colours: Seen[]): string[] {
  const bad: string[] = [];
  for (const { where, value } of colours) {
    const hex = toHex(value);
    if (hex !== null && !allowed.has(hex)) bad.push(where + ": " + value);
  }
  return [...new Set(bad)];
}

for (const route of routes) {
  test("AC1: every computed colour on " + route + " is a palette token", async ({ page }) => {
    await page.goto(route);
    expect(offenders(await collectComputedColours(page))).toEqual([]);
  });

  test("AC1: " + route + " keeps the cream page and token colours when the system prefers dark", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto(route);
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(toHex(bg)).toBe(tokenHex("cream"));
    expect(offenders(await collectComputedColours(page))).toEqual([]);
  });

  test("AC1: link, visited, hover, focus and selection rules on " + route + " use only palette tokens", async ({
    page,
  }) => {
    await page.goto(route);
    const found = await page.evaluate(() => {
      const pseudo = /:visited|:hover|:focus-visible|::selection/;
      const colourLike =
        /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix)\([^)]*\)|\b(?:red|blue|green|black|white|gray|grey|orange|yellow|purple|pink|brown|navy|teal|silver|maroon|lime|aqua|fuchsia|olive)\b/gi;
      const root = getComputedStyle(document.documentElement);
      const resolve = (text: string) =>
        text.replace(/var\((--[\w-]+)[^)]*\)/g, (_m, name: string) => root.getPropertyValue(name).trim());
      const values: { selector: string; value: string }[] = [];
      let rulesSeen = 0;
      const walk = (rules: CSSRuleList) => {
        for (const rule of Array.from(rules)) {
          if (rule instanceof CSSStyleRule) {
            if (!pseudo.test(rule.selectorText)) continue;
            rulesSeen++;
            const text = resolve(rule.style.cssText);
            for (const m of text.match(colourLike) ?? []) values.push({ selector: rule.selectorText, value: m });
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
      return { values, rulesSeen };
    });
    // The theme defines visited, hover, focus and selection rules, so there must be some to check.
    expect(found.rulesSeen).toBeGreaterThanOrEqual(4);
    const bad = found.values
      .filter(({ value }) => !(/^#[0-9a-f]{6}$/i.test(value) && allowed.has(value.toUpperCase())))
      .map(({ selector, value }) => selector + ": " + value);
    expect(bad).toEqual([]);
  });

  test("AC2: " + route + " has no colour-contrast violations", async ({ page }) => {
    await page.goto(route);
    const results = await new AxeBuilder({ page }).withRules(["color-contrast"]).analyze();
    expect(
      results.violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target.join(" ")) })),
    ).toEqual([]);
  });

  test("AC2: the keyboard focus ring on the first link of " + route + " is visible and reaches 3:1", async ({
    page,
  }) => {
    await page.goto(route);
    let focused = false;
    for (let i = 0; i < 10 && !focused; i++) {
      await page.keyboard.press("Tab");
      focused = await page.evaluate(() => document.activeElement?.tagName === "A");
    }
    expect(focused, "Tab should reach a link").toBe(true);
    const ring = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement;
      const cs = getComputedStyle(el);
      // Walk up to the first opaque background, which is what the ring sits on.
      let bg = "rgba(0, 0, 0, 0)";
      for (let node: HTMLElement | null = el; node; node = node.parentElement) {
        const c = getComputedStyle(node).backgroundColor;
        if (!/,\s*0\)$/.test(c) && c !== "transparent") {
          bg = c;
          break;
        }
      }
      return { style: cs.outlineStyle, width: parseFloat(cs.outlineWidth), colour: cs.outlineColor, bg };
    });
    expect(ring.style).not.toBe("none");
    expect(ring.width).toBeGreaterThanOrEqual(2);
    const ringHex = toHex(ring.colour);
    const bgHex = toHex(ring.bg);
    expect(ringHex).not.toBeNull();
    expect(bgHex).not.toBeNull();
    expect(contrastRatio(ringHex as string, bgHex as string)).toBeGreaterThanOrEqual(3);
  });
}

// Spec 004, AC3: headings and body text use two different fonts, both served from this site.

/** First family of a computed font-family list, with its quotes removed. */
function firstFamily(list: string): string {
  return list.split(",")[0].trim().replace(/^["']+|["']+$/g, "");
}

for (const route of routes) {
  test("AC3: " + route + " serves fonts same-origin and has loaded FontFaces for heading and body", async ({
    page,
  }) => {
    const fontUrls: string[] = [];
    page.on("request", (request) => {
      if (request.resourceType() === "font") fontUrls.push(request.url());
    });
    await page.goto(route);
    const origin = new URL(page.url()).origin;
    await page.evaluate(() => document.fonts.ready);

    for (const url of fontUrls) expect(new URL(url).origin, "font request " + url).toBe(origin);

    const heading = page.getByRole("heading", { level: 1 }).first();
    const paragraph = page.getByRole("paragraph").first();
    const headingFamily = firstFamily(await heading.evaluate((el) => getComputedStyle(el).fontFamily));
    const bodyFamily = firstFamily(await paragraph.evaluate((el) => getComputedStyle(el).fontFamily));

    for (const family of [headingFamily, bodyFamily]) {
      const statuses = await page.evaluate(
        (name) =>
          Array.from(document.fonts)
            .filter((face) => face.family.replace(/^["']+|["']+$/g, "") === name)
            .map((face) => face.status),
        family,
      );
      expect(statuses, "FontFace for " + family).toContain("loaded");
    }
    expect(headingFamily).not.toBe(bodyFamily);
  });
}
