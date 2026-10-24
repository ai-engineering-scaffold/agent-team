/**
 * Which badge style a status gets (spec 005, AC5; ADR 0017). Each status has
 * one tone, used everywhere it appears, and the badge always shows the word.
 */
import type { DecisionStatus } from "./decisions.ts";
import { OVER_BUDGET, WITHIN_BUDGET } from "./metrics.ts";

export type BadgeTone = "accent" | "success" | "neutral" | "danger";

export type BadgeStatus = DecisionStatus | typeof WITHIN_BUDGET | typeof OVER_BUDGET;

const TONES: Record<BadgeStatus, BadgeTone> = {
  proposed: "accent",
  accepted: "success",
  superseded: "neutral",
  rejected: "danger",
  [WITHIN_BUDGET]: "success",
  [OVER_BUDGET]: "danger",
};

/** The badge tone for an ADR or budget status. Throws on anything else, so no status renders unstyled. */
export function badgeTone(status: string): BadgeTone {
  if (!Object.hasOwn(TONES, status)) throw new Error(`No badge style for status: ${status}`);
  return TONES[status as BadgeStatus];
}
