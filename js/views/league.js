// league.js — one league's standings (e.g. "#league/nfl").
// One table per division/conference; tap a team to open its page.

import { getLeague } from "../data/leagues.js";
import { fetchStandings, smallLogo } from "../data/espn.js";
import { isFavorite } from "../store.js";
import { golfScreen } from "./golf.js";
import { setTitle, backButton, stillOn, isRefreshing, markUpdated } from "../ui.js";

export async function leagueScreen(screen, leagueId) {
  const league = getLeague(leagueId);
  if (!league) { location.hash = "#leagues"; return; }

  const here = location.hash;
  setTitle(league.name);

  // Golf tours have tournament leaderboards instead of standings
  if (!league.hasTeams) return golfScreen(screen, league);

  // When refreshing, keep the old standings showing until new ones arrive
  const refreshing = isRefreshing();
  if (!refreshing) {
    screen.innerHTML = `
      <div class="toolbar">${backButton("Leagues")}<span></span></div>
      <div class="card dim">Loading standings…</div>`;
  }

  let standings;
  try {
    standings = await fetchStandings(league);
  } catch {
    // A failed refresh keeps the old info; a failed first load shows a note
    if (stillOn(here) && !refreshing) {
      screen.innerHTML = `
        <div class="toolbar">${backButton("Leagues")}<span></span></div>
        <div class="card dim">Couldn't load standings. Check your connection.</div>`;
    }
    return;
  }
  if (!stillOn(here)) return;

  const tables = standings.groups.map(group => standingsTable(league, group)).join("");

  screen.innerHTML = `
    <div class="toolbar">
      ${backButton("Leagues")}
      <span class="dim small">${standings.season}</span>
    </div>
    <div class="stack">${tables}</div>`;
  markUpdated();
}

// One group (division/conference) as a table
function standingsTable(league, group) {
  const headings = league.columns.map(([heading]) => `<th>${heading}</th>`).join("");

  const rows = group.rows.map((row, index) => {
    const cells = league.columns
      .map(([, stat]) => `<td>${row.stats[stat] ?? "–"}</td>`).join("");
    const fav = isFavorite(league.id, row.team.id);
    return `
      <tr class="${fav ? "fav" : ""}"
          onclick="location.hash = '#team/${league.id}/${row.team.id}'">
        <td class="pos">${index + 1}</td>
        <td class="team-cell">
          <img class="logo tiny" src="${smallLogo(row.team.logo, 48)}" alt="" loading="lazy">
          <span>${row.team.name}</span>${fav ? ` <span class="fav-star">★</span>` : ""}
        </td>
        ${cells}
      </tr>`;
  }).join("");

  return `
    <div class="card standings">
      <table>
        <thead><tr><th></th><th class="group-name">${group.name}</th>${headings}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}
