// leagues.js — the "Leagues" screen.
// Later: tap a league to see its standings and teams.

import { LEAGUES } from "../data/leagues.js";

export function leaguesScreen(screen) {
  // Turn each league name into one row of the list
  const rows = LEAGUES.map(league => `<li>${league.name}</li>`).join("");
  screen.innerHTML = `<ul class="list">${rows}</ul>`;
}
