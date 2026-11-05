// Timers are scheduled in the store's timezone. These helpers convert between
// wall-clock values in that zone ("2026-11-27", "09:30") and UTC dates.

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}$/;
const formatters = new Map();

export function toZonedParts(value, timeZone) {
  const parts = {};
  for (const { type, value: part } of partsFormatter(timeZone).formatToParts(new Date(value))) {
    parts[type] = part;
  }

  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
}

export function fromZonedParts(date, time, timeZone) {
  if (!DATE.test(date) || !TIME.test(time)) return null;

  const wallClock = Date.parse(`${date}T${time}:00Z`);
  // The offset depends on the instant itself, so correct twice to settle around DST changes.
  let utc = wallClock - offsetAt(wallClock, timeZone);
  utc = wallClock - offsetAt(utc, timeZone);
  return new Date(utc);
}

export function formatDateTime(value, timeZone) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function offsetAt(timestamp, timeZone) {
  const { date, time } = toZonedParts(timestamp, timeZone);
  return Date.parse(`${date}T${time}:00Z`) - Math.floor(timestamp / 60000) * 60000;
}

function partsFormatter(timeZone) {
  if (!formatters.has(timeZone)) {
    formatters.set(
      timeZone,
      new Intl.DateTimeFormat("en-US", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }),
    );
  }
  return formatters.get(timeZone);
}
