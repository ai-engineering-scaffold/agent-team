/**
 * Dates as the site shows them (spec 005, AC4; ADR 0017): `Oct 23, 2026`, and
 * `Oct 23, 2026, 10:00 UTC` where the source has a time. Always UTC, so the
 * build machine's time zone can't move a date-only value to the day before.
 */

const DATE = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "short",
  day: "numeric",
  year: "numeric",
});

function parse(iso: string): Date {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) throw new Error(`invalid date: ${iso}`);
  return new Date(ms);
}

/** `2026-10-23` (or a full ISO timestamp) as `Oct 23, 2026`, the UTC calendar date. */
export function formatDate(iso: string): string {
  return DATE.format(parse(iso));
}

/** An ISO timestamp as `Oct 23, 2026, 10:00 UTC`: 24-hour UTC time, seconds dropped. */
export function formatDateTime(iso: string): string {
  const date = parse(iso);
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mm = String(date.getUTCMinutes()).padStart(2, "0");
  return `${DATE.format(date)}, ${hh}:${mm} UTC`;
}
