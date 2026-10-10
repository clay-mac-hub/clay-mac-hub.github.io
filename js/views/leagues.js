// leagues.js — the "Leagues" screen.
// A list of leagues; tap one to see its standings.

import { LEAGUES } from "../data/leagues.js";

export function leaguesScreen(screen) {
  // Turn each league into one tappable row
  const rows = LEAGUES.map(league => `
    <li><a class="row-link" href="#league/${league.id}">${league.name}
      <span class="dim right">›</span></a></li>
  `).join("");
  screen.innerHTML = `<ul class="list">${rows}</ul>`;
}
