// leagues.js — the "Leagues" screen.
// A list of leagues in your chosen order; tap one to see its standings.

import { orderedLeagues } from "../data/leagues.js";

export function leaguesScreen(screen) {
  // Turn each league into one tappable row
  const rows = orderedLeagues().map(league => `
    <li><a class="row-link" href="#league/${league.id}">${league.name}
      <span class="dim right">›</span></a></li>
  `).join("");

  screen.innerHTML = `
    <div class="toolbar">
      <span></span>
      <a class="button-link" href="#order">Reorder</a>
    </div>
    <ul class="list">${rows}</ul>`;
}
