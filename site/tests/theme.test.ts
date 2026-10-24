import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  ALLOWED_COLOURS,
  TOKENS,
  contrastRatio,
  parseHex,
  relativeLuminance,
  tokenHex,
  type Token,
} from "../lib/theme";

const repoRoot = path.join(__dirname, "..", "..");
const globalsCss = path.join(__dirname, "..", "app", "globals.css");

/** The contrast column as the ADR and design doc write it, e.g. "5.2:1 on canvas, 4.9:1 on canvas-subtle". */
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

// The palette exactly as issue #57 and ADR 0017 fix it. Changing a colour needs a new ADR.
const ADR_0017_PALETTE: Record<string, string> = {
  canvas: "#FFFFFF",
  "canvas-subtle": "#F6F8FA",
  "neutral-subtle": "#EFF2F5",
  border: "#D1D9E0",
  fg: "#1F2328",
  "fg-muted": "#59636E",
  accent: "#0969DA",
  "accent-subtle": "#DDF4FF",
  visited: "#8250DF",
  success: "#1A7F37",
  "success-subtle": "#DAFBE1",
  danger: "#CF222E",
  "danger-subtle": "#FFEBE9",
  highlight: "#BC4C00",
};

describe("TOKENS", () => {
  it("lists fourteen tokens with unique names and upper-case hex values", () => {
    expect(TOKENS).toHaveLength(14);
    expect(new Set(TOKENS.map((t) => t.name)).size).toBe(TOKENS.length);
    for (const t of TOKENS) expect(t.hex).toMatch(/^#[0-9A-F]{6}$/);
  });

  it("holds exactly ADR 0017's palette, in order", () => {
    expect(TOKENS.map((t) => t.name)).toEqual(Object.keys(ADR_0017_PALETTE));
    expect(Object.fromEntries(TOKENS.map((t) => [t.name, t.hex]))).toEqual(ADR_0017_PALETTE);
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

  it("meets the threshold of every stated pair, unrounded", () => {
    for (const t of TOKENS) {
      for (const c of t.contrast) {
        expect(contrastRatio(t.hex, tokenHex(c.on)), `${t.name} on ${c.on}`).toBeGreaterThanOrEqual(c.min);
      }
    }
  });

  it("gives every text token at least 4.5:1 on canvas and canvas-subtle", () => {
    for (const name of ["fg", "fg-muted", "accent", "visited", "success", "danger"] as const) {
      for (const on of ["canvas", "canvas-subtle"] as const) {
        expect(contrastRatio(tokenHex(name), tokenHex(on)), `${name} on ${on}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("gives each badge's text 4.5:1 on its fill, and its border 3:1 on canvas and canvas-subtle", () => {
    const badges = [
      ["accent", "accent-subtle"],
      ["success", "success-subtle"],
      ["fg-muted", "neutral-subtle"],
      ["danger", "danger-subtle"],
    ] as const;
    for (const [text, fill] of badges) {
      expect(contrastRatio(tokenHex(text), tokenHex(fill)), `${text} on ${fill}`).toBeGreaterThanOrEqual(4.5);
      for (const on of ["canvas", "canvas-subtle"] as const) {
        expect(contrastRatio(tokenHex(text), tokenHex(on)), `${text} border on ${on}`).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("gives the current-page bar and the focus ring 3:1 on canvas, and selection text 4.5:1", () => {
    expect(contrastRatio(tokenHex("highlight"), tokenHex("canvas"))).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(tokenHex("accent"), tokenHex("canvas"))).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(tokenHex("fg"), tokenHex("accent-subtle"))).toBeGreaterThanOrEqual(4.5);
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
  ["ADR 0017", path.join(repoRoot, "decisions", "0017-site-redesign-theme.md")],
  ["the design doc", path.join(repoRoot, "docs", "design", "005-site-redesign.md")],
])("the colour-token table in %s", (_label, file) => {
  it("matches TOKENS row for row", async () => {
    const rows = tokenTableRows(await readFile(file, "utf8"));
    expect([...rows.keys()]).toEqual(TOKENS.map((t) => t.name));
    for (const t of TOKENS) {
      expect(rows.get(t.name)).toEqual([`\`${t.name}\``, `\`${t.hex}\``, t.role, contrastText(t)]);
    }
  });
});
