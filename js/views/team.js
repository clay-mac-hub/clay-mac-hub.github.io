// team.js — one team's page (e.g. "#team/nfl/8").
// Record, a favorite star, any live game, upcoming games and past results.

import { getLeague } from "../data/leagues.js";
import { fetchTeamGames, smallLogo } from "../data/espn.js";
import { isFavorite, toggleFavorite } from "../store.js";
import { fromTeamView } from "../format.js";
import { setTitle, backButton, stillOn, isRefreshing, markUpdated,
         wireShowAll, rememberExpanded } from "../ui.js";

// How many games to show in each list before "Show all"
const SHORT_LIST = 5;

export async function teamScreen(screen, leagueId, teamId) {
  const league = getLeague(leagueId);
  if (!league || !teamId) { location.hash = "#leagues"; return; }

  const here = location.hash;
  // When refreshing, keep the old info showing until the new info arrives
  const refreshing = isRefreshing();
  if (!refreshing) {
    setTitle("");
    screen.innerHTML = `
      <div class="toolbar">${backButton("Back")}<span></span></div>
      <div class="card dim">Loading team…</div>`;
  }

  let data;
  try {
    data = await fetchTeamGames(league, teamId);
  } catch {
    // A failed refresh keeps the old info; a failed first load shows a note
    if (stillOn(here) && !refreshing) {
      screen.innerHTML = `
        <div class="toolbar">${backButton("Back")}<span></span></div>
        <div class="card dim">Couldn't load this team. Check your connection.</div>`;
    }
    return;
  }
  if (!stillOn(here)) return;

  const { team, games } = data;
  setTitle(team.name);

  const live = games.filter(g => g.state === "in");
  const upcoming = games.filter(g => g.state === "pre");
  const results = games.filter(g => g.state === "post").reverse();   // newest first

  const subtitle = [team.record, team.standing].filter(Boolean).join(" · ") || league.name;

  const reopenLists = rememberExpanded(screen);
  screen.innerHTML = `
    <div class="toolbar">
      ${backButton("Back")}
      <button class="button-link fav-toggle" id="fav-toggle"></button>
    </div>

    <div class="card team-card" style="--team-color: ${team.color}">
      <div class="team-head">
        <img class="logo huge" src="${smallLogo(team.logo, 180)}" alt="">
        <div>
          <div class="team-name">${league.name}</div>
          <div class="dim small">${subtitle}</div>
        </div>
      </div>
      <a class="standings-link" href="#league/${league.id}/${team.id}">
        ${league.name} Standings <span class="right">›</span></a>
    </div>

    ${live.length ? section("Live", live, league.id, team.id) : ""}
    ${section("Upcoming", upcoming, league.id, team.id, "No upcoming games scheduled")}
    ${section("Results", results, league.id, team.id, "No results yet this season")}
  `;

  // The ★ Favorite button at the top right
  const favButton = document.getElementById("fav-toggle");
  const showFav = () => {
    favButton.textContent = isFavorite(league.id, team.id) ? "★ Favorite" : "☆ Favorite";
  };
  showFav();
  favButton.addEventListener("click", () => { toggleFavorite(league.id, team); showFav(); });

  // "Show all" buttons reveal the rest of a long list
  reopenLists();
  wireShowAll(screen);
  markUpdated();
}

// A heading plus a list of games, with "Show all" if it's long
function section(title, games, leagueId, teamId, emptyText = "") {
  const rows = games.map((game, i) =>
    gameRow(game, leagueId, teamId, i >= SHORT_LIST ? "extra" : "")).join("");

  return `
    <div class="section">
      <h2 class="section-title">${title}</h2>
      <ul class="list">
        ${rows || `<li class="dim">${emptyText}</li>`}
      </ul>
      ${games.length > SHORT_LIST
        ? `<button class="button-link show-all">Show all ${games.length}</button>` : ""}
    </div>`;
}

// One game: date on the left, opponent in the middle, result/time on the right.
// Tapping it opens the opponent's team page.
function gameRow(game, leagueId, teamId, extraClass) {
  const { prefix, us, opponent } = fromTeamView(game, teamId);

  let right;
  if (game.state === "pre") {
    // "4:25 PM · Fox"  (the day is already on the left)
    const time = game.timeKnown
      ? game.date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
      : "TBD";
    right = `<span class="dim">${[time, game.broadcast].filter(Boolean).join(" · ")}</span>`;
  } else if (us.score == null || opponent.score == null) {
    right = `<span class="dim">${game.detail}</span>`;   // e.g. "Postponed"
  } else {
    const result = game.state === "in" ? "" :
      us.winner ? "W" : opponent.winner ? "L" : "D";
    right = `
      ${result ? `<span class="result result-${result}">${result}</span>` : ""}
      <span class="score">${us.score}–${opponent.score}</span>
      ${game.state === "in" ? `<span class="dim">${game.detail}</span>` : ""}`;
  }

  const day = game.date.toLocaleDateString(undefined,
    { weekday: "short", month: "numeric", day: "numeric" });

  return `
    <li class="game-line ${extraClass}"
        ${game.state === "pre" ? `data-starts="${game.date.getTime()}"` : ""}
        onclick="location.hash = '#team/${leagueId}/${opponent.id}'">
      <span class="dim date">${day}</span>
      <img class="logo tiny" src="${smallLogo(opponent.logo, 48)}" alt="" loading="lazy">
      <span class="opponent">${prefix} ${opponent.abbr}
        ${game.note ? `<span class="game-note">${game.note}</span>` : ""}</span>
      <span class="right">${right}</span>
    </li>`;
}
