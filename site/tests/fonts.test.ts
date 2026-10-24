import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { brotliDecompressSync } from "node:zlib";
import { describe, expect, it } from "vitest";

// Spec 005 AC1 (decisions/0017, superseding spec 004 AC3's fonts): Inter for headings and body,
// and JetBrains Mono for the monospace accent, self-hosted from the fontsource packages through
// next/font/local in app/fonts.ts. The browser side is in e2e/theme.spec.ts.

const siteRoot = path.join(__dirname, "..");
const appDir = path.join(siteRoot, "app");

/** The `src` file of every localFont() call in app/fonts.ts, keyed by its `variable`. */
function fontSources(source: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const call of source.split("localFont(").slice(1)) {
    const src = /\bsrc:\s*"([^"]+)"/.exec(call)?.[1];
    const variable = /\bvariable:\s*"([^"]+)"/.exec(call)?.[1];
    if (src && variable) out.set(variable, path.resolve(appDir, src));
  }
  return out;
}

const sources = fontSources(readFileSync(path.join(appDir, "fonts.ts"), "utf8"));

/** The npm package that holds a file under node_modules. */
function packageOf(file: string): { name: string; license: string } {
  const m = /node_modules\/((?:@[^/]+\/)?[^/]+)\//.exec(file);
  if (!m) throw new Error(`${file} is not inside node_modules`);
  return JSON.parse(readFileSync(path.join(siteRoot, "node_modules", m[1], "package.json"), "utf8"));
}

// --- A minimal WOFF2 reader: enough to read cmap, hhea, hmtx and GSUB. ---

const KNOWN_TAGS = (
  "cmap head hhea hmtx maxp name OS/2 post cvt  fpgm glyf loca prep CFF  VORG EBDT EBLC gasp hdmx kern " +
  "LTSH PCLT VDMX vhea vmtx BASE GDEF GPOS GSUB EBSC JSTF MATH CBDT CBLC COLR CPAL SVG  sbix acnt avar " +
  "bdat bloc bsln cvar fdsc feat fmtx fvar gvar hsty just lcar mort morx opbd prop trak Zapf Silf Glat " +
  "Gloc Feat Sill"
).match(/.{4}\s?/g)!.map((t) => t.slice(0, 4));

type Table = { data: Buffer; transformed: boolean };

/** Decodes a WOFF2 file into its tables (transformed tables are left as stored). */
function readWoff2(file: string): Map<string, Table> {
  const buf = readFileSync(file);
  if (buf.toString("latin1", 0, 4) !== "wOF2") throw new Error(`${file} is not WOFF2`);
  const numTables = buf.readUInt16BE(12);
  const compressedSize = buf.readUInt32BE(20);
  let pos = 48;
  const base128 = () => {
    let value = 0;
    for (let i = 0; i < 5; i++) {
      const byte = buf[pos++];
      value = value * 128 + (byte & 0x7f);
      if ((byte & 0x80) === 0) return value;
    }
    throw new Error("Bad UIntBase128");
  };
  const entries: { tag: string; length: number; transformed: boolean }[] = [];
  for (let i = 0; i < numTables; i++) {
    const flags = buf[pos++];
    let tag = KNOWN_TAGS[flags & 0x3f];
    if ((flags & 0x3f) === 63) {
      tag = buf.toString("latin1", pos, pos + 4);
      pos += 4;
    }
    const version = flags >> 6;
    const origLength = base128();
    const transformed = tag === "glyf" || tag === "loca" ? version === 0 : version !== 0;
    entries.push({ tag, length: transformed ? base128() : origLength, transformed });
  }
  const stream = brotliDecompressSync(buf.subarray(pos, pos + compressedSize));
  const tables = new Map<string, Table>();
  let offset = 0;
  for (const e of entries) {
    tables.set(e.tag, { data: stream.subarray(offset, offset + e.length), transformed: e.transformed });
    offset += e.length;
  }
  if (offset !== stream.length) throw new Error("WOFF2 table lengths do not add up");
  return tables;
}

function table(tables: Map<string, Table>, tag: string): Buffer {
  const t = tables.get(tag);
  if (!t) throw new Error(`No ${tag} table`);
  if (t.transformed) throw new Error(`${tag} is transformed; this reader does not undo transforms`);
  return t.data;
}

