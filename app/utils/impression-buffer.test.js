import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createImpressionBuffer } from "./impression-buffer";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("createImpressionBuffer", () => {
  it("saves repeated impressions as one count per shop and timer after the flush delay", async () => {
    const save = vi.fn().mockResolvedValue();
    const buffer = createImpressionBuffer({ save, flushAfterMs: 5000 });

    buffer.add("a.myshopify.com", "timer1");
    buffer.add("a.myshopify.com", "timer1");
    buffer.add("b.myshopify.com", "timer1");
    expect(save).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(5000);

    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith([
      { shop: "a.myshopify.com", timerId: "timer1", count: 2 },
      { shop: "b.myshopify.com", timerId: "timer1", count: 1 },
    ]);
  });

  it("does nothing when there is nothing to save", async () => {
    const save = vi.fn();
    const buffer = createImpressionBuffer({ save });

    await buffer.flush();
    await vi.advanceTimersByTimeAsync(10_000);

    expect(save).not.toHaveBeenCalled();
  });

  it("keeps the counts and retries when saving fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const save = vi.fn().mockRejectedValueOnce(new Error("db down")).mockResolvedValue();
    const buffer = createImpressionBuffer({ save, flushAfterMs: 5000 });

    buffer.add("a.myshopify.com", "timer1");
    await vi.advanceTimersByTimeAsync(5000);
    buffer.add("a.myshopify.com", "timer1");
    await vi.advanceTimersByTimeAsync(5000);

    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenLastCalledWith([{ shop: "a.myshopify.com", timerId: "timer1", count: 2 }]);
    vi.mocked(console.error).mockRestore();
  });
});
