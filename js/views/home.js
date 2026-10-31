// home.js — the "Dashboard" screen.
// Only games involving your favorite teams, in three sections:
//   Live     — being played right now
//   Upcoming — each team's NEXT game only, if it's within the next 10 days,
//              soonest first
//   Results  — finished in the last 7 days, newest first

import { getFavorites } from "../store.js";
import { getLeague } from "../data/leagues.js";
import { fetchTeamGames } from "../data/espn.js";
import { gameCard } from "./scores.js";
import { markUpdated, stillOn, isRefreshing } from "../ui.js";

const RESULT_DAYS = 7;     // how far back Results goes
const UPCOMING_DAYS = 10;  // how far ahead to look for each team's next game
const DAY_MS = 24 * 60 * 60 * 1000;

// The last Dashboard drawn, so coming back to it shows instantly while
// fresh scores load in the background.
let lastDrawn = "";

export async function homeScreen(screen) {
  const favorites = getFavorites();

  // First launch: nothing picked yet, so point the way to the picker
  if (favorites.length === 0) {
    lastDrawn = "";
    screen.innerHTML = `
      <div class="card empty">
        <p><strong>No favorite teams yet</strong></p>
        <p class="dim">Pick your teams to see their live games, upcoming games and recent results here.</p>
        <a class="button" href="#favorites">Add Favorite Teams</a>
      </div>
    `;
    return;
  }

  // Show what we had last time (or "Loading") while new scores download.
  // When refreshing, leave the screen exactly as it is.
  if (!isRefreshing()) {
    screen.innerHTML = lastDrawn || `
      ${toolbar()}
      <div class="card dim">Loading your games…</div>`;
  }

  // Get every favorite team's season of games at the same time
  const here = location.hash;
  const results = await Promise.allSettled(
    favorites.map(team => fetchTeamGames(getLeague(team.league), team.id)));
  if (!stillOn(here)) return;   // you moved to another screen while waiting

  let html;
  try {
    html = dashboard(favorites, results);
  } catch (error) {
    // Something unexpected in ESPN's data: say so instead of hanging on "Loading"
    console.error(error);
    html = null;
  }
  // If every download failed (e.g. no signal), keep showing the old games
  if (html === null) {
    if (!lastDrawn) {
      screen.innerHTML = `${toolbar()}
        <div class="card dim">Couldn't load your games. Check your connection.</div>`;
    }
    return;
  }
  lastDrawn = html;
  screen.innerHTML = html;
  markUpdated();
}

function toolbar() {
  return `
    <div class="toolbar">
      <span></span>
      <a class="button-link" href="#favorites">Edit Teams</a>
    </div>`;
}

// Build the three sections from every team's games.
// Returns null if nothing could be downloaded at all.
function dashboard(favorites, results) {
  const now = Date.now();
  const isFav = (leagueId, team) =>
    favorites.some(f => f.league === leagueId && f.id === team.id);

  // Sort each team's games into the three sections. Games are stored by id,
  // so when two of your teams play each other the game appears once.
  const live = new Map(), upcoming = new Map(), finished = new Map();
  const failed = [];
  results.forEach((result, i) => {
    const team = favorites[i];
    if (result.status === "rejected") { failed.push(team.name); return; }
    const league = getLeague(team.league);
    const key = game => `${team.league}-${game.id}`;
    const games = result.value.games;   // oldest first

    for (const game of games) {
      if (game.state === "in") live.set(key(game), { league, game });
      if (game.state === "post" && game.date.getTime() >= now - RESULT_DAYS * DAY_MS) {
        finished.set(key(game), { league, game });
      }
    }

    // Only this team's next game, and only if it's within 10 days
    const next = games.find(game => game.state === "pre");
    if (next && next.date.getTime() <= now + UPCOMING_DAYS * DAY_MS) {
      upcoming.set(key(next), { league, game: next });
    }
  });
  if (failed.length === favorites.length) return null;

  const byDate = map => [...map.values()].sort((a, b) => a.game.date - b.game.date);
  const liveList = byDate(live);
  const upcomingList = byDate(upcoming);
  const finishedList = byDate(finished).reverse();   // newest first

  const cards = list => `<ul class="list">${list.map(({ league, game }) =>
    gameCard(league, game, isFav, { showLeague: true, showDate: true })).join("")}</ul>`;

  const section = (title, list, emptyText, first = false) => `
    <div class="section ${first ? "first" : ""}">
      <h2 class="section-title">${title}</h2>
      ${list.length ? cards(list) : `<div class="card dim small">${emptyText}</div>`}
    </div>`;

  // Live only appears while something is on
  return `
    ${toolbar()}
    ${liveList.length ? section("Live", liveList, "", true) : ""}
    ${section("Upcoming", upcomingList, "None of your teams play in the next 10 days.", !liveList.length)}
    ${section("Results", finishedList, "No results in the last 7 days.")}
    ${failed.length
      ? `<p class="dim note">Couldn't load ${failed.join(", ")}. Pull down to try again.</p>`
      : ""}
  `;
}
