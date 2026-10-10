// settings.js — the "Settings" screen.

import { getFavorites, autoRefreshOn, setAutoRefresh } from "../store.js";

export function settingsScreen(screen) {
  const count = getFavorites().length;

  screen.innerHTML = `
    <ul class="list">
      <li><a class="row-link" href="#favorites">Favorite teams
        <span class="dim right">${count} ›</span></a></li>
      <li>
        <label for="auto-refresh">Auto-refresh during games</label>
        <input type="checkbox" class="switch" id="auto-refresh" ${autoRefreshOn() ? "checked" : ""}>
      </li>
      <li>Data source <span class="dim right">ESPN</span></li>
    </ul>
    <p class="dim note">When on, scores update every 30 seconds while a game is live
    and the app is open. You can always pull down on any screen to refresh.</p>
  `;

  document.getElementById("auto-refresh").addEventListener("change", event => {
    setAutoRefresh(event.target.checked);
  });
}
