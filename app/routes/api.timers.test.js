import { beforeEach, describe, expect, it, vi } from "vitest";
import { authenticate } from "../shopify.server";
import {
  createTimer,
  deleteTimer,
  getTimer,
  listTimers,
  updateTimer,
} from "../models/timer.server";
import * as timersRoute from "./api.timers";
import * as timerRoute from "./api.timers.$id";

vi.mock("../shopify.server", () => ({ authenticate: { admin: vi.fn() } }));
vi.mock("../models/timer.server", () => ({
  listTimers: vi.fn(),
  createTimer: vi.fn(),
  getTimer: vi.fn(),
  updateTimer: vi.fn(),
  deleteTimer: vi.fn(),
}));

const shop = "test-shop.myshopify.com";
const id = "6650f1c2a1b2c3d4e5f60718";
const input = { name: "Flash sale", type: "evergreen", durationMinutes: 30 };

function apiRequest(method, path, { body, token = "session-token" } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  return new Request(`https://app.example.com${path}`, {
    method,
    headers,
    body: typeof body === "string" ? body : body && JSON.stringify(body),
  });
}

function storedTimer(fields = {}) {
  return { _id: id, shop, ...input, targetType: "all", targetIds: [], impressions: 12, ...fields };
}

beforeEach(() => {
  vi.clearAllMocks();
  authenticate.admin.mockResolvedValue({ session: { shop } });
});

describe("GET /api/timers", () => {
  it("rejects requests without a session token", async () => {
    const response = await timersRoute.loader({
      request: apiRequest("GET", "/api/timers", { token: null }),
    });

    expect(response.status).toBe(401);
    expect(authenticate.admin).not.toHaveBeenCalled();
  });

  it("passes through Shopify's response for an invalid session token", async () => {
    authenticate.admin.mockRejectedValue(new Response(null, { status: 401 }));

    const response = await timersRoute.loader({ request: apiRequest("GET", "/api/timers") });

    expect(response.status).toBe(401);
    expect(listTimers).not.toHaveBeenCalled();
  });

  it("lists the authenticated shop's timers with an id and status", async () => {
    listTimers.mockResolvedValue([storedTimer()]);

    const response = await timersRoute.loader({ request: apiRequest("GET", "/api/timers") });
    const { timers } = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(listTimers).toHaveBeenCalledWith(shop);
    expect(timers).toEqual([
      expect.objectContaining({ id, name: "Flash sale", status: "active", impressions: 12 }),
    ]);
    expect(timers[0]).not.toHaveProperty("_id");
  });
});

describe("POST /api/timers", () => {
  it("creates a timer and returns 201 with its location", async () => {
    createTimer.mockImplementation(async (_shop, data) => storedTimer(data));

    const response = await timersRoute.action({
      request: apiRequest("POST", "/api/timers", { body: input }),
    });

    expect(response.status).toBe(201);
    expect(response.headers.get("Location")).toBe(`/api/timers/${id}`);
    expect(createTimer).toHaveBeenCalledWith(
      shop,
      expect.objectContaining({ name: "Flash sale", durationMinutes: 30 }),
    );
  });

  it("returns 422 with field errors and saves nothing", async () => {
    const response = await timersRoute.action({
      request: apiRequest("POST", "/api/timers", { body: { type: "fixed" } }),
    });

    expect(response.status).toBe(422);
    expect((await response.json()).errors).toMatchObject({
      name: expect.any(String),
      startsAt: expect.any(String),
      endsAt: expect.any(String),
    });
    expect(createTimer).not.toHaveBeenCalled();
  });

  it("returns 400 when the body is not a JSON object", async () => {
    for (const body of ["{not json", "[1, 2]"]) {
      const response = await timersRoute.action({
        request: apiRequest("POST", "/api/timers", { body }),
      });

      expect(response.status).toBe(400);
    }
  });

  it("returns 405 for unsupported methods", async () => {
    const response = await timersRoute.action({
      request: apiRequest("PATCH", "/api/timers", { body: input }),
    });

    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("GET, POST");
  });
});

describe("/api/timers/:id", () => {
  const params = { id };

  it("returns 404 when the shop has no timer with that id", async () => {
    getTimer.mockResolvedValue(null);

    const response = await timerRoute.loader({
      request: apiRequest("GET", `/api/timers/${id}`),
      params,
    });

    expect(response.status).toBe(404);
    expect(getTimer).toHaveBeenCalledWith(shop, id);
  });

  it("updates a timer with sanitized data only", async () => {
    updateTimer.mockImplementation(async (_shop, _id, data) => storedTimer(data));

    const response = await timerRoute.action({
      request: apiRequest("PUT", `/api/timers/${id}`, {
        body: { ...input, name: "<b>Renamed</b>", shop: "other.myshopify.com" },
      }),
      params,
    });
    const [updatedShop, updatedId, data] = updateTimer.mock.calls[0];

    expect(response.status).toBe(200);
    expect([updatedShop, updatedId]).toEqual([shop, id]);
    expect(data.name).toBe("Renamed");
    expect(data).not.toHaveProperty("shop");
  });

  it("deletes a timer and returns 204", async () => {
    deleteTimer.mockResolvedValue(true);

    const response = await timerRoute.action({
      request: apiRequest("DELETE", `/api/timers/${id}`),
      params,
    });

    expect(response.status).toBe(204);
    expect(deleteTimer).toHaveBeenCalledWith(shop, id);
  });

  it("returns a generic JSON 500 when something unexpected fails", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    getTimer.mockRejectedValue(new Error("connect ECONNREFUSED 10.0.0.5:27017"));

    const response = await timerRoute.loader({
      request: apiRequest("GET", `/api/timers/${id}`),
      params,
    });

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Something went wrong. Please try again." });
    consoleError.mockRestore();
  });
});
