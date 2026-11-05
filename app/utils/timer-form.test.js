import { describe, expect, it } from "vitest";
import { formatTimeLabel, timeOptionsWith, toFormValues, toTimerInput } from "./timer-form";

const timeZone = "America/New_York";

describe("toFormValues", () => {
  it("starts new timers at the current half hour in the store's timezone and runs them for a week", () => {
    const values = toFormValues({}, [], timeZone, new Date("2026-11-27T14:10:00Z"));

    expect(values).toMatchObject({
      type: "fixed",
      startDate: "2026-11-27",
      startTime: "09:00",
      endDate: "2026-12-04",
      endTime: "09:00",
      targetType: "all",
      targets: [],
    });
  });

  it("keeps titles for selected resources and drops ones deleted from the store", () => {
    const timer = {
      type: "fixed",
      targetType: "products",
      targetIds: ["gid://shopify/Product/1", "gid://shopify/Product/2"],
    };
    const resources = [{ id: "gid://shopify/Product/1", title: "Snowboard" }];

    expect(toFormValues(timer, resources, timeZone).targets).toEqual([
      { id: "gid://shopify/Product/1", title: "Snowboard" },
    ]);
  });

  it("shows evergreen lengths in the largest whole unit", () => {
    const duration = (durationMinutes) => {
      const { durationValue, durationUnit } = toFormValues({ type: "evergreen", durationMinutes }, [], timeZone);
      return `${durationValue} ${durationUnit}`;
    };

    expect(duration(2880)).toBe("2 days");
    expect(duration(120)).toBe("2 hours");
    expect(duration(90)).toBe("90 minutes");
  });
});

describe("toTimerInput", () => {
  it("round-trips a fixed timer's dates through the form", () => {
    const timer = {
      name: "Black Friday",
      type: "fixed",
      startsAt: new Date("2026-11-27T05:00:00Z"),
      endsAt: new Date("2026-12-01T04:59:00Z"),
    };
    const input = toTimerInput(toFormValues(timer, [], timeZone), timeZone);

    expect(input.startsAt.toISOString()).toBe("2026-11-27T05:00:00.000Z");
    expect(input.endsAt.toISOString()).toBe("2026-12-01T04:59:00.000Z");
    expect(input.durationMinutes).toBeNull();
  });

  it("sends an evergreen length in minutes and no dates", () => {
    const values = { ...toFormValues({}, [], timeZone), type: "evergreen", durationValue: "3", durationUnit: "hours" };
    const input = toTimerInput(values, timeZone);

    expect(input).toMatchObject({ durationMinutes: 180, startsAt: null, endsAt: null });
  });

  it("only sends selected ids when the timer targets products or collections", () => {
    const values = { ...toFormValues({}, [], timeZone), targets: [{ id: "gid://shopify/Product/1", title: "Snowboard" }] };

    expect(toTimerInput({ ...values, targetType: "products" }, timeZone).targetIds).toEqual(["gid://shopify/Product/1"]);
    expect(toTimerInput({ ...values, targetType: "all" }, timeZone).targetIds).toEqual([]);
  });
});

describe("time options", () => {
  it("offers half-hour slots and keeps an existing off-slot time", () => {
    expect(timeOptionsWith("09:30")).toHaveLength(48);
    expect(timeOptionsWith("09:10")).toContain("09:10");
    expect(timeOptionsWith("09:10").indexOf("09:10")).toBe(timeOptionsWith("09:10").indexOf("09:30") - 1);
  });

  it("labels times in 12-hour format", () => {
    expect(formatTimeLabel("00:00")).toBe("12:00 AM");
    expect(formatTimeLabel("09:30")).toBe("9:30 AM");
    expect(formatTimeLabel("12:00")).toBe("12:00 PM");
    expect(formatTimeLabel("23:30")).toBe("11:30 PM");
  });
});
