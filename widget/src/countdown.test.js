import { describe, expect, it } from "vitest";
import { SESSION_GAP, isUrgent, nextEvergreenState, timeLeft } from "./countdown";

const minutes = (count) => count * 60 * 1000;

describe("timeLeft", () => {
  it("splits the remaining time into days, hours, minutes and seconds", () => {
    const remaining = ((2 * 24 + 3) * 60 * 60 + 4 * 60 + 5) * 1000;

    expect(timeLeft(remaining + 400, 0)).toEqual({
      total: remaining + 400,
      days: 2,
      hours: 3,
      minutes: 4,
      seconds: 5,
    });
  });

  it("never goes below zero once the deadline has passed", () => {
    expect(timeLeft(1000, 5000)).toEqual({ total: 0, days: 0, hours: 0, minutes: 0, seconds: 0 });
  });
});

describe("nextEvergreenState", () => {
  const start = 1_000_000;

  it("starts a new countdown on a visitor's first view", () => {
    expect(nextEvergreenState(null, 30, start)).toEqual({
      deadline: start + minutes(30),
      durationMs: minutes(30),
      lastSeen: start,
    });
  });

  it("keeps the same deadline as the visitor moves between pages", () => {
    const first = nextEvergreenState(null, 30, start);
    const later = nextEvergreenState(first, 30, start + minutes(10));

    expect(later.deadline).toBe(first.deadline);
    expect(later.lastSeen).toBe(start + minutes(10));
  });

  it("starts over after the countdown has run out", () => {
    const first = nextEvergreenState(null, 30, start);
    const afterExpiry = start + minutes(31);

    expect(nextEvergreenState(first, 30, afterExpiry).deadline).toBe(afterExpiry + minutes(30));
  });

  it("starts over when the visitor returns after the session gap", () => {
    const first = nextEvergreenState(null, 24 * 60, start);
    const returning = start + SESSION_GAP + 1;

    expect(nextEvergreenState(first, 24 * 60, returning).deadline).toBe(returning + minutes(24 * 60));
  });

  it("starts over when the merchant changes the length", () => {
    const first = nextEvergreenState(null, 30, start);

    expect(nextEvergreenState(first, 60, start + minutes(1)).deadline).toBe(start + minutes(61));
  });
});

describe("isUrgent", () => {
  const timer = { urgency: "pulse", urgencyMinutes: 15 };

  it("is urgent only within the configured minutes before the end", () => {
    expect(isUrgent(timer, minutes(16))).toBe(false);
    expect(isUrgent(timer, minutes(15))).toBe(true);
    expect(isUrgent(timer, 1)).toBe(true);
    expect(isUrgent(timer, 0)).toBe(false);
  });

  it("is never urgent when the effect is turned off", () => {
    expect(isUrgent({ urgency: "none", urgencyMinutes: 15 }, minutes(1))).toBe(false);
  });
});
