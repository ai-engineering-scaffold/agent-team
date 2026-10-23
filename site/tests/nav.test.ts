import { describe, expect, it } from "vitest";
import { NAV_LINKS, ariaCurrent, navState } from "../lib/nav";

/** The state of every nav tab for a pathname, keyed by label. */
function states(pathname: string): Record<string, string> {
  return Object.fromEntries(NAV_LINKS.map((link) => [link.label, navState(pathname, link.href)]));
}

describe("NAV_LINKS", () => {
  it("keeps the names and targets the existing tests rely on", () => {
    expect(NAV_LINKS).toEqual([
      { href: "/how-we-work", label: "How we work" },
      { href: "/decisions", label: "Decisions" },
      { href: "/metrics", label: "Metrics" },
    ]);
  });
});

describe("navState", () => {
  it.each([
    ["/how-we-work", "How we work"],
    ["/decisions", "Decisions"],
    ["/metrics", "Metrics"],
  ])("marks only its own tab as the page on %s", (pathname, current) => {
    const expected = Object.fromEntries(NAV_LINKS.map((l) => [l.label, l.label === current ? "page" : "none"]));
    expect(states(pathname)).toEqual(expected);
  });

  it("marks Decisions as the section on an ADR page", () => {
    expect(states("/decisions/0014-site-theme")).toEqual({
      "How we work": "none",
      Decisions: "section",
      Metrics: "none",
    });
  });

  it("marks no tab on the home page", () => {
    expect(states("/")).toEqual({ "How we work": "none", Decisions: "none", Metrics: "none" });
  });

  it("treats a trailing slash as the same path", () => {
    expect(navState("/decisions/", "/decisions")).toBe("page");
    expect(navState("/metrics", "/metrics/")).toBe("page");
    expect(navState("/decisions/0002-six-agent-roles-and-five-gates/", "/decisions")).toBe("section");
    expect(states("//")).toEqual({ "How we work": "none", Decisions: "none", Metrics: "none" });
  });

  it("does not match a path that only shares a prefix", () => {
    expect(navState("/decisions-archive", "/decisions")).toBe("none");
    expect(navState("/metricsx/y", "/metrics")).toBe("none");
  });

  it("never marks the root link as a section", () => {
    expect(navState("/metrics", "/")).toBe("none");
    expect(navState("/", "/")).toBe("page");
  });
});

describe("ariaCurrent", () => {
  it("maps each state to its aria-current value", () => {
    expect(ariaCurrent("page")).toBe("page");
    expect(ariaCurrent("section")).toBe("true");
    expect(ariaCurrent("none")).toBeUndefined();
  });
});
