import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Spec 006 (issue #59): the "How work flows" figure on the homepage. Elements are located by role
// and visible text. AC7 is covered by the theme tests on `/`, AC8 by the unit tests and
// how-we-work.spec.ts, and AC9 by the whole existing suite.

const STEPS = [
  { name: "Spec", owners: [/spec writer agent drafts/i, /Graham approves/i] },
  { name: "Plan", owners: [/tech lead agent/i] },
  { name: "Build", owners: [/engineer/i, /QA/] },
  { name: "CI", owners: [/automation/i] },
  { name: "Review", owners: [/code reviewer agent/i] },
  { name: "Merge", owners: [/Graham/, /automation for low-risk changes \(ADR 0006\)/i] },
];

const figure = (page: Page) => page.getByRole("figure", { name: "How work flows" });
const words = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

/** The ordered list of steps inside the figure. */
async function stepList(page: Page) {
  const fig = figure(page);
  await expect(fig).toBeVisible();
  const lists = fig.getByRole("list");
  const list = lists.first();
  expect(await list.evaluate((el) => el.tagName)).toBe("OL");
  return list;
}

/** Each step card's text lines: name, owner and description, as rendered. */
async function stepCards(page: Page) {
  const list = await stepList(page);
  return list.getByRole("listitem").evaluateAll((items) =>
    items.map((li) => ({
      name: (li.querySelector("h3")?.textContent ?? "").trim(),
      paragraphs: Array.from(li.querySelectorAll("p")).map((p) => (p.textContent ?? "").trim()),
    })),
  );
}

test.describe("AC1: the figure lists the six steps, their owners and short descriptions", () => {
  test("AC1: the homepage has a figure titled How work flows", async ({ page }) => {
    await page.goto("/");
    await expect(figure(page)).toBeVisible();
    await expect(figure(page).getByRole("heading", { name: "How work flows" })).toBeVisible();
  });

  test("AC1: the six steps appear in order: Spec, Plan, Build, CI, Review, Merge", async ({ page }) => {
    await page.goto("/");
    const cards = await stepCards(page);
    expect(cards.map((c) => c.name)).toEqual(STEPS.map((s) => s.name));
  });

  test("AC1: each step names its owner as the spec requires", async ({ page }) => {
    await page.goto("/");
    const cards = await stepCards(page);
    STEPS.forEach((step, i) => {
      const owner = cards[i].paragraphs[0] ?? "";
      for (const pattern of step.owners) expect(owner, `${step.name} owner`).toMatch(pattern);
    });
  });

  test("AC1: each step has a description of at most eight words", async ({ page }) => {
    await page.goto("/");
    const cards = await stepCards(page);
    for (const card of cards) {
      const description = card.paragraphs[1] ?? "";
      expect(description, `${card.name} description`).not.toBe("");
      expect(words(description), `${card.name}: ${description}`).toBeLessThanOrEqual(8);
    }
  });

  test("AC1: the figure sits between the intro and Latest decisions", async ({ page }) => {
    await page.goto("/");
    const fig = await figure(page).boundingBox();
    const decisions = await page.getByRole("heading", { name: "Latest decisions" }).boundingBox();
    expect(fig && decisions && fig.y < decisions.y).toBeTruthy();
  });
});

test.describe("AC2: the figure shows the loops and what triggers each", () => {
  async function loopTexts(page: Page) {
    await page.goto("/");
    const fig = figure(page);
    const lists = fig.getByRole("list");
    await expect(lists).toHaveCount(2);
    const items = lists.nth(1).getByRole("listitem");
    await expect(items).toHaveCount(3);
    return (await items.allInnerTexts()).map((t) => t.replace(/\s+/g, " ").trim());
  }

  test("AC2: a merge starts the next step on its own", async ({ page }) => {
    const loops = await loopTexts(page);
    const merge = loops.find((t) => /merge starts the next step/i.test(t));
    expect(merge, "loop label").toBeTruthy();
    expect(merge).toMatch(/merges/i);
    expect(merge).toMatch(/no one starts them by hand/i);
  });

  test("AC2: the fix agent loop names its triggers and returns to CI or Graham", async ({ page }) => {
    const loops = await loopTexts(page);
    const fix = loops.find((t) => /fix agent/i.test(t));
    expect(fix, "loop label").toBeTruthy();
    expect(fix).toMatch(/review asks for changes/i);
    expect(fix).toMatch(/CI fails/i);
    expect(fix).toMatch(/conflicts? with main/i);
    expect(fix).toMatch(/back to CI/i);
    expect(fix).toMatch(/two rounds/i);
    expect(fix).toMatch(/Graham/);
  });

  test("AC2: the unblock round names its trigger and returns to Build or Graham", async ({ page }) => {
    const loops = await loopTexts(page);
    const unblock = loops.find((t) => /unblock/i.test(t));
    expect(unblock, "loop label").toBeTruthy();
    expect(unblock).toMatch(/build opens no PR/i);
    expect(unblock).toMatch(/tech lead/i);
    expect(unblock).toMatch(/one round/i);
    expect(unblock).toMatch(/back to Build/i);
    expect(unblock).toMatch(/Graham/);
  });
});

test.describe("AC3: the figure is accessible and its content is real text", () => {
  test("AC3: the figure has the accessible name How work flows", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("figure", { name: "How work flows" })).toHaveCount(1);
  });

  test("AC3: the steps are an ordered list with six list items", async ({ page }) => {
    await page.goto("/");
    const list = await stepList(page);
    await expect(list.getByRole("listitem")).toHaveCount(6);
  });

  test("AC3: every step, owner and loop is visible page text", async ({ page }) => {
    await page.goto("/");
    const fig = figure(page);
    for (const step of STEPS) {
      await expect(fig.getByRole("heading", { name: step.name, exact: true })).toBeVisible();
    }
    await expect(fig.getByText(/spec writer agent drafts/i)).toBeVisible();
    await expect(fig.getByText(/code reviewer agent/i)).toBeVisible();
    await expect(fig.getByText(/automation for low-risk changes/i)).toBeVisible();
    await expect(fig.getByText("A merge starts the next step")).toBeVisible();
    await expect(fig.getByText("Fix agent", { exact: true })).toBeVisible();
    await expect(fig.getByText("Unblock round", { exact: true })).toBeVisible();
  });

  test("AC3: images in the figure are decorative, with no alt text to read", async ({ page }) => {
    await page.goto("/");
    // Decorative images must not appear in the accessibility tree.
    await expect(figure(page).getByRole("img")).toHaveCount(0);
  });
});

