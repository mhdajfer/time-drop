// Counts impressions in memory and saves them in one batch every few seconds,
// so a busy store doesn't cause a database write for every page view.
export function createImpressionBuffer({ save, flushAfterMs = 5000 }) {
  const counts = new Map();
  let flushTimer = null;

  function add(shop, timerId, count = 1) {
    const key = `${shop} ${timerId}`;
    counts.set(key, (counts.get(key) ?? 0) + count);

    if (!flushTimer) {
      flushTimer = setTimeout(flush, flushAfterMs);
      // Don't keep the process alive just to flush impressions.
      flushTimer.unref?.();
    }
  }

  async function flush() {
    clearTimeout(flushTimer);
    flushTimer = null;
    if (counts.size === 0) return;

    const batch = [...counts].map(([key, count]) => {
      const [shop, timerId] = key.split(" ");
      return { shop, timerId, count };
    });
    counts.clear();

    try {
      await save(batch);
    } catch (error) {
      console.error("Failed to save impressions, retrying on the next flush", error);
      batch.forEach(({ shop, timerId, count }) => add(shop, timerId, count));
    }
  }

  return { add, flush };
}
