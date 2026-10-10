// favorites.js — the "Favorite Teams" picker.
// Choose a league, (optionally) search, and tap the star next to a team.

import { orderedLeagues, getLeague } from "../data/leagues.js";
import { fetchTeams, smallLogo } from "../data/espn.js";
import { isFavorite, toggleFavorite, getFavorites } from "../store.js";

// Which league chip is selected. Kept here so it's remembered between visits.
// (null = start on the first league in your order)
let selectedLeagueId = null;

export function favoritesScreen(screen) {
  // Only leagues with teams can be picked from (not golf), in your order
  const teamLeagues = orderedLeagues().filter(league => league.hasTeams);
  selectedLeagueId ??= teamLeagues[0].id;

  // The league chips across the top, a search box, then the team list
  const chips = teamLeagues.map(league => `
    <button class="chip ${league.id === selectedLeagueId ? "selected" : ""}"
            data-league="${league.id}">${league.name}</button>
  `).join("");

  screen.innerHTML = `
    <div class="toolbar">
      <span class="dim" id="fav-count"></span>
      <a class="button-link" href="#home">Done</a>
    </div>
    <div class="chips">${chips}</div>
    <input class="search" id="search" type="search" placeholder="Search teams" autocomplete="off">
    <ul class="list" id="team-list"><li class="dim">Loading teams…</li></ul>
  `;

  updateCount();

  // Slide the chip row so the selected league is visible
  screen.querySelector(".chip.selected")
    .scrollIntoView({ inline: "center", block: "nearest" });

  // Tapping a league chip: highlight it and load that league's teams
  for (const chip of screen.querySelectorAll(".chip")) {
    chip.addEventListener("click", () => {
      selectedLeagueId = chip.dataset.league;
      favoritesScreen(screen);   // redraw this screen with the new league
    });
  }

  // Typing in the search box: hide teams whose names don't match
  document.getElementById("search").addEventListener("input", event => {
    const text = event.target.value.trim().toLowerCase();
    for (const row of screen.querySelectorAll("#team-list li[data-name]")) {
      row.hidden = !row.dataset.name.includes(text);
    }
  });

  loadTeams(screen);
}

async function loadTeams(screen) {
  const league = getLeague(selectedLeagueId);
  const list = document.getElementById("team-list");

  let teams;
  try {
    teams = await fetchTeams(league);
  } catch (error) {
    list.innerHTML = `<li class="dim">Couldn't load teams. Check your internet connection and try again.</li>`;
    return;
  }

  // If you switched league or left this screen while waiting, stop here
  if (league.id !== selectedLeagueId || !document.body.contains(list)) return;

  list.innerHTML = teams.map(team => `
    <li data-name="${team.name.toLowerCase()}">
      <img class="logo" src="${smallLogo(team.logo)}" alt="" loading="lazy">
      <span class="team-name">${team.name}</span>
      <button class="star ${isFavorite(league.id, team.id) ? "on" : ""}"
              data-team="${team.id}" aria-label="Favorite ${team.name}">★</button>
    </li>
  `).join("");

  // Tapping a star: add/remove the favorite and light the star up (or not)
  for (const star of list.querySelectorAll(".star")) {
    star.addEventListener("click", () => {
      const team = teams.find(t => t.id === star.dataset.team);
      const nowFavorite = toggleFavorite(league.id, team);
      star.classList.toggle("on", nowFavorite);
      updateCount();
    });
  }
}

function updateCount() {
  const count = getFavorites().length;
  document.getElementById("fav-count").textContent =
    count === 1 ? "1 team selected" : `${count} teams selected`;
}
