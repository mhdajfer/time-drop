import { describe, expect, it } from "vitest";
import { createRateLimiter } from "./rate-limiter";

function limiterAt(startTime, options) {
  let time = startTime;
  const limiter = createRateLimiter({ now: () => time, ...options });
  return { limiter, advance: (ms) => (time += ms) };
}

describe("createRateLimiter", () => {
  it("allows requests up to the limit, then blocks with a retry time", () => {
    const { limiter, advance } = limiterAt(0, { limit: 3, windowMs: 60_000 });

    expect([1, 2, 3].map(() => limiter.hit("shop:1.2.3.4").allowed)).toEqual([true, true, true]);
    advance(15_000);
    expect(limiter.hit("shop:1.2.3.4")).toEqual({ allowed: false, retryAfterSeconds: 45 });
  });

  it("starts a fresh window once the current one ends", () => {
    const { limiter, advance } = limiterAt(0, { limit: 1, windowMs: 60_000 });

    limiter.hit("key");
    expect(limiter.hit("key").allowed).toBe(false);
    advance(60_000);
    expect(limiter.hit("key").allowed).toBe(true);
  });

  it("counts each key separately", () => {
    const { limiter } = limiterAt(0, { limit: 1, windowMs: 60_000 });

    expect(limiter.hit("shop-a:1.2.3.4").allowed).toBe(true);
    expect(limiter.hit("shop-b:1.2.3.4").allowed).toBe(true);
    expect(limiter.hit("shop-a:5.6.7.8").allowed).toBe(true);
    expect(limiter.hit("shop-a:1.2.3.4").allowed).toBe(false);
  });

  it("clears expired windows when it reaches its key limit", () => {
    const { limiter, advance } = limiterAt(0, { limit: 5, windowMs: 1_000, maxKeys: 3 });

    ["a", "b", "c"].forEach((key) => limiter.hit(key));
    advance(1_000);
    limiter.hit("d");

    expect(limiter.size).toBe(1);
  });
});
