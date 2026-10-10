// order.js — the "League Order" screen.
// Drag a league by its ≡ handle to move it. The order is saved straight
// away and used everywhere: Leagues, Scores, the team picker and Dashboard.

import { orderedLeagues } from "../data/leagues.js";
import { setLeagueOrder } from "../store.js";
import { backButton } from "../ui.js";

export function orderScreen(screen) {
  const rows = orderedLeagues().map(league => `
    <li data-league="${league.id}">
      <span>${league.name}</span>
      <span class="drag-handle" aria-label="Drag to reorder ${league.name}">≡</span>
    </li>`).join("");

  screen.innerHTML = `
    <div class="toolbar">${backButton("Back")}<span></span></div>
    <p class="dim note top-note">Drag ≡ to move a league up or down.</p>
    <ul class="list reorder" id="order-list">${rows}</ul>
    <button class="button-link reset" id="reset-order">Reset to standard order</button>
  `;

  const list = document.getElementById("order-list");
  for (const handle of list.querySelectorAll(".drag-handle")) {
    enableDrag(handle, list);
  }

  document.getElementById("reset-order").addEventListener("click", () => {
    setLeagueOrder([]);
    orderScreen(screen);
  });
}

// Save the order currently shown on screen
function saveOrder(list) {
  setLeagueOrder([...list.children].map(row => row.dataset.league));
}

// Let a row be dragged by its handle. As your finger passes the middle of
// the row above or below, the rows swap places.
function enableDrag(handle, list) {
  handle.addEventListener("pointerdown", event => {
    event.preventDefault();
    const row = handle.closest("li");
    row.classList.add("dragging");
    // Keep getting moves even when the finger slides off the handle
    try { handle.setPointerCapture(event.pointerId); } catch { /* not supported: fine */ }

    const move = moveEvent => {
      const y = moveEvent.clientY;
      const above = row.previousElementSibling;
      const below = row.nextElementSibling;
      if (above && y < middle(above)) list.insertBefore(row, above);
      else if (below && y > middle(below)) list.insertBefore(below, row);
    };

    const finish = () => {
      row.classList.remove("dragging");
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", finish);
      handle.removeEventListener("pointercancel", finish);
      saveOrder(list);
    };

    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", finish);
    handle.addEventListener("pointercancel", finish);
  });
}

// The vertical middle of a row on screen
function middle(element) {
  const box = element.getBoundingClientRect();
  return box.top + box.height / 2;
}
