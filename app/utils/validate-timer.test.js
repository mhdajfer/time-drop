import { describe, expect, it } from "vitest";
import { TIMER_DEFAULTS } from "./timer";
import { sanitizeText, validateTimer } from "./validate-timer";

const fixedInput = {
  name: "Black Friday",
  type: "fixed",
  startsAt: "2026-11-27T00:00:00Z",
  endsAt: "2026-11-30T00:00:00Z",
};

const evergreenInput = { name: "Flash sale", type: "evergreen", durationMinutes: 30 };

describe("validateTimer", () => {
  it("accepts a fixed timer and fills in appearance defaults", () => {
    const { data, errors } = validateTimer(fixedInput);

    expect(errors).toBeUndefined();
    expect(data.startsAt).toEqual(new Date(fixedInput.startsAt));
    expect(data.endsAt).toEqual(new Date(fixedInput.endsAt));
    expect(data.durationMinutes).toBeNull();
    expect(data).toMatchObject({
      targetType: "all",
      targetIds: [],
      backgroundColor: TIMER_DEFAULTS.backgroundColor,
      position: TIMER_DEFAULTS.position,
      urgencyMinutes: TIMER_DEFAULTS.urgencyMinutes,
    });
  });

  it("requires a name and a known timer type", () => {
    expect(validateTimer({}).errors).toEqual({
      name: "Name is required",
      type: "Choose a fixed or evergreen timer",
    });
  });

  it("rejects missing dates and an end date before the start date", () => {
    expect(validateTimer({ ...fixedInput, startsAt: "", endsAt: "not a date" }).errors).toEqual({
      startsAt: "Enter a valid start date",
      endsAt: "Enter a valid end date",
    });
    expect(validateTimer({ ...fixedInput, endsAt: fixedInput.startsAt }).errors).toEqual({
      endsAt: "End date must be after the start date",
    });
  });

  it("accepts an evergreen duration from a form field and clears the dates", () => {
    const { data } = validateTimer({ ...evergreenInput, durationMinutes: "45", startsAt: "2026-11-27" });

    expect(data.durationMinutes).toBe(45);
    expect(data.startsAt).toBeNull();
    expect(data.endsAt).toBeNull();
  });

  it("rejects evergreen durations outside 1 minute to 30 days", () => {
    for (const durationMinutes of [0, 1.5, 30 * 24 * 60 + 1, "abc"]) {
      expect(validateTimer({ ...evergreenInput, durationMinutes }).errors).toHaveProperty("durationMinutes");
    }
  });

  it("requires valid, de-duplicated resource ids for product and collection timers", () => {
    const productId = "gid://shopify/Product/1";

    expect(validateTimer({ ...evergreenInput, targetType: "products" }).errors).toEqual({
      targetIds: "Select at least one product",
    });
    expect(
      validateTimer({ ...evergreenInput, targetType: "collections", targetIds: [productId] }).errors,
    ).toEqual({ targetIds: "Some selected items are not valid collections" });
    expect(
      validateTimer({ ...evergreenInput, targetType: "products", targetIds: [productId, productId] }).data.targetIds,
    ).toEqual([productId]);
  });

  it("rejects invalid colors, options and operator objects", () => {
    const { errors } = validateTimer({
      ...evergreenInput,
      backgroundColor: "red",
      textColor: ["#ffffff"],
      position: { $gt: "" },
      size: "huge",
      urgency: "shake",
      urgencyMinutes: 0,
    });

    expect(Object.keys(errors).sort()).toEqual(
      ["backgroundColor", "position", "size", "textColor", "urgency", "urgencyMinutes"].sort(),
    );
  });

  it("only keeps fields a timer is allowed to store", () => {
    const { data } = validateTimer({ ...evergreenInput, shop: "other.myshopify.com", impressions: 1000 });

    expect(data).not.toHaveProperty("shop");
    expect(data).not.toHaveProperty("impressions");
  });
});

describe("sanitizeText", () => {
  it("removes HTML tags along with script and style contents", () => {
    expect(sanitizeText("<script>alert(1)</script>Sale <b>now</b>", 100)).toBe("Sale now");
    expect(sanitizeText('<img src=x onerror="alert(1)">50% off', 100)).toBe("50% off");
  });

  it("keeps plain text, collapses whitespace and limits the length", () => {
    expect(sanitizeText("  Buy 2 <  3\n\titems  ", 100)).toBe("Buy 2 < 3 items");
    expect(sanitizeText("a".repeat(120), 80)).toHaveLength(80);
    expect(sanitizeText(undefined, 80)).toBe("");
  });
});
