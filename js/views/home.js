// home.js — the "My Teams" screen.
// Shows one card per favorite team. (Scores and next games come in Step 4.)

import { getFavorites } from "../store.js";
import { getLeague } from "../data/leagues.js";
import { smallLogo } from "../data/espn.js";

export function homeScreen(screen) {
  const favorites = getFavorites();

  // First launch: nothing picked yet, so point the way to the picker
  if (favorites.length === 0) {
    screen.innerHTML = `
      <div class="card empty">
        <p><strong>No favorite teams yet</strong></p>
        <p class="dim">Pick your teams to see their latest scores and next games here.</p>
        <a class="button" href="#favorites">Add Favorite Teams</a>
      </div>
    `;
    return;
  }

  // One card per team. The colored stripe on the left is the team's color.
  const cards = favorites.map(team => `
    <div class="card team-card" style="--team-color: ${team.color}">
      <img class="logo big" src="${smallLogo(team.logo, 132)}" alt="">
      <div>
        <div class="team-name">${team.name}</div>
        <div class="dim small">${getLeague(team.league)?.name ?? ""}</div>
      </div>
    </div>
  `).join("");

  screen.innerHTML = `
    <div class="toolbar">
      <span></span>
      <a class="button-link" href="#favorites">Edit</a>
    </div>
    <div class="stack">${cards}</div>
  `;
}
