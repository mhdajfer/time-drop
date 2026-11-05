import { TIMER_DEFAULTS } from "./timer";
import { fromZonedParts, toZonedParts } from "./timezone";

const HALF_HOUR = 30 * 60 * 1000;
const WEEK = 7 * 24 * 60 * 60 * 1000;

export const DURATION_UNITS = { minutes: 1, hours: 60, days: 1440 };

// The time pickers offer every half hour, like Shopify's own discount scheduler.
const TIME_OPTIONS = Array.from({ length: 48 }, (_, index) => {
  const hours = String(Math.floor(index / 2)).padStart(2, "0");
  return `${hours}:${index % 2 ? "30" : "00"}`;
});

// Turns a stored timer (or {} for a new one) into the values the form edits.
export function toFormValues(timer, resources, timeZone, now = new Date()) {
  const values = { ...TIMER_DEFAULTS, type: "fixed", name: "", targetIds: [], ...timer };
  // New timers start at the current half hour, so they're live once saved, and run for a week.
  const defaultStart = Math.floor(now.getTime() / HALF_HOUR) * HALF_HOUR;
  const start = toZonedParts(values.startsAt ?? defaultStart, timeZone);
  const end = toZonedParts(values.endsAt ?? defaultStart + WEEK, timeZone);
  const duration = splitDuration(values.durationMinutes ?? 60);
  const titles = new Map(resources.map(({ id, title }) => [id, title]));

  return {
    name: values.name,
    description: values.description,
    type: values.type,
    startDate: start.date,
    startTime: start.time,
    endDate: end.date,
    endTime: end.time,
    durationValue: String(duration.value),
    durationUnit: duration.unit,
    targetType: values.targetType,
    // Products or collections deleted from the store are dropped here.
    targets: values.targetIds
      .filter((id) => titles.has(id))
      .map((id) => ({ id, title: titles.get(id) })),
    backgroundColor: values.backgroundColor,
    textColor: values.textColor,
    size: values.size,
    position: values.position,
    urgency: values.urgency,
    urgencyMinutes: String(values.urgencyMinutes),
  };
}

// Turns form values back into the body the timers API expects.
export function toTimerInput(values, timeZone) {
  const fixed = values.type === "fixed";

  return {
    name: values.name,
    description: values.description,
    type: values.type,
    startsAt: fixed ? fromZonedParts(values.startDate, values.startTime, timeZone) : null,
    endsAt: fixed ? fromZonedParts(values.endDate, values.endTime, timeZone) : null,
    durationMinutes: fixed
      ? null
      : Number(values.durationValue) * DURATION_UNITS[values.durationUnit],
    targetType: values.targetType,
    targetIds: values.targetType === "all" ? [] : values.targets.map(({ id }) => id),
    backgroundColor: values.backgroundColor,
    textColor: values.textColor,
    size: values.size,
    position: values.position,
    urgency: values.urgency,
    urgencyMinutes: Number(values.urgencyMinutes),
  };
}

// Half-hour options, plus the current value if it was saved at another minute.
export function timeOptionsWith(value) {
  return TIME_OPTIONS.includes(value) ? TIME_OPTIONS : [...TIME_OPTIONS, value].sort();
}

export function formatTimeLabel(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${hours < 12 ? "AM" : "PM"}`;
}

function splitDuration(minutes) {
  if (minutes % DURATION_UNITS.days === 0) return { value: minutes / DURATION_UNITS.days, unit: "days" };
  if (minutes % DURATION_UNITS.hours === 0) return { value: minutes / DURATION_UNITS.hours, unit: "hours" };
  return { value: minutes, unit: "minutes" };
}
