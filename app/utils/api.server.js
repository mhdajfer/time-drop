import { authenticate } from "../shopify.server";

// Admin API responses belong to one shop, so they must never be cached.
const NO_STORE = { "Cache-Control": "no-store" };

export function jsonResponse(data, status = 200, headers = {}) {
  return Response.json(data, { status, headers: { ...NO_STORE, ...headers } });
}

export function errorResponse(status, message, errors) {
  return jsonResponse(errors ? { error: message, errors } : { error: message }, status);
}

export function methodNotAllowed(allowed) {
  return jsonResponse({ error: "Method not allowed" }, 405, { Allow: allowed });
}

// App Bridge adds a session token to every fetch made from the embedded admin.
// A request without one gets a 401 instead of Shopify's HTML auth page.
export async function requireShop(request) {
  if (!request.headers.get("Authorization")) {
    throw errorResponse(401, "Missing session token");
  }

  const { session } = await authenticate.admin(request);
  return session.shop;
}

export async function readJson(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    throw errorResponse(400, "Request body must be valid JSON");
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw errorResponse(400, "Request body must be a JSON object");
  }
  return body;
}

// Runs a route handler and turns unexpected failures into a JSON 500.
export async function handleApiErrors(handler) {
  try {
    return await handler();
  } catch (error) {
    if (error instanceof Response) return error;

    console.error(error);
    return errorResponse(500, "Something went wrong. Please try again.");
  }
}
