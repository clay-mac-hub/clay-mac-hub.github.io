// settings.js — the "Settings" screen.
// Later: choose how often scores refresh.

import { getFavorites } from "../store.js";

export function settingsScreen(screen) {
  const count = getFavorites().length;

  screen.innerHTML = `
    <ul class="list">
      <li><a class="row-link" href="#favorites">Favorite teams
        <span class="dim right">${count} ›</span></a></li>
      <li>Auto-refresh</li>
      <li>Data source <span class="dim right">ESPN</span></li>
    </ul>
  `;
}
