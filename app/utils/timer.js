export const TIMER_TYPES = ["fixed", "evergreen"];
export const TARGET_TYPES = ["all", "products", "collections"];
export const POSITIONS = ["inline", "top", "bottom"];
export const SIZES = ["small", "medium", "large"];
export const URGENCY_EFFECTS = ["none", "pulse"];

export const TIMER_DEFAULTS = {
  description: "",
  targetType: "all",
  backgroundColor: "#1a1a1a",
  textColor: "#ffffff",
  position: "inline",
  size: "medium",
  urgency: "pulse",
  urgencyMinutes: 15,
};

// When several timers match a product, the most specific one wins.
const TARGET_PRIORITY = { products: 0, collections: 1, all: 2 };

export function getTimerStatus(timer, now = new Date()) {
  if (timer.type === "evergreen") return "active";
  if (now < new Date(timer.startsAt)) return "scheduled";
  if (now >= new Date(timer.endsAt)) return "expired";
  return "active";
}

// API shape: a plain string id instead of Mongo's _id, plus the current status.
export function serializeTimer({ _id, ...timer }, now = new Date()) {
  return { id: String(_id), ...timer, status: getTimerStatus(timer, now) };
}

export function matchesProduct(timer, { productId, collectionIds = [] }) {
  if (timer.targetType === "all") return true;
  if (timer.targetType === "products") return timer.targetIds.includes(productId);
  return timer.targetIds.some((id) => collectionIds.includes(id));
}

export function findTimerForProduct(timers, product, now = new Date()) {
  const candidates = timers.filter(
    (timer) =>
      getTimerStatus(timer, now) === "active" && matchesProduct(timer, product),
  );

  candidates.sort(
    (a, b) =>
      TARGET_PRIORITY[a.targetType] - TARGET_PRIORITY[b.targetType] ||
      endTime(a) - endTime(b),
  );

  return candidates[0] ?? null;
}

function endTime(timer) {
  return timer.endsAt ? new Date(timer.endsAt).getTime() : Infinity;
}