for (const width of [1280, 375]) {
  test.describe(`at ${width} px`, () => {
    test.use({ viewport: { width, height: 900 } });

    test(`AC4: the figure fits without sideways scroll at ${width} px`, async ({ page }) => {
      await page.goto("/");
      const fig = figure(page);
      await expect(fig).toBeVisible();
      const m = await fig.evaluate((el) => {
        const main = el.closest("main")!.getBoundingClientRect();
        const box = el.getBoundingClientRect();
        const doc = document.documentElement;
        return {
          figScroll: el.scrollWidth,
          figClient: el.clientWidth,
          docScroll: doc.scrollWidth,
          docClient: doc.clientWidth,
          left: box.left,
          right: box.right,
          mainLeft: main.left,
          mainRight: main.right,
        };
      });
      expect(m.figScroll).toBeLessThanOrEqual(m.figClient);
      expect(m.docScroll).toBeLessThanOrEqual(m.docClient);
      expect(m.left).toBeGreaterThanOrEqual(m.mainLeft - 1);
      expect(m.right).toBeLessThanOrEqual(m.mainRight + 1);
    });

    test(`AC4: no element inside the figure pokes past its edge at ${width} px`, async ({ page }) => {
      await page.goto("/");
      const fig = figure(page);
      await expect(fig).toBeVisible();
      const offenders = await fig.evaluate((el) => {
        const box = el.getBoundingClientRect();
        const bad: string[] = [];
        for (const node of Array.from(el.querySelectorAll("li, h3, p"))) {
          const r = node.getBoundingClientRect();
          if (r.left < box.left - 1 || r.right > box.right + 1) {
            bad.push(`${node.tagName} "${(node.textContent ?? "").slice(0, 20)}" ${r.left}..${r.right}`);
          }
        }
        return bad;
      });
      expect(offenders).toEqual([]);
    });

    if (width === 375) {
      test("AC4: at 375 px the steps stack in one column", async ({ page }) => {
        await page.goto("/");
        const list = await stepList(page);
        const tops = await list.getByRole("listitem").evaluateAll((els) => els.map((e) => e.getBoundingClientRect().top));
        expect(tops).toHaveLength(6);
        for (let i = 1; i < tops.length; i++) {
          expect(tops[i], `card ${i + 1} below card ${i}`).toBeGreaterThan(tops[i - 1]);
        }
      });

      test("AC4: at 375 px no text in the figure is smaller than 14 px", async ({ page }) => {
        await page.goto("/");
        const fig = figure(page);
        await expect(fig).toBeVisible();
        const small = await fig.evaluate((el) => {
          const bad: string[] = [];
          const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
          for (let n = walker.nextNode(); n; n = walker.nextNode()) {
            const text = (n.textContent ?? "").trim();
            if (!text) continue;
            const size = parseFloat(getComputedStyle(n.parentElement!).fontSize);
            if (size < 14) bad.push(`${size}px: ${text.slice(0, 30)}`);
          }
          return bad;
        });
        expect(small).toEqual([]);
      });
    } else {
      test("AC4: at 1280 px the steps are laid out in rows, not one tall column", async ({ page }) => {
        await page.goto("/");
        const list = await stepList(page);
        const tops = await list.getByRole("listitem").evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
        expect(new Set(tops).size).toBeLessThan(6);
      });
    }

    test(`AC6: axe color-contrast on the figure at ${width} px has no violations and nothing incomplete`, async ({ page }) => {
      await page.goto("/");
      await expect(figure(page)).toBeVisible();
      const results = await new AxeBuilder({ page })
        .include(await figureSelector(page))
        .withRules(["color-contrast"])
        .analyze();
      expect(results.violations.map((v) => v.nodes.map((n) => n.target.join(" ")))).toEqual([]);
      expect(results.incomplete.map((v) => v.nodes.map((n) => n.target.join(" ")))).toEqual([]);
      // The scan must have actually checked the text in the figure.
      expect(results.passes.flatMap((p) => p.nodes).length).toBeGreaterThan(0);
    });
  });
}

/** A selector axe can scope to: the figure is the only one on the page, so its tag name is enough. */
async function figureSelector(page: Page): Promise<string> {
  await expect(page.getByRole("figure")).toHaveCount(1);
  return "figure";
}

test("AC5: every image request from the homepage is same-origin", async ({ page, baseURL }) => {
  const origin = new URL(baseURL ?? "http://localhost:3000").origin;
  const images: string[] = [];
  page.on("request", (req) => {
    if (req.resourceType() === "image") images.push(req.url());
  });
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(figure(page)).toBeVisible();
  expect(images.length, "the washes and paper grain load as images").toBeGreaterThan(0);
  for (const url of images) {
    if (url.startsWith("data:")) continue;
    expect(new URL(url).origin, url).toBe(origin);
  }
});
