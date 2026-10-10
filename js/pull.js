// pull.js — "pull down to refresh", like in Mail or Messages.
// When you're at the top of the screen and drag down far enough, then let
// go, it calls onRefresh() and shows a spinning arrow until that finishes.

const PULL_DISTANCE = 110;   // how far (in points) you must drag to trigger it

export function enablePullToRefresh(onRefresh) {
  const indicator = document.getElementById("pull");
  const arrow = indicator.querySelector(".pull-arrow");
  const label = indicator.querySelector(".pull-label");
  let startY = null;   // where the finger started (null = not pulling)
  let distance = 0;
  let busy = false;

  window.addEventListener("touchstart", event => {
    // Only start a pull when the screen is scrolled all the way to the top
    startY = (window.scrollY <= 0 && !busy) ? event.touches[0].clientY : null;
    distance = 0;
  }, { passive: true });

  window.addEventListener("touchmove", event => {
    if (startY === null) return;
    distance = Math.max(0, event.touches[0].clientY - startY);
    const ready = distance > PULL_DISTANCE;
    indicator.style.height = `${Math.min(distance / 2, 64)}px`;
    indicator.classList.toggle("ready", ready);
    label.textContent = ready ? "Release to refresh" : "Pull to refresh";
  }, { passive: true });

  window.addEventListener("touchend", async () => {
    if (startY === null) return;
    const go = distance > PULL_DISTANCE;
    startY = null;

    if (go) {
      busy = true;
      indicator.classList.add("spinning");
      indicator.style.height = "44px";
      arrow.textContent = "↻";
      label.textContent = "Refreshing…";
      try { await onRefresh(); } finally { busy = false; }
    }

    // Tuck the indicator away again
    indicator.classList.remove("spinning", "ready");
    indicator.style.height = "";
    arrow.textContent = "↓";
  });
}
