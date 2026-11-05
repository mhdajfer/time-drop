import { beforeEach, describe, expect, it, vi } from "vitest";
import { authenticate } from "../shopify.server";
import { addImpressions, findTimerForStorefront } from "../models/timer.server";
import { impressions } from "../utils/impressions.server";
import * as impressionsRoute from "./proxy.impressions";
import * as timerRoute from "./proxy.timer";

vi.mock("../shopify.server", () => ({ authenticate: { public: { appProxy: vi.fn() } } }));
vi.mock("../models/timer.server", () => ({
  findTimerForStorefront: vi.fn(),
  addImpressions: vi.fn(),
}));

const shop = "test-shop.myshopify.com";
const timerId = "6650f1c2a1b2c3d4e5f60718";

function proxyRequest(path, { method = "GET", params = {}, body, ip = "203.0.113.10" } = {}) {
  const url = new URL(`https://app.example.com${path}`);
  for (const [key, value] of Object.entries({ shop, ...params })) url.searchParams.set(key, value);

  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json", "X-Forwarded-For": ip },
    body: body && JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  authenticate.public.appProxy.mockResolvedValue({});
});

describe("GET /proxy/timer", () => {
  it("rejects requests without a valid app proxy signature", async () => {
    authenticate.public.appProxy.mockRejectedValue(new Response(null, { status: 400 }));

    const response = await timerRoute.loader({
      request: proxyRequest("/proxy/timer", { params: { product: "1" } }),
    });

    expect(response.status).toBe(400);
    expect(findTimerForStorefront).not.toHaveBeenCalled();
  });

  it("returns the product's timer with public cache headers", async () => {
    findTimerForStorefront.mockResolvedValue({
      _id: timerId,
      type: "evergreen",
      endsAt: null,
      durationMinutes: 30,
      description: "Flash sale",
    });

    const response = await timerRoute.loader({
      request: proxyRequest("/proxy/timer", { params: { product: "123", collections: "4,abc,5" } }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=60, stale-while-revalidate=60");
    expect(findTimerForStorefront).toHaveBeenCalledWith(shop, {
      productId: "gid://shopify/Product/123",
      collectionIds: ["gid://shopify/Collection/4", "gid://shopify/Collection/5"],
    });
    expect((await response.json()).timer).toMatchObject({ id: timerId, message: "Flash sale" });
  });

  it("returns a null timer when nothing targets the product", async () => {
    findTimerForStorefront.mockResolvedValue(null);

    const response = await timerRoute.loader({
      request: proxyRequest("/proxy/timer", { params: { product: "123" } }),
    });

    expect(await response.json()).toEqual({ timer: null });
  });

  it("requires a numeric product id", async () => {
    const response = await timerRoute.loader({
      request: proxyRequest("/proxy/timer", { params: { product: "gid://shopify/Product/1" } }),
    });

    expect(response.status).toBe(400);
    expect(findTimerForStorefront).not.toHaveBeenCalled();
  });

  it("rate limits each shopper separately", async () => {
    findTimerForStorefront.mockResolvedValue(null);
    const request = (ip) => proxyRequest("/proxy/timer", { params: { product: "1" }, ip });

    for (let i = 0; i < 300; i += 1) await timerRoute.loader({ request: request("198.51.100.7") });
    const limited = await timerRoute.loader({ request: request("198.51.100.7") });
    const otherShopper = await timerRoute.loader({ request: request("198.51.100.8") });

    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(otherShopper.status).toBe(200);
  });
});

describe("POST /proxy/impressions", () => {
  it("accepts impressions and saves them in one batch", async () => {
    for (let i = 0; i < 2; i += 1) {
      const response = await impressionsRoute.action({
        request: proxyRequest("/proxy/impressions", { method: "POST", body: { timerId } }),
      });
      expect(response.status).toBe(202);
    }

    await impressions.flush();

    expect(addImpressions).toHaveBeenCalledWith([{ shop, timerId, count: 2 }]);
  });

  it("rejects a missing or malformed timer id", async () => {
    for (const body of [{}, { timerId: "abc" }, { timerId: { $ne: null } }]) {
      const response = await impressionsRoute.action({
        request: proxyRequest("/proxy/impressions", { method: "POST", body }),
      });
      expect(response.status).toBe(400);
    }

    await impressions.flush();
    expect(addImpressions).not.toHaveBeenCalled();
  });

  it("only accepts POST", async () => {
    const response = await impressionsRoute.action({
      request: proxyRequest("/proxy/impressions", { method: "PUT", body: { timerId } }),
    });

    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("POST");
  });
});
