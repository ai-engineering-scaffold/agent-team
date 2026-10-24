/**
 * The site's colour tokens (spec 005, ADR 0017) and a WCAG contrast function.
 *
 * This is the one list of colours the site may use. `app/globals.css` declares
 * the same tokens as `--colour-*` custom properties, the unit tests check the
 * two match (and match the tables in ADR 0017 and design doc 005), and the
 * Playwright theme tests check every rendered colour is in `ALLOWED_COLOURS`.
 * The hex values are inspired by GitHub's open-source Primer palette (MIT).
 */

export type TokenName =
  | "canvas"
  | "canvas-subtle"
  | "neutral-subtle"
  | "border"
  | "fg"
  | "fg-muted"
  | "accent"
  | "accent-subtle"
  | "visited"
  | "success"
  | "success-subtle"
  | "danger"
  | "danger-subtle"
  | "highlight";

/** A contrast figure the ADR states for a token, against another token. */
export interface ContrastClaim {
  on: TokenName;
  /** The WCAG ratio, to one decimal place, as written in the ADR. */
  ratio: number;
  /** The WCAG AA threshold the pair must meet: 4.5 for text, 3 for borders, bars and rings. */
  min: 4.5 | 3;
}

export interface Token {
  name: TokenName;
  /** Upper-case `#RRGGBB`. */
  hex: string;
  role: string;
  contrast: ContrastClaim[];
}

export const TOKENS: readonly Token[] = [
  {
    name: "canvas",
    hex: "#FFFFFF",
    role: "page background, table rows, cards, header band",
    contrast: [],
  },
  {
    name: "canvas-subtle",
    hex: "#F6F8FA",
    role: "table header row, footer band, code background",
    contrast: [],
  },
  {
    name: "neutral-subtle",
    hex: "#EFF2F5",
    role: "nav hover fill, superseded badge fill",
    contrast: [],
  },
  {
    name: "border",
    hex: "#D1D9E0",
    role: "header and footer rules, table separators, card outlines (decorative only)",
    contrast: [],
  },
  {
    name: "fg",
    hex: "#1F2328",
    role: "body text, headings, table text, current nav tab text",
    contrast: [
      { on: "canvas", ratio: 15.8, min: 4.5 },
      { on: "canvas-subtle", ratio: 14.8, min: 4.5 },
      { on: "neutral-subtle", ratio: 14.1, min: 4.5 },
      { on: "accent-subtle", ratio: 13.9, min: 4.5 },
    ],
  },
  {
    name: "fg-muted",
    hex: "#59636E",
    role: "secondary text: ADR meta labels, phone column labels, footer text, superseded badge text and border",
    contrast: [
      { on: "canvas", ratio: 6.1, min: 4.5 },
      { on: "canvas-subtle", ratio: 5.7, min: 4.5 },
      { on: "neutral-subtle", ratio: 5.4, min: 4.5 },
    ],
  },
  {
    name: "accent",
    hex: "#0969DA",
    role: "links, focus ring, proposed badge text and border",
    contrast: [
      { on: "canvas", ratio: 5.2, min: 4.5 },
      { on: "canvas-subtle", ratio: 4.9, min: 4.5 },
      { on: "accent-subtle", ratio: 4.6, min: 4.5 },
    ],
  },
  {
    name: "accent-subtle",
    hex: "#DDF4FF",
    role: "proposed badge fill, selection background (with fg text)",
    contrast: [],
  },
  {
    name: "visited",
    hex: "#8250DF",
    role: "visited links",
    contrast: [
      { on: "canvas", ratio: 5.0, min: 4.5 },
      { on: "canvas-subtle", ratio: 4.7, min: 4.5 },
    ],
  },
  {
    name: "success",
    hex: "#1A7F37",
    role: "accepted and Within budget badge text and border",
    contrast: [
      { on: "canvas", ratio: 5.1, min: 4.5 },
      { on: "canvas-subtle", ratio: 4.8, min: 4.5 },
      { on: "success-subtle", ratio: 4.6, min: 4.5 },
    ],
  },
  {
    name: "success-subtle",
    hex: "#DAFBE1",
    role: "accepted and Within budget badge fill",
    contrast: [],
  },
  {
    name: "danger",
    hex: "#CF222E",
    role: "rejected and Over budget badge text and border",
    contrast: [
      { on: "canvas", ratio: 5.4, min: 4.5 },
      { on: "canvas-subtle", ratio: 5.0, min: 4.5 },
      { on: "danger-subtle", ratio: 4.7, min: 4.5 },
    ],
  },
  {
    name: "danger-subtle",
    hex: "#FFEBE9",
    role: "rejected and Over budget badge fill",
    contrast: [],
  },
  {
    name: "highlight",
    hex: "#BC4C00",
    role: "the 2px current-page bar under the current nav tab",
    contrast: [{ on: "canvas", ratio: 5.0, min: 3 }],
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
