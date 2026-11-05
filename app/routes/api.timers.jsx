import { createTimer, listTimers } from "../models/timer.server";
import {
  errorResponse,
  handleApiErrors,
  jsonResponse,
  methodNotAllowed,
  readJson,
  requireShop,
} from "../utils/api.server";
import { serializeTimer } from "../utils/timer";
import { validateTimer } from "../utils/validate-timer";

// GET /api/timers
export const loader = ({ request }) =>
  handleApiErrors(async () => {
    const shop = await requireShop(request);
    const timers = await listTimers(shop);
    const now = new Date();

    return jsonResponse({ timers: timers.map((timer) => serializeTimer(timer, now)) });
  });

// POST /api/timers
export const action = ({ request }) =>
  handleApiErrors(async () => {
    if (request.method !== "POST") return methodNotAllowed("GET, POST");

    const shop = await requireShop(request);
    const { data, errors } = validateTimer(await readJson(request));
    if (errors) return errorResponse(422, "Please fix the highlighted fields", errors);

    const timer = serializeTimer(await createTimer(shop, data));
    return jsonResponse({ timer }, 201, { Location: `/api/timers/${timer.id}` });
  });
