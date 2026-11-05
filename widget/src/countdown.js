const SECOND = 1000;
const MINUTE = 60 * SECOND;

// A visitor's evergreen countdown starts over after this long away from the store.
export const SESSION_GAP = 30 * MINUTE;

export function timeLeft(deadline, now) {
  const total = Math.max(0, deadline - now);
  const seconds = Math.floor(total / SECOND);

  return {
    total,
    days: Math.floor(seconds / 86400),
    hours: Math.floor((seconds % 86400) / 3600),
    minutes: Math.floor((seconds % 3600) / 60),
    seconds: seconds % 60,
  };
}

// Evergreen timers give each visitor their own deadline, remembered between page views.
// It starts over once it has run out, after a long break, or if the merchant changes its length.
export function nextEvergreenState(saved, durationMinutes, now) {
  const durationMs = durationMinutes * MINUTE;
  const keep =
    saved &&
    saved.durationMs === durationMs &&
    now < saved.deadline &&
    now - saved.lastSeen < SESSION_GAP;

  return {
    deadline: keep ? saved.deadline : now + durationMs,
    durationMs,
    lastSeen: now,
  };
}

export function isUrgent(timer, remaining) {
  return timer.urgency === "pulse" && remaining > 0 && remaining <= timer.urgencyMinutes * MINUTE;
}
