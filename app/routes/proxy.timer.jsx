import { authenticate } from "../shopify.server";
import { findTimerForStorefront } from "../models/timer.server";
import { errorResponse, handleApiErrors, jsonResponse } from "../utils/api.server";
import { createRateLimiter } from "../utils/rate-limiter";
import { clientKey, toResourceGid, tooManyRequests } from "../utils/storefront.server";
import { toStorefrontTimer } from "../utils/timer";

const MAX_COLLECTIONS = 100;
const limiter = createRateLimiter({ limit: 300, windowMs: 60_000 });

// Timer settings change rarely, so browsers can reuse the response for a minute.
// The widget handles a timer reaching its end by itself.
const CACHE_HEADERS = { "Cache-Control": "public, max-age=60, stale-while-revalidate=60" };

// GET /apps/timedrop/timer?product=123&collections=4,5 on the storefront,
// forwarded by Shopify's app proxy with a signature.
export const loader = ({ request }) =>
  handleApiErrors(async () => {
    await authenticate.public.appProxy(request);

    const url = new URL(request.url);
    const shop = url.searchParams.get("shop");
    const { allowed, retryAfterSeconds } = limiter.hit(clientKey(shop, request));
    if (!allowed) return tooManyRequests(retryAfterSeconds);

    const productId = toResourceGid("Product", url.searchParams.get("product"));
    if (!productId) return errorResponse(400, "A numeric product id is required");

    const collectionIds = (url.searchParams.get("collections") ?? "")
      .split(",")
      .slice(0, MAX_COLLECTIONS)
      .map((id) => toResourceGid("Collection", id))
      .filter(Boolean);

    const timer = await findTimerForStorefront(shop, { productId, collectionIds });

    return jsonResponse({ timer: timer && toStorefrontTimer(timer) }, 200, CACHE_HEADERS);
  });
