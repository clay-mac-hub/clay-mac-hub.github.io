// settings.js — the "Settings" screen.
// Later: edit favorites, choose how often scores refresh.

export function settingsScreen(screen) {
  screen.innerHTML = `
    <ul class="list">
      <li>Favorite teams</li>
      <li>Auto-refresh</li>
      <li>Data source <span class="dim right">ESPN</span></li>
    </ul>
  `;
}
