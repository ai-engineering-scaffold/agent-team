import localFont from "next/font/local";

// The site fonts (spec 004 AC3, decisions/0014). Each loads the latin `wght` normal variable
// woff2 from its fontsource package, so builds need no network beyond `npm ci`, and next/font
// serves the file same-origin from /_next/static/media/ with a preload and a size-adjusted
// fallback. Both are SIL Open Font License 1.1. next/font needs literal options here.

/** Source Serif 4, for headings. */
export const headingFont = localFont({
  src: "../node_modules/@fontsource-variable/source-serif-4/files/source-serif-4-latin-wght-normal.woff2",
  weight: "200 900",
  style: "normal",
  display: "swap",
  variable: "--font-heading",
  fallback: ["Georgia", "serif"],
  adjustFontFallback: "Times New Roman",
});

/** Inter, for body text. It has tabular figures for numeric table columns. */
export const bodyFont = localFont({
  src: "../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2",
  weight: "100 900",
  style: "normal",
  display: "swap",
  variable: "--font-body",
  fallback: ["system-ui", "sans-serif"],
  adjustFontFallback: "Arial",
});
