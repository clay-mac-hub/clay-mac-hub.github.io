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
