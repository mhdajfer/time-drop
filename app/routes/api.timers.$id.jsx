import { deleteTimer, getTimer, updateTimer } from "../models/timer.server";
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

const notFound = () => errorResponse(404, "Timer not found");

// GET /api/timers/:id
export const loader = ({ request, params }) =>
  handleApiErrors(async () => {
    const shop = await requireShop(request);
    const timer = await getTimer(shop, params.id);

    return timer ? jsonResponse({ timer: serializeTimer(timer) }) : notFound();
  });

// PUT and DELETE /api/timers/:id
export const action = ({ request, params }) =>
  handleApiErrors(async () => {
    if (request.method !== "PUT" && request.method !== "DELETE") {
      return methodNotAllowed("GET, PUT, DELETE");
    }

    const shop = await requireShop(request);

    if (request.method === "DELETE") {
      const deleted = await deleteTimer(shop, params.id);
      return deleted ? new Response(null, { status: 204 }) : notFound();
    }

    const { data, errors } = validateTimer(await readJson(request));
    if (errors) return errorResponse(422, "Please fix the highlighted fields", errors);

    const timer = await updateTimer(shop, params.id, data);
    return timer ? jsonResponse({ timer: serializeTimer(timer) }) : notFound();
  });
