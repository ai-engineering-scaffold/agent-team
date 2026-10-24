// Spec 005, AC5: every ADR and budget status maps to one badge style.
import { describe, expect, it } from "vitest";
import { OVER_BUDGET, WITHIN_BUDGET } from "../lib/metrics.ts";
import { badgeTone } from "../lib/status.ts";

describe("badgeTone", () => {
  it.each([
    ["proposed", "accent"],
    ["accepted", "success"],
    ["superseded", "neutral"],
    ["rejected", "danger"],
  ])("AC5: the ADR status %s is a %s badge", (status, tone) => {
    expect(badgeTone(status)).toBe(tone);
  });

  it("AC5: Within budget is a success badge and Over budget a danger badge", () => {
    expect(WITHIN_BUDGET).toBe("Within budget");
    expect(OVER_BUDGET).toBe("Over budget");
    expect(badgeTone(WITHIN_BUDGET)).toBe("success");
    expect(badgeTone(OVER_BUDGET)).toBe("danger");
  });

  it("AC5: throws on a status with no badge style, including an empty one", () => {
    expect(() => badgeTone("")).toThrow(/No badge style/);
    expect(() => badgeTone("Accepted")).toThrow(/No badge style/);
    expect(() => badgeTone("toString")).toThrow(/No badge style/);
  });
});
