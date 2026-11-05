import { readJson, writeJson } from "./storage";

// Matches the server's Cache-Control, so browsing between products reuses timer settings.
const CACHE_MS = 60 * 1000;
const TIMEOUT_MS = 5000;

export async function loadTimer(proxyPath, productId, collectionIds, fresh = false) {
  const url = `${proxyPath}/timer?product=${encodeURIComponent(productId)}&collections=${encodeURIComponent(collectionIds)}`;
  const cacheKey = `timedrop:${url}`;
  const cached = fresh ? null : readJson("sessionStorage", cacheKey);
  if (cached && Date.now() - cached.savedAt < CACHE_MS) return cached.timer;

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    // A refetch after a timer ends must skip the browser cache too.
    cache: fresh ? "no-cache" : "default",
    signal: AbortSignal.timeout?.(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Timer request failed with ${response.status}`);

  const { timer } = await response.json();
  writeJson("sessionStorage", cacheKey, { timer, savedAt: Date.now() });
  return timer;
}

// sendBeacon doesn't hold up the page and still delivers if the shopper navigates away.
export function sendImpression(proxyPath, timerId) {
  const url = `${proxyPath}/impressions`;
  const body = JSON.stringify({ timerId });

  if (!navigator.sendBeacon?.(url, new Blob([body], { type: "application/json" }))) {
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  }
}
