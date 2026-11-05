// Fixed-window request counter per key, held in memory. This protects a single
// server; running several instances would need a shared store such as Redis.
export function createRateLimiter({ limit, windowMs, maxKeys = 10_000, now = Date.now }) {
  const windows = new Map();

  function removeExpired(time) {
    for (const [key, window] of windows) {
      if (time >= window.resetAt) windows.delete(key);
    }
  }

  return {
    hit(key) {
      const time = now();
      let window = windows.get(key);

      if (!window || time >= window.resetAt) {
        if (windows.size >= maxKeys) removeExpired(time);
        window = { count: 0, resetAt: time + windowMs };
        windows.set(key, window);
      }

      window.count += 1;
      return {
        allowed: window.count <= limit,
        retryAfterSeconds: Math.ceil((window.resetAt - time) / 1000),
      };
    },

    get size() {
      return windows.size;
    },
  };
}
