// ui.js — small drawing helpers shared by several screens.

// Change the big title at the top of the screen
export function setTitle(text) {
  document.getElementById("title").textContent = text;
}

// A "‹ Back" link. Goes back to the previous screen if there is one,
// otherwise to Home (e.g. when the app was opened straight onto this page).
export function backButton(label) {
  return `<a class="button-link back" href="#"
    onclick="event.preventDefault(); history.length > 1 ? history.back() : (location.hash = '#home')">‹ ${label}</a>`;
}

// True if the user is still on the same screen as when `address` was
// recorded. Screens use this after waiting for ESPN, so a slow answer
// doesn't draw over a screen the user has already left.
export function stillOn(address) {
  return location.hash === address;
}

// ---------- Refreshing ----------

// app.js sets this while it redraws the current screen to refresh it.
// Screens check it so they can keep showing the old scores while new ones
// load, instead of flashing "Loading…".
let refreshing = false;
export function setRefreshing(value) { refreshing = value; }
export function isRefreshing() { return refreshing; }

// Screens call this once their data has arrived, to show "Updated 8:02 PM".
export function markUpdated() {
  const time = new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const line = document.getElementById("updated");
  line.querySelector("span").textContent = `Updated ${time}`;
  line.hidden = false;
}

// Hide the "Updated" line (for screens with no live data, like Settings)
export function hideUpdated() {
  document.getElementById("updated").hidden = true;
}

// ---------- "Show all" lists ----------

// Make every "Show all" button on the screen reveal its list's hidden rows
export function wireShowAll(screen) {
  for (const button of screen.querySelectorAll(".show-all")) {
    button.addEventListener("click", () => {
      button.closest(".section").classList.add("expanded");
      button.remove();
    });
  }
}

// Before redrawing for a refresh: note which lists were opened with
// "Show all". Call the function it returns after redrawing to reopen them.
export function rememberExpanded(screen) {
  const open = [...screen.querySelectorAll(".section")]
    .map(section => section.classList.contains("expanded"));
  return () => {
    screen.querySelectorAll(".section").forEach((section, i) => {
      if (!open[i]) return;
      section.classList.add("expanded");
      section.querySelector(".show-all")?.remove();
    });
  };
}
