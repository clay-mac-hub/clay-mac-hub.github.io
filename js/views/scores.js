// scores.js — the "Scores" screen.
// A row of dates across the top; below it, every game on the chosen day.
// Your favorite teams' games come first, then each league's games.

import { LEAGUES } from "../data/leagues.js";
import { fetchScoreboard, smallLogo } from "../data/espn.js";
import { getFavorites } from "../store.js";
import { stillOn, isRefreshing, markUpdated, wireShowAll, rememberExpanded } from "../ui.js";

// How many days before/after today the date row offers
const DAYS_BACK = 7;
const DAYS_AHEAD = 7;

// The chosen day, remembered while the app is open (starts on today)
let selected = startOfDay(new Date());

// Leagues that have games (golf tours get their own leaderboards in Step 8)
const GAME_LEAGUES = LEAGUES.filter(league => league.hasTeams);

export async function scoresScreen(screen) {
  const here = location.hash;

  // When refreshing, keep the current games on screen until new ones arrive.
  // Otherwise draw the date row and a "Loading" note.
  const keepShowing = isRefreshing() && document.getElementById("games");
  if (!keepShowing) {
    screen.innerHTML = `
      <div class="chips dates">${dateChips()}</div>
      <div id="games"><div class="card dim">Loading games…</div></div>
    `;

    // Slide the date row so the chosen day is visible
    screen.querySelector(".chip.selected")
      .scrollIntoView({ inline: "center", block: "nearest" });

    // Tapping a date: remember it and redraw
    for (const chip of screen.querySelectorAll(".chip")) {
      chip.addEventListener("click", () => {
        selected = new Date(Number(chip.dataset.day));
        scoresScreen(screen);
      });
    }
  }

  // Download every league's games for that day at the same time.
  // A league that fails just shows a short note instead of its games.
  const day = selected;
  const results = await Promise.allSettled(
    GAME_LEAGUES.map(league => fetchScoreboard(league, day)));
  if (!stillOn(here) || day !== selected) return;   // moved on while waiting

  const gamesArea = document.getElementById("games");
  const reopenLists = rememberExpanded(gamesArea);
  gamesArea.innerHTML = gamesList(results);
  reopenLists();
  wireShowAll(gamesArea);   // "Show all" reveals hidden college games
  markUpdated();
}

// ---------- Date row ----------

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function dateChips() {
  const today = startOfDay(new Date());
  const chips = [];
  for (let offset = -DAYS_BACK; offset <= DAYS_AHEAD; offset++) {
    const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
    const label =
      offset === 0 ? "Today" :
      offset === -1 ? "Yesterday" :
      offset === 1 ? "Tomorrow" :
      day.toLocaleDateString(undefined, { weekday: "short" });
    const date = day.toLocaleDateString(undefined, { month: "numeric", day: "numeric" });
    chips.push(`
      <button class="chip date-chip ${day.getTime() === selected.getTime() ? "selected" : ""}"
              data-day="${day.getTime()}">
        <span>${label}</span><span class="small">${date}</span>
      </button>`);
  }
  return chips.join("");
}

// ---------- Games ----------

function gamesList(results) {
  const favorites = getFavorites();
  const isFav = (leagueId, team) =>
    favorites.some(f => f.league === leagueId && f.id === team.id);

  const myGames = [];   // games with one of your teams in them
  const sections = [];  // one per league

  results.forEach((result, i) => {
    const league = GAME_LEAGUES[i];

    if (result.status === "rejected") {
      sections.push(`
        <div class="section">
          <h2 class="section-title">${league.name}</h2>
          <div class="card dim small">Couldn't load ${league.name} games.</div>
        </div>`);
      return;
    }

    const games = result.value.sort((a, b) => a.date - b.date);
    const rest = [];
    for (const game of games) {
      const fav = isFav(league.id, game.home) || isFav(league.id, game.away);
      if (fav) myGames.push({ league, game });
      else rest.push(game);
    }
    if (rest.length === 0) return;

    // College: Top 25 games first; the rest hidden behind "Show all"
    let shown = rest, hidden = [];
    if (league.topGamesOnly) {
      shown = rest.filter(g => g.home.rank || g.away.rank);
      hidden = rest.filter(g => !g.home.rank && !g.away.rank);
    }

    const rows = [
      ...shown.map(g => gameCard(league, g, isFav)),
      ...hidden.map(g => gameCard(league, g, isFav, "extra")),
    ].join("");

    sections.push(`
      <div class="section">
        <h2 class="section-title">${league.name}
          ${league.topGamesOnly && shown.length ? `<span class="dim small">Top 25</span>` : ""}</h2>
        <ul class="list">${rows}</ul>
        ${hidden.length
          ? `<button class="button-link show-all">${shown.length ? "Show all" : "Show"} ${rest.length} games</button>`
          : ""}
      </div>`);
  });

  // Your teams' games go first, in time order
  myGames.sort((a, b) => a.game.date - b.game.date);
  const mySection = myGames.length ? `
    <div class="section first">
      <h2 class="section-title">My Teams</h2>
      <ul class="list">
        ${myGames.map(({ league, game }) => gameCard(league, game, isFav, "", true)).join("")}
      </ul>
    </div>` : "";

  if (!mySection && sections.length === 0) {
    return `<div class="card empty"><p class="dim">No games on this day.</p></div>`;
  }
  return mySection + sections.join("");
}

// One game: away team above home team, status on the right.
// showLeague adds a small league label (used in "My Teams").
function gameCard(league, game, isFav, extraClass = "", showLeague = false) {
  const finished = game.state === "post";

  const teamLine = team => {
    const other = team === game.home ? game.away : game.home;
    const lost = finished && other.winner;
    return `
      <div class="team-line ${lost ? "lost" : ""} ${isFav(league.id, team) ? "fav" : ""}"
           onclick="location.hash = '#team/${league.id}/${team.id}'">
        <img class="logo tiny" src="${smallLogo(team.logo, 48)}" alt="" loading="lazy">
        ${team.rank ? `<span class="rank">${team.rank}</span>` : ""}
        <span class="name">${team.shortName}</span>
        ${game.state !== "pre" && team.score != null ? `<span class="score">${team.score}</span>` : ""}
      </div>`;
  };

  let status;
  if (game.state === "in") {
    status = `<span class="badge live">LIVE</span><span class="small">${game.detail}</span>`;
  } else if (game.state === "pre") {
    const time = game.timeKnown
      ? game.date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
      : "TBD";
    status = `<span>${time}</span><span class="dim small">${game.broadcast}</span>`;
  } else {
    status = `<span class="dim">${game.detail}</span>`;
  }

  // data-starts tells auto-refresh when a not-yet-started game begins
  return `
    <li class="score-card ${extraClass}"
        ${game.state === "pre" ? `data-starts="${game.date.getTime()}"` : ""}>
      <div class="teams">
        ${teamLine(game.away)}
        ${teamLine(game.home)}
      </div>
      <div class="status">
        ${showLeague ? `<span class="dim small">${league.name}</span>` : ""}
        ${status}
      </div>
    </li>`;
}