/** Maps a character to its glyph ID through the font's Unicode cmap (format 4 or 12). */
function glyphId(cmap: Buffer, char: string): number {
  const code = char.codePointAt(0)!;
  const subtables = Array.from({ length: cmap.readUInt16BE(2) }, (_, i) => ({
    platform: cmap.readUInt16BE(4 + i * 8),
    encoding: cmap.readUInt16BE(6 + i * 8),
    offset: cmap.readUInt32BE(8 + i * 8),
  }));
  const unicode = subtables.filter((s) => s.platform === 0 || (s.platform === 3 && [1, 10].includes(s.encoding)));
  for (const { offset } of unicode) {
    const format = cmap.readUInt16BE(offset);
    if (format === 12) {
      const groups = cmap.readUInt32BE(offset + 12);
      for (let i = 0; i < groups; i++) {
        const g = offset + 16 + i * 12;
        const start = cmap.readUInt32BE(g);
        if (code >= start && code <= cmap.readUInt32BE(g + 4)) return cmap.readUInt32BE(g + 8) + code - start;
      }
    } else if (format === 4) {
      const segs = cmap.readUInt16BE(offset + 6) / 2;
      const ends = offset + 14;
      const starts = ends + segs * 2 + 2;
      const deltas = starts + segs * 2;
      const rangeOffsets = deltas + segs * 2;
      for (let i = 0; i < segs; i++) {
        const start = cmap.readUInt16BE(starts + i * 2);
        if (code < start || code > cmap.readUInt16BE(ends + i * 2)) continue;
        const delta = cmap.readUInt16BE(deltas + i * 2);
        const rangeOffset = cmap.readUInt16BE(rangeOffsets + i * 2);
        if (rangeOffset === 0) return (code + delta) & 0xffff;
        const gid = cmap.readUInt16BE(rangeOffsets + i * 2 + rangeOffset + (code - start) * 2);
        return gid === 0 ? 0 : (gid + delta) & 0xffff;
      }
    }
  }
  throw new Error(`No glyph for ${char}`);
}

/** The advance width of a glyph in the font's default instance. */
function advance(tables: Map<string, Table>, gid: number): number {
  const metrics = table(tables, "hhea").readUInt16BE(34);
  return table(tables, "hmtx").readUInt16BE(Math.min(gid, metrics - 1) * 4);
}

/** The glyph IDs a Coverage table lists, in coverage-index order. */
function coverage(buf: Buffer, offset: number): number[] {
  const format = buf.readUInt16BE(offset);
  const count = buf.readUInt16BE(offset + 2);
  if (format === 1) return Array.from({ length: count }, (_, i) => buf.readUInt16BE(offset + 4 + i * 2));
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    const r = offset + 4 + i * 6;
    for (let g = buf.readUInt16BE(r); g <= buf.readUInt16BE(r + 2); g++) out.push(g);
  }
  return out;
}

/** The OpenType feature tags in a GSUB table. */
function gsubFeatureTags(gsub: Buffer): string[] {
  const featureList = gsub.readUInt16BE(6);
  const count = gsub.readUInt16BE(featureList);
  return Array.from({ length: count }, (_, i) => gsub.toString("latin1", featureList + 2 + i * 6, featureList + 6 + i * 6));
}

/** The single substitutions (glyph to glyph) that a GSUB feature applies. */
function singleSubstitutions(gsub: Buffer, feature: string): Map<number, number> {
  const featureList = gsub.readUInt16BE(6);
  const lookupList = gsub.readUInt16BE(8);
  const lookups = new Set<number>();
  gsubFeatureTags(gsub).forEach((tag, i) => {
    if (tag !== feature) return;
    const f = featureList + gsub.readUInt16BE(featureList + 2 + i * 6 + 4);
    for (let j = 0; j < gsub.readUInt16BE(f + 2); j++) lookups.add(gsub.readUInt16BE(f + 4 + j * 2));
  });
  const out = new Map<number, number>();
  for (const index of lookups) {
    const lookup = lookupList + gsub.readUInt16BE(lookupList + 2 + index * 2);
    let type = gsub.readUInt16BE(lookup);
    for (let s = 0; s < gsub.readUInt16BE(lookup + 4); s++) {
      let sub = lookup + gsub.readUInt16BE(lookup + 6 + s * 2);
      if (type === 7) {
        type = gsub.readUInt16BE(sub + 2);
        sub += gsub.readUInt32BE(sub + 4);
      }
      if (type !== 1) throw new Error(`${feature} uses GSUB lookup type ${type}, not a single substitution`);
      const glyphs = coverage(gsub, sub + gsub.readUInt16BE(sub + 2));
      const format = gsub.readUInt16BE(sub);
      glyphs.forEach((g, k) => {
        const to = format === 1 ? (g + gsub.readInt16BE(sub + 4)) & 0xffff : gsub.readUInt16BE(sub + 6 + k * 2);
        if (!out.has(g)) out.set(g, to);
      });
    }
  }
  return out;
}

