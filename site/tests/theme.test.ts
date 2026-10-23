import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  ALLOWED_COLOURS,
  TOKENS,
  contrastRatio,
  hexToHsl,
  parseHex,
  relativeLuminance,
  tokenHex,
  type Token,
} from "../lib/theme";

const repoRoot = path.join(__dirname, "..", "..");
const globalsCss = path.join(__dirname, "..", "app", "globals.css");

/** The contrast column as the ADR and design doc write it, e.g. "5.6:1 on cream, 7.3:1 on white". */
function contrastText(token: Token): string {
  if (token.contrast.length === 0) return "n/a";
  return token.contrast.map((c) => `${c.ratio.toFixed(1)}:1 on ${c.on}`).join(", ");
}

/** Rows of the Markdown colour-token table, keyed by token name. */
function tokenTableRows(markdown: string): Map<string, string[]> {
  const rows = new Map<string, string[]>();
  for (const line of markdown.split("\n")) {
    const m = /^\| `([a-z-]+)` \|/.exec(line);
    if (!m) continue;
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((c) => c.trim());
    rows.set(m[1], cells);
  }
  return rows;
}

describe("contrastRatio", () => {
  it("gives 21:1 for black on white and 1:1 for a colour on itself", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 10);
    expect(contrastRatio("#7A8B5A", "#7A8B5A")).toBe(1);
  });

  it("does not depend on argument order", () => {
    expect(contrastRatio("#E8E1CF", "#313824")).toBe(contrastRatio("#313824", "#E8E1CF"));
  });

  it("matches a known WCAG value", () => {
    // #777777 on white is the textbook just-below-AA grey.
    expect(contrastRatio("#777777", "#FFFFFF")).toBeCloseTo(4.48, 2);
  });

  it("accepts short and lower-case hex", () => {
    expect(contrastRatio("#fff", "#000")).toBeCloseTo(21, 10);
    expect(relativeLuminance("#e8e1cf")).toBe(relativeLuminance("#E8E1CF"));
  });

  it("rejects something that is not a hex colour", () => {
    expect(() => parseHex("rgb(0, 0, 0)")).toThrow(/Not a hex colour/);
  });
});

describe("TOKENS", () => {
  it("lists eight tokens with unique names and upper-case hex values", () => {
    expect(TOKENS).toHaveLength(8);
    expect(new Set(TOKENS.map((t) => t.name)).size).toBe(TOKENS.length);
    for (const t of TOKENS) expect(t.hex).toMatch(/^#[0-9A-F]{6}$/);
  });

  it("includes Graham's five palette colours, cream and white", () => {
    const palette = ["#7A8B5A", "#B9B08C", "#E8E1CF", "#4F5B3A", "#A86B4C"];
    for (const hex of [...palette, "#FFFFFF"]) expect(ALLOWED_COLOURS).toContain(hex);
    expect(ALLOWED_COLOURS).toEqual(TOKENS.map((t) => t.hex));
  });

  it("states every contrast figure correctly to one decimal place", () => {
    for (const t of TOKENS) {
      for (const c of t.contrast) {
        const actual = Math.round(contrastRatio(t.hex, tokenHex(c.on)) * 10) / 10;
        expect(actual, `${t.name} on ${c.on}`).toBe(c.ratio);
      }
    }
  });

  it("gives text tokens at least 4.5:1 on cream and white, and the UI marker at least 3:1 on cream", () => {
    for (const name of ["ink", "dark-olive", "terracotta-dark"] as const) {
      expect(contrastRatio(tokenHex(name), tokenHex("cream"))).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(tokenHex(name), tokenHex("white"))).toBeGreaterThanOrEqual(4.5);
    }
    // Selection text and table header text: ink on sage.
    expect(contrastRatio(tokenHex("ink"), tokenHex("sage"))).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(tokenHex("terracotta"), tokenHex("cream"))).toBeGreaterThanOrEqual(3);
  });

  it("makes each darker shade from its source's hue and saturation, with lower lightness", () => {
    const shades = [
      { name: "ink", source: "dark-olive", lightness: 0.62 },
      { name: "terracotta-dark", source: "terracotta", lightness: 0.75 },
    ] as const;
    for (const s of shades) {
      const shade = hexToHsl(tokenHex(s.name));
      const source = hexToHsl(tokenHex(s.source));
      // Rounding to 8-bit hex channels moves hue and saturation slightly.
      expect(Math.abs(shade.h - source.h), `${s.name} hue`).toBeLessThan(1.5);
      expect(Math.abs(shade.s - source.s), `${s.name} saturation`).toBeLessThan(1);
      expect(shade.l).toBeLessThan(source.l);
      expect(shade.l / source.l, `${s.name} lightness`).toBeCloseTo(s.lightness, 2);
    }
  });
});

describe("globals.css", () => {
  it("declares exactly the TOKENS as --colour-* custom properties", async () => {
    const css = await readFile(globalsCss, "utf8");
    const declared = Object.fromEntries(
      [...css.matchAll(/--colour-([a-z-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]),
    );
    const expected = Object.fromEntries(TOKENS.map((t) => [t.name, t.hex]));
    expect(declared).toEqual(expected);
  });

  it("uses no colour outside the token declarations", async () => {
    const css = await readFile(globalsCss, "utf8");
    const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
    const withoutTokens = withoutComments.replace(/--colour-[a-z-]+:\s*[^;]+;/g, "");
    expect(withoutTokens).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(withoutTokens).not.toMatch(/\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color-mix|color)\(/i);
    expect(withoutTokens).not.toMatch(/\bcurrentColor\b/i);
    expect(withoutTokens).not.toMatch(/prefers-color-scheme/);
    expect(withoutTokens).toMatch(/color-scheme:\s*light;/);
  });
});

describe.each([
  ["ADR 0014", path.join(repoRoot, "decisions", "0014-site-theme.md")],
  ["the design doc", path.join(repoRoot, "docs", "design", "004-site-theme.md")],
])("the colour-token table in %s", (_label, file) => {
  it("matches TOKENS row for row", async () => {
    const rows = tokenTableRows(await readFile(file, "utf8"));
    expect([...rows.keys()]).toEqual(TOKENS.map((t) => t.name));
    for (const t of TOKENS) {
      expect(rows.get(t.name)).toEqual([`\`${t.name}\``, `\`${t.hex}\``, t.source, t.role, contrastText(t)]);
    }
  });
});
