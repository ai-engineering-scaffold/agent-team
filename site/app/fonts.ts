import localFont from "next/font/local";

// The site fonts (spec 005 AC1, decisions/0017). Each loads the latin `wght` normal variable
// woff2 from its fontsource package, so builds need no network beyond `npm ci`, and next/font
// serves the file same-origin from /_next/static/media/ with a preload and a size-adjusted
// fallback. Both are SIL Open Font License 1.1. next/font needs literal options here.

/** Inter, for headings and body text. It has tabular figures for numeric table columns. */
export const bodyFont = localFont({
  src: "../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2",
  weight: "100 900",
  style: "normal",
  display: "swap",
  variable: "--font-body",
  fallback: ["system-ui", "sans-serif"],
  adjustFontFallback: "Arial",
});

/** JetBrains Mono, the monospace accent: code, ADR numbers, spec identifiers and dollar amounts. */
export const monoFont = localFont({
  src: "../node_modules/@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2",
  weight: "100 800",
  style: "normal",
  display: "swap",
  variable: "--font-mono",
  fallback: ["ui-monospace", "monospace"],
  adjustFontFallback: false,
});
