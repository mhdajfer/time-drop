import { jsonResponse } from "./api.server";

// Liquid gives the widget numeric ids; the database stores Shopify GIDs.
export function toResourceGid(type, id) {
  return /^\d+$/.test(id ?? "") ? `gid://shopify/${type}/${id}` : null;
}

// Rate limits apply per shop and shopper. Shopify forwards the shopper's IP in
// X-Forwarded-For; without it, all shoppers of a store share one budget.
export function clientKey(shop, request) {
  const ip = request.headers.get("X-Forwarded-For")?.split(",")[0].trim() || "unknown";
  return `${shop}:${ip}`;
}

export function tooManyRequests(retryAfterSeconds) {
  return jsonResponse({ error: "Too many requests" }, 429, {
    "Retry-After": String(retryAfterSeconds),
  });
}
