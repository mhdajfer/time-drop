import { render } from "preact";
import { loadTimer, sendImpression } from "./api";
import { CountdownTimer, EndedNotice } from "./CountdownTimer";
import { nextEvergreenState } from "./countdown";
import { readJson, writeJson } from "./storage";

// Inside the theme editor we show a hint instead of nothing, and don't count impressions.
const designMode = Boolean(window.Shopify?.designMode);

function evergreenDeadline(timer) {
  const key = `timedrop:evergreen:${timer.id}`;
  const state = nextEvergreenState(readJson("localStorage", key), timer.durationMinutes, Date.now());
  writeJson("localStorage", key, state);

  // Remember when the visitor leaves, so a long break starts a fresh countdown.
  window.addEventListener("pagehide", () => {
    writeJson("localStorage", key, { ...state, lastSeen: Date.now() });
  });
  return state.deadline;
}

function createBar(position) {
  const bar = document.createElement("div");
  bar.className = `timedrop-bar timedrop-bar--${position}`;
  document.body.append(bar);
  return bar;
}

// The block reserves room for the timer while it loads. Give it back when nothing shows inline.
function collapse(root) {
  root.style.minHeight = "";
  root.hidden = true;
}

async function mount(root) {
  if (root.dataset.timedropMounted) return;
  root.dataset.timedropMounted = "true";

  const { productId, collectionIds, proxyPath } = root.dataset;
  const counted = new Set();
  let target = root;

  async function nextTimer(fresh) {
    const timer = await loadTimer(proxyPath, productId, collectionIds, fresh);
    if (!timer) return null;

    const deadline = timer.type === "evergreen" ? evergreenDeadline(timer) : Date.parse(timer.endsAt);
    return deadline > Date.now() ? { timer, deadline } : null;
  }

  async function handleEnd(timer) {
    // A fixed timer may be followed by another one. Evergreen timers restart on the next visit.
    const following = timer.type === "fixed" ? await nextTimer(true).catch(() => null) : null;
    if (following) show(following);
    else render(<EndedNotice timer={timer} />, target);
  }

  function show({ timer, deadline }) {
    if (timer.position !== "inline" && target === root) {
      collapse(root);
      target = createBar(timer.position);
    }

    render(
      <CountdownTimer key={timer.id} timer={timer} deadline={deadline} onEnd={() => handleEnd(timer)} />,
      target,
    );
    root.style.minHeight = "";

    if (!designMode && !counted.has(timer.id)) {
      counted.add(timer.id);
      sendImpression(proxyPath, timer.id);
    }
  }

  const first = await nextTimer(false);
  if (first) {
    show(first);
  } else if (designMode) {
    root.style.minHeight = "";
    render(<p className="timedrop__placeholder">No active TimeDrop timer for this product.</p>, root);
  } else {
    collapse(root);
  }
}

function start(scope) {
  scope.querySelectorAll("[data-timedrop]").forEach((root) => {
    mount(root).catch((error) => {
      // A timer problem must never break the storefront, so fail quietly.
      collapse(root);
      console.warn("TimeDrop: countdown unavailable", error);
    });
  });
}

start(document);
// The theme editor re-renders sections without reloading the page.
document.addEventListener("shopify:section:load", (event) => start(event.target));
