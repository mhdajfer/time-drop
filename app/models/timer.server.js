import mongoose from "../db.server";
import {
  POSITIONS,
  SIZES,
  TARGET_TYPES,
  TIMER_DEFAULTS,
  TIMER_TYPES,
  URGENCY_EFFECTS,
  findTimerForProduct,
} from "../utils/timer";

const timerSchema = new mongoose.Schema(
  {
    shop: { type: String, required: true },
    name: { type: String, required: true, maxlength: 80 },
    description: { type: String, default: TIMER_DEFAULTS.description, maxlength: 200 },
    type: { type: String, enum: TIMER_TYPES, required: true },
    startsAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },
    durationMinutes: { type: Number, default: null },
    targetType: { type: String, enum: TARGET_TYPES, default: TIMER_DEFAULTS.targetType },
    targetIds: { type: [String], default: [] },
    backgroundColor: { type: String, default: TIMER_DEFAULTS.backgroundColor },
    textColor: { type: String, default: TIMER_DEFAULTS.textColor },
    position: { type: String, enum: POSITIONS, default: TIMER_DEFAULTS.position },
    size: { type: String, enum: SIZES, default: TIMER_DEFAULTS.size },
    urgency: { type: String, enum: URGENCY_EFFECTS, default: TIMER_DEFAULTS.urgency },
    urgencyMinutes: { type: Number, default: TIMER_DEFAULTS.urgencyMinutes },
    impressions: { type: Number, default: 0 },
  },
  { timestamps: true, versionKey: false },
);

// Every query is scoped to a shop, so shop leads each index.
timerSchema.index({ shop: 1, createdAt: -1 });
timerSchema.index({ shop: 1, targetType: 1, endsAt: 1 });
timerSchema.index({ shop: 1, targetIds: 1, endsAt: 1 });

// Reuse the compiled model when Vite reloads this module in development.
export const Timer = mongoose.models.Timer || mongoose.model("Timer", timerSchema);

const STOREFRONT_FIELDS =
  "type startsAt endsAt durationMinutes targetType targetIds description backgroundColor textColor position size urgency urgencyMinutes";

export async function listTimers(shop) {
  return Timer.find({ shop }).sort({ createdAt: -1 }).lean();
}

export async function getTimer(shop, id) {
  if (!mongoose.isValidObjectId(id)) return null;
  return Timer.findOne({ _id: id, shop }).lean();
}

export async function createTimer(shop, data) {
  const timer = await Timer.create({ ...data, shop });
  return timer.toObject();
}

export async function updateTimer(shop, id, data) {
  if (!mongoose.isValidObjectId(id)) return null;
  return Timer.findOneAndUpdate({ _id: id, shop }, data, {
    returnDocument: "after",
    runValidators: true,
  }).lean();
}

export async function deleteTimer(shop, id) {
  if (!mongoose.isValidObjectId(id)) return false;
  const { deletedCount } = await Timer.deleteOne({ _id: id, shop });
  return deletedCount === 1;
}

export async function findTimerForStorefront(shop, product, now = new Date()) {
  const { productId, collectionIds = [] } = product;
  // Timers that haven't ended yet. Evergreen timers have no end date, so they match too.
  const notEnded = { $not: { $lte: now } };

  const timers = await Timer.find({
    $or: [
      { shop, targetType: "all", endsAt: notEnded },
      { shop, targetIds: { $in: [productId, ...collectionIds] }, endsAt: notEnded },
    ],
  })
    .select(STOREFRONT_FIELDS)
    .lean();

  return findTimerForProduct(timers, { productId, collectionIds }, now);
}

// Takes [{ shop, timerId, count }] and applies all increments in one round trip.
export async function addImpressions(counts) {
  const operations = counts
    .filter(({ timerId }) => mongoose.isValidObjectId(timerId))
    .map(({ shop, timerId, count }) => ({
      updateOne: {
        filter: { _id: timerId, shop },
        update: { $inc: { impressions: count } },
      },
    }));

  if (operations.length > 0) {
    await Timer.bulkWrite(operations, { ordered: false });
  }
}
