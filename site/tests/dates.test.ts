// Spec 005, AC4: dates read like "Oct 23, 2026", with "10:00 UTC" added where the source has a time.
import { afterEach, describe, expect, it } from "vitest";
import { formatDate, formatDateTime } from "../lib/dates.ts";

const originalTz = process.env.TZ;

afterEach(() => {
  process.env.TZ = originalTz;
});

describe("formatDate", () => {
  it("AC4: formats a date-only value as a short month, day and year", () => {
    expect(formatDate("2026-10-23")).toBe("Oct 23, 2026");
    expect(formatDate("2026-01-05")).toBe("Jan 5, 2026");
    expect(formatDate("2026-09-28")).toBe("Sep 28, 2026");
  });

  it("AC4: gives the UTC calendar date of a full timestamp", () => {
    expect(formatDate("2026-10-21T23:59:59Z")).toBe("Oct 21, 2026");
    expect(formatDate("2026-10-22T01:00:00+03:00")).toBe("Oct 21, 2026");
  });

  it("AC4: does not shift a date-only value by a day in a time zone west of UTC", () => {
    process.env.TZ = "America/Los_Angeles";
    expect(formatDate("2026-10-19")).toBe("Oct 19, 2026");
    process.env.TZ = "Pacific/Kiritimati";
    expect(formatDate("2026-10-19")).toBe("Oct 19, 2026");
  });

  it("AC4: throws on input that is not a date", () => {
    expect(() => formatDate("not a date")).toThrow(/invalid date: not a date/);
    expect(() => formatDate("")).toThrow(/invalid date/);
  });
});

describe("formatDateTime", () => {
  it("AC4: formats a UTC timestamp with a 24-hour UTC time", () => {
    expect(formatDateTime("2026-10-23T10:00:00Z")).toBe("Oct 23, 2026, 10:00 UTC");
    expect(formatDateTime("2026-10-21T14:05:00Z")).toBe("Oct 21, 2026, 14:05 UTC");
    expect(formatDateTime("2026-10-21T00:07:00.000Z")).toBe("Oct 21, 2026, 00:07 UTC");
  });

  it("AC4: drops seconds rather than rounding them up", () => {
    expect(formatDateTime("2026-12-31T23:59:59.999Z")).toBe("Dec 31, 2026, 23:59 UTC");
  });

  it("AC4: converts an offset to UTC, whatever the machine's time zone", () => {
    process.env.TZ = "Asia/Tokyo";
    expect(formatDateTime("2026-10-22T01:30:00+03:00")).toBe("Oct 21, 2026, 22:30 UTC");
  });

  it("AC4: reads a date-only value as midnight UTC", () => {
    expect(formatDateTime("2026-10-19")).toBe("Oct 19, 2026, 00:00 UTC");
  });

  it("AC4: throws on input that is not a date", () => {
    expect(() => formatDateTime("2026-13-45T99:00:00Z")).toThrow(/invalid date/);
  });
});
