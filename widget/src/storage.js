// Storage can be missing (private browsing, blocked cookies) or full.
// The widget still works without it; it just can't remember anything.
export function readJson(area, key) {
  try {
    return JSON.parse(window[area].getItem(key));
  } catch {
    return null;
  }
}

export function writeJson(area, key, value) {
  try {
    window[area].setItem(key, JSON.stringify(value));
  } catch {
    // Nothing to do: the next page view will simply start fresh.
  }
}
