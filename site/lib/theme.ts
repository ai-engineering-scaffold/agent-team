/**
 * The site's colour tokens (spec 004, ADR 0014) and a WCAG contrast function.
 *
 * This is the one list of colours the site may use. `app/globals.css` declares
 * the same tokens as `--colour-*` custom properties, the unit tests check the
 * two match, and the Playwright theme tests check every rendered colour is in
 * `ALLOWED_COLOURS`.
 */

export type TokenName =
  | "cream"
  | "white"
  | "ink"
  | "dark-olive"
  | "terracotta-dark"
  | "terracotta"
  | "olive"
  | "sage";

/** A contrast figure the ADR states for a token, against another token. */
export interface ContrastClaim {
  on: TokenName;
  /** The WCAG ratio, to one decimal place, as written in the ADR. */
  ratio: number;
}

export interface Token {
  name: TokenName;
  /** Upper-case `#RRGGBB`. */
  hex: string;
  /** Where the colour comes from: Graham's palette, white, or a darker shade of a palette colour. */
  source: string;
  role: string;
  contrast: ContrastClaim[];
}

export const TOKENS: readonly Token[] = [
  {
    name: "cream",
    hex: "#E8E1CF",
    source: "palette",
    role: "page background",
    contrast: [],
  },
  {
    name: "white",
    hex: "#FFFFFF",
    source: "allowed by AC1",
    role: "header band, table bodies",
    contrast: [],
  },
  {
    name: "ink",
    hex: "#313824",
    source: "dark olive at 62% lightness",
    role: "body text, table text, selection text",
    contrast: [
      { on: "cream", ratio: 9.4 },
      { on: "white", ratio: 12.2 },
      { on: "sage", ratio: 5.6 },
    ],
  },
  {
    name: "dark-olive",
    hex: "#4F5B3A",
    source: "palette",
    role: "headings, visited links, focus ring, current nav tab fill",
    contrast: [
      { on: "cream", ratio: 5.6 },
      { on: "white", ratio: 7.3 },
    ],
  },
  {
    name: "terracotta-dark",
    hex: "#7E5039",
    source: "terracotta at 75% lightness",
    role: 'links, the "Over budget" status text',
    contrast: [
      { on: "cream", ratio: 5.2 },
      { on: "white", ratio: 6.8 },
    ],
  },
  {
    name: "terracotta",
    hex: "#A86B4C",
    source: "palette",
    role: "over-budget row marker, a UI marker that needs 3:1",
    contrast: [{ on: "cream", ratio: 3.3 }],
  },
  {
    name: "olive",
    hex: "#7A8B5A",
    source: "palette",
    role: "3px header bottom rule (decorative)",
    contrast: [],
  },
  {
    name: "sage",
    hex: "#B9B08C",
    source: "palette",
    role: "text-selection background, table header fill, table row separators (decorative)",
    contrast: [],
  },
];

/** Every colour the site may render, as upper-case `#RRGGBB`. */
export const ALLOWED_COLOURS: readonly string[] = TOKENS.map((t) => t.hex);

/** Look up a token's hex value by name. */
export function tokenHex(name: TokenName): string {
  const token = TOKENS.find((t) => t.name === name);
  if (!token) throw new Error(`Unknown colour token: ${name}`);
  return token.hex;
}

/** Parse `#RGB` or `#RRGGBB` (any case) into 0-255 channels. */
export function parseHex(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`Not a hex colour: ${hex}`);
  const digits = m[1].length === 3 ? [...m[1]].map((d) => d + d).join("") : m[1];
  const n = parseInt(digits, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function channelLuminance(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** WCAG 2.x relative luminance of a hex colour, from 0 (black) to 1 (white). */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex);
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
}

/** WCAG 2.x contrast ratio between two hex colours, from 1 to 21. Order does not matter. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** HSL of a hex colour: hue in degrees, saturation and lightness in percent. */
export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const [r, g, b] = parseHex(hex).map((c) => c / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l: l * 100 };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return { h, s: s * 100, l: l * 100 };
}