describe("app/fonts.ts", () => {
  it("defines a body font and a monospace font, and nothing else", () => {
    expect([...sources.keys()].sort()).toEqual(["--font-body", "--font-mono"]);
  });

  it.each([
    ["--font-body", "@fontsource-variable/inter", "inter-latin-wght-normal.woff2"],
    ["--font-mono", "@fontsource-variable/jetbrains-mono", "jetbrains-mono-latin-wght-normal.woff2"],
  ])("loads %s from %s's latin wght normal file, licensed OFL-1.1", (variable, pkg, fileName) => {
    const file = sources.get(variable)!;
    expect(path.basename(file)).toBe(fileName);
    const meta = packageOf(file);
    expect(meta.name).toBe(pkg);
    expect(meta.license).toBe("OFL-1.1");
    expect(readFileSync(file).toString("latin1", 0, 4)).toBe("wOF2");
  });

  it("lists exactly the two font packages as site dependencies, without Source Serif 4", async () => {
    const pkg = JSON.parse(await readFile(path.join(siteRoot, "package.json"), "utf8"));
    const fontPackages = Object.keys(pkg.dependencies).filter((name) => name.startsWith("@fontsource"));
    expect(fontPackages.sort()).toEqual(["@fontsource-variable/inter", "@fontsource-variable/jetbrains-mono"]);
    expect(Object.keys(pkg.devDependencies ?? {})).not.toContain("@fontsource-variable/source-serif-4");
  });
});

describe("globals.css", () => {
  const css = readFileSync(path.join(appDir, "globals.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  /** The font-family of the first rule whose selector list is exactly `selectors`. */
  const fontFamilyOf = (selectors: string) => {
    for (const m of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
      const list = m[1].split(",").map((s) => s.trim());
      if (list.join(",") === selectors) return /font-family:\s*([^;]+);/.exec(m[2])?.[1].trim();
    }
  };

  it("sets body text and h1 to h6 in the body font (Inter)", () => {
    expect(fontFamilyOf("body")).toBe("var(--font-body)");
    expect(fontFamilyOf("h1,h2,h3,h4,h5,h6")).toBe("var(--font-body)");
  });

  it("sets code and the .mono accent in the monospace web font, not a system stack", () => {
    expect(fontFamilyOf("code,kbd,pre,samp,.mono")).toBe("var(--font-mono)");
  });

  it("names no font family outside the two next/font variables", () => {
    const families = [...css.matchAll(/font-family:\s*([^;]+);/g)].map((m) => m[1].trim());
    expect(families.length).toBeGreaterThanOrEqual(3);
    expect(new Set(families)).toEqual(new Set(["var(--font-body)", "var(--font-mono)"]));
  });
});

// Numeric table columns use `font-variant-numeric: tabular-nums` (decisions/0014, #45), which turns
// on the font's tnum feature. Check that, in the file Inter loads from, tnum gives every digit one
// width and so changes the width of the default digits.
describe("tabular figures in the Inter file", () => {
  const tables = readWoff2(sources.get("--font-body")!);
  const cmap = table(tables, "cmap");
  const tnum = singleSubstitutions(table(tables, "GSUB"), "tnum");
  const digits = [..."0123456789"].map((d) => glyphId(cmap, d));
  const defaultWidths = digits.map((g) => advance(tables, g));
  const tabularWidths = digits.map((g) => advance(tables, tnum.get(g) ?? g));

  it("has a tnum feature that substitutes the digits", () => {
    expect(gsubFeatureTags(table(tables, "GSUB"))).toContain("tnum");
    expect(digits.filter((g) => tnum.has(g))).not.toEqual([]);
  });

  it("gives every digit the same width with tnum", () => {    expect(new Set(tabularWidths).size).toBe(1);
  });

  it("changes digit widths, because the default digits are proportional", () => {
    expect(new Set(defaultWidths).size).toBeGreaterThan(1);
    expect(tabularWidths).not.toEqual(defaultWidths);
  });
});
