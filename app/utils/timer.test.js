import { describe, expect, it } from "vitest";
import { findTimerForProduct, getTimerStatus, matchesProduct } from "./timer";

const now = new Date("2026-11-20T12:00:00Z");
const product = "gid://shopify/Product/1";
const collection = "gid://shopify/Collection/10";

function fixedTimer(overrides = {}) {
  return {
    type: "fixed",
    startsAt: "2026-11-01T00:00:00Z",
    endsAt: "2026-11-30T00:00:00Z",
    targetType: "all",
    targetIds: [],
    ...overrides,
  };
}

describe("getTimerStatus", () => {
  it("is scheduled before the start date", () => {
    expect(getTimerStatus(fixedTimer({ startsAt: "2026-11-21T00:00:00Z" }), now)).toBe("scheduled");
  });

  it("is active from the start date until the end date", () => {
    expect(getTimerStatus(fixedTimer({ startsAt: now }), now)).toBe("active");
    expect(getTimerStatus(fixedTimer(), now)).toBe("active");
  });

  it("is expired once the end date is reached", () => {
    expect(getTimerStatus(fixedTimer({ endsAt: now }), now)).toBe("expired");
    expect(getTimerStatus(fixedTimer({ endsAt: "2026-11-10T00:00:00Z" }), now)).toBe("expired");
  });

  it("treats evergreen timers as always active", () => {
    expect(getTimerStatus({ type: "evergreen", durationMinutes: 30 }, now)).toBe("active");
  });
});

describe("matchesProduct", () => {
  it("matches every product when targeting all products", () => {
    expect(matchesProduct(fixedTimer(), { productId: product })).toBe(true);
  });

  it("matches only the selected products", () => {
    const timer = fixedTimer({ targetType: "products", targetIds: [product] });

    expect(matchesProduct(timer, { productId: product })).toBe(true);
    expect(matchesProduct(timer, { productId: "gid://shopify/Product/2" })).toBe(false);
  });

  it("matches products that belong to a selected collection", () => {
    const timer = fixedTimer({ targetType: "collections", targetIds: [collection] });

    expect(matchesProduct(timer, { productId: product, collectionIds: [collection] })).toBe(true);
    expect(matchesProduct(timer, { productId: product, collectionIds: [] })).toBe(false);
  });
});

describe("findTimerForProduct", () => {
  const forProduct = { productId: product, collectionIds: [collection] };

  it("prefers a product timer over collection and store-wide timers", () => {
    const timers = [
      fixedTimer({ name: "all" }),
      fixedTimer({ name: "collection", targetType: "collections", targetIds: [collection] }),
      fixedTimer({ name: "product", targetType: "products", targetIds: [product] }),
    ];

    expect(findTimerForProduct(timers, forProduct, now).name).toBe("product");
  });

  it("falls back to a collection timer, then a store-wide timer", () => {
    const collectionTimer = fixedTimer({ name: "collection", targetType: "collections", targetIds: [collection] });
    const allTimer = fixedTimer({ name: "all" });

    expect(findTimerForProduct([allTimer, collectionTimer], forProduct, now).name).toBe("collection");
    expect(findTimerForProduct([allTimer], forProduct, now).name).toBe("all");
  });

  it("picks the timer ending soonest when several have the same priority", () => {
    const timers = [
      { type: "evergreen", name: "evergreen", targetType: "all", targetIds: [], durationMinutes: 30 },
      fixedTimer({ name: "later", endsAt: "2026-12-31T00:00:00Z" }),
      fixedTimer({ name: "sooner", endsAt: "2026-11-25T00:00:00Z" }),
    ];

    expect(findTimerForProduct(timers, forProduct, now).name).toBe("sooner");
  });

  it("ignores timers that are scheduled or expired", () => {
    const timers = [
      fixedTimer({ targetType: "products", targetIds: [product], endsAt: "2026-11-10T00:00:00Z" }),
      fixedTimer({ targetType: "products", targetIds: [product], startsAt: "2026-12-01T00:00:00Z" }),
    ];

    expect(findTimerForProduct(timers, forProduct, now)).toBeNull();
  });

  it("returns null when no timer targets the product", () => {
    const timers = [fixedTimer({ targetType: "products", targetIds: ["gid://shopify/Product/2"] })];

    expect(findTimerForProduct(timers, forProduct, now)).toBeNull();
    expect(findTimerForProduct([], forProduct, now)).toBeNull();
  });
});
