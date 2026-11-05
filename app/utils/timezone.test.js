import { describe, expect, it } from "vitest";
import { formatDateTime, fromZonedParts, toZonedParts } from "./timezone";

describe("fromZonedParts", () => {
  it("converts store wall-clock time to UTC, including daylight saving time", () => {
    expect(fromZonedParts("2026-11-27", "09:00", "America/New_York").toISOString()).toBe(
      "2026-11-27T14:00:00.000Z",
    );
    expect(fromZonedParts("2026-07-01", "09:00", "America/New_York").toISOString()).toBe(
      "2026-07-01T13:00:00.000Z",
    );
  });

  it("handles half-hour offsets and dates that cross into the previous UTC day", () => {
    expect(fromZonedParts("2026-11-27", "09:00", "Asia/Kolkata").toISOString()).toBe(
      "2026-11-27T03:30:00.000Z",
    );
    expect(fromZonedParts("2026-01-01", "00:30", "Pacific/Auckland").toISOString()).toBe(
      "2025-12-31T11:30:00.000Z",
    );
  });

  it("returns null for incomplete values", () => {
    expect(fromZonedParts("", "09:00", "UTC")).toBeNull();
    expect(fromZonedParts("2026-11-27", "9am", "UTC")).toBeNull();
  });
});

describe("toZonedParts", () => {
  it("returns the date and 24-hour time in the store's timezone", () => {
    expect(toZonedParts("2026-11-27T14:00:00Z", "America/New_York")).toEqual({
      date: "2026-11-27",
      time: "09:00",
    });
    expect(toZonedParts("2026-11-27T04:15:00Z", "America/Los_Angeles")).toEqual({
      date: "2026-11-26",
      time: "20:15",
    });
  });

  it("round-trips with fromZonedParts", () => {
    const { date, time } = toZonedParts("2026-03-29T00:45:00Z", "Europe/London");
    expect(fromZonedParts(date, time, "Europe/London").toISOString()).toBe("2026-03-29T00:45:00.000Z");
  });
});

describe("formatDateTime", () => {
  it("formats a date in the store's timezone", () => {
    expect(formatDateTime("2026-11-27T14:00:00Z", "America/New_York")).toMatch(/^Nov 27, 2026, 9:00\sAM$/);
  });
});
