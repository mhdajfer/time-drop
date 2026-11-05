import {
  POSITIONS,
  SIZES,
  TARGET_TYPES,
  TIMER_DEFAULTS,
  URGENCY_EFFECTS,
} from "./timer";

const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const RESOURCE_ID = {
  products: /^gid:\/\/shopify\/Product\/\d+$/,
  collections: /^gid:\/\/shopify\/Collection\/\d+$/,
};
const MAX_TARGETS = 250;
const MAX_DURATION_MINUTES = 30 * 24 * 60;
const MAX_URGENCY_MINUTES = 24 * 60;

export function sanitizeText(value, maxLength) {
  return String(value ?? "")
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

// Returns { data } with only the fields a timer may store, or { errors } keyed by field.
export function validateTimer(input = {}) {
  const errors = {};
  const valueOf = (key) =>
    input[key] === undefined || input[key] === "" ? TIMER_DEFAULTS[key] : input[key];

  const data = {
    name: sanitizeText(input.name, 80),
    description: sanitizeText(input.description, 200),
    type: input.type,
    startsAt: null,
    endsAt: null,
    durationMinutes: null,
    targetType: valueOf("targetType"),
    targetIds: [],
    backgroundColor: valueOf("backgroundColor"),
    textColor: valueOf("textColor"),
    position: valueOf("position"),
    size: valueOf("size"),
    urgency: valueOf("urgency"),
    urgencyMinutes: Number(valueOf("urgencyMinutes")),
  };

  if (!data.name) errors.name = "Name is required";

  if (data.type === "fixed") {
    data.startsAt = parseDate(input.startsAt);
    data.endsAt = parseDate(input.endsAt);
    if (!data.startsAt) errors.startsAt = "Enter a valid start date";
    if (!data.endsAt) {
      errors.endsAt = "Enter a valid end date";
    } else if (data.startsAt && data.endsAt <= data.startsAt) {
      errors.endsAt = "End date must be after the start date";
    }
  } else if (data.type === "evergreen") {
    data.durationMinutes = Number(input.durationMinutes);
    if (!isIntegerBetween(data.durationMinutes, 1, MAX_DURATION_MINUTES)) {
      errors.durationMinutes = "Duration must be between 1 minute and 30 days";
    }
  } else {
    errors.type = "Choose a fixed or evergreen timer";
  }

  if (!TARGET_TYPES.includes(data.targetType)) {
    errors.targetType = "Choose where the timer appears";
  } else if (data.targetType !== "all") {
    const ids = Array.isArray(input.targetIds) ? [...new Set(input.targetIds)] : [];
    const label = data.targetType === "products" ? "product" : "collection";

    if (ids.length === 0) {
      errors.targetIds = `Select at least one ${label}`;
    } else if (ids.length > MAX_TARGETS) {
      errors.targetIds = `Select up to ${MAX_TARGETS} items`;
    } else if (!ids.every((id) => typeof id === "string" && RESOURCE_ID[data.targetType].test(id))) {
      errors.targetIds = `Some selected items are not valid ${label}s`;
    }
    data.targetIds = ids;
  }

  for (const key of ["backgroundColor", "textColor"]) {
    if (typeof data[key] !== "string" || !HEX_COLOR.test(data[key])) {
      errors[key] = "Use a hex color like #1a1a1a";
    }
  }
  if (!POSITIONS.includes(data.position)) errors.position = "Choose a valid position";
  if (!SIZES.includes(data.size)) errors.size = "Choose a valid size";
  if (!URGENCY_EFFECTS.includes(data.urgency)) errors.urgency = "Choose a valid urgency effect";
  if (!isIntegerBetween(data.urgencyMinutes, 1, MAX_URGENCY_MINUTES)) {
    errors.urgencyMinutes = "Urgency must start between 1 minute and 24 hours before the end";
  }

  return Object.keys(errors).length > 0 ? { errors } : { data };
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isIntegerBetween(value, min, max) {
  return Number.isInteger(value) && value >= min && value <= max;
}
