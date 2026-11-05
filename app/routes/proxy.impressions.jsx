import { authenticate } from "../shopify.server";
import {
  errorResponse,
  handleApiErrors,
  methodNotAllowed,
  readJson,
} from "../utils/api.server";
import { impressions } from "../utils/impressions.server";
import { createRateLimiter } from "../utils/rate-limiter";
import { clientKey, tooManyRequests } from "../utils/storefront.server";

const TIMER_ID = /^[a-f\d]{24}$/i;
const limiter = createRateLimiter({ limit: 300, windowMs: 60_000 });

// POST /apps/timedrop/impressions with { "timerId": "..." }, forwarded by the app proxy.
// Counts are saved in batches, so this answers 202 before they reach the database.
export const action = ({ request }) =>
  handleApiErrors(async () => {
    if (request.method !== "POST") return methodNotAllowed("POST");

    await authenticate.public.appProxy(request);

    const shop = new URL(request.url).searchParams.get("shop");
    const { allowed, retryAfterSeconds } = limiter.hit(clientKey(shop, request));
    if (!allowed) return tooManyRequests(retryAfterSeconds);

    const { timerId } = await readJson(request);
    if (typeof timerId !== "string" || !TIMER_ID.test(timerId)) {
      return errorResponse(400, "A valid timerId is required");
    }

    impressions.add(shop, timerId);
    return new Response(null, { status: 202 });
  });
