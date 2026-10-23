/**
 * The main nav's links and which one is current (spec 004, AC4; ADR 0014).
 *
 * Kept free of React so the rule can be unit-tested without a browser.
 */

export interface NavLink {
  href: string;
  label: string;
}

/** The main nav's tabs, in order. Their names and targets are fixed by existing tests. */
export const NAV_LINKS: readonly NavLink[] = [
  { href: "/how-we-work", label: "How we work" },
  { href: "/decisions", label: "Decisions" },
  { href: "/metrics", label: "Metrics" },
];

/**
 * How a nav link relates to the page being shown:
 * - `page`: the link points at this page (`aria-current="page"`).
 * - `section`: this page sits below the link's path, such as an ADR under
 *   `/decisions` (`aria-current="true"`).
 * - `none`: neither.
 */
export type NavState = "page" | "section" | "none";

/** Drops trailing slashes, so `/decisions/` and `/decisions` are the same path. The root stays `/`. */
function normalise(path: string): string {
  const trimmed = path.replace(/\/+$/, "");
  return trimmed === "" ? "/" : trimmed;
}

export function navState(pathname: string, href: string): NavState {
  const path = normalise(pathname);
  const target = normalise(href);
  if (path === target) return "page";
  // The root contains every path, so it never marks a section.
  if (target !== "/" && path.startsWith(target + "/")) return "section";
  return "none";
}

/** The `aria-current` value for a nav state, or `undefined` to leave the attribute off. */
export function ariaCurrent(state: NavState): "page" | "true" | undefined {
  if (state === "page") return "page";
  if (state === "section") return "true";
  return undefined;
}
