// home.js — the "My Teams" screen.
// One card per favorite team: record, live score, last result and next game.

import { getFavorites } from "../store.js";
import { getLeague, orderedLeagues } from "../data/leagues.js";
import { smallLogo, fetchTeamSummary } from "../data/espn.js";
import { gameTime, fromTeamView } from "../format.js";
import { markUpdated, stillOn } from "../ui.js";

// The last info downloaded for each team, so coming back to Home shows it
// instantly while fresh info loads in the background.
const saved = new Map();

export function homeScreen(screen) {
  // Your teams, grouped by league in the order you've arranged the leagues.
  // (Within a league, teams stay in the order you added them.)
  const order = orderedLeagues().map(league => league.id);
  const favorites = getFavorites()
    .sort((a, b) => order.indexOf(a.league) - order.indexOf(b.league));

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

  // Draw every card straight away (with whatever we already know)...
  screen.innerHTML = `
    <div class="toolbar">
      <span></span>
      <a class="button-link" href="#favorites">Edit</a>
    </div>
    <div class="stack">
      ${favorites.map(team => `<div class="card team-card tappable" id="card-${team.league}-${team.id}"
            style="--team-color: ${team.color}"
            onclick="location.hash = '#team/${team.league}/${team.id}'">${cardContent(team)}</div>`).join("")}
    </div>
  `;

  // ...then fetch fresh info for each team and redraw its card when it arrives
  const here = location.hash;
  const loads = favorites.map(team => {
    const key = `${team.league}-${team.id}`;
    return fetchTeamSummary(getLeague(team.league), team.id)
      .then(summary => saved.set(key, summary))
      .catch(() => saved.set(key, saved.get(key) ?? "error"))
      .finally(() => {
        const card = document.getElementById(`card-${key}`);
        if (card) card.innerHTML = cardContent(team);   // only if still on screen
      });
  });

  // Once every card has its info, show "Updated 8:02 PM"
  return Promise.allSettled(loads).then(() => {
    if (stillOn(here)) markUpdated();
  });
}

// The inside of one team's card
function cardContent(team) {
  const summary = saved.get(`${team.league}-${team.id}`);
  const leagueName = getLeague(team.league)?.name ?? "";

  // Top line under the name: "2-2 · 3rd in NFC North" (or the league name)
  const subtitle = summary && summary !== "error"
    ? [summary.record, summary.standing].filter(Boolean).join(" · ") || leagueName
    : leagueName;

  let games;
  if (!summary) {
    games = `<div class="game-row dim">Loading…</div>`;
  } else if (summary === "error") {
    games = `<div class="game-row dim">Couldn't load scores. Check your connection.</div>`;
  } else {
    games = [
      summary.live && liveRow(summary.live, team.id),
      summary.last && lastRow(summary.last, team.id),
      summary.next && nextRow(summary.next, team.id),
    ].filter(Boolean).join("") || `<div class="game-row dim">No games scheduled</div>`;
  }

  return `
    <div class="team-head">
      <img class="logo big" src="${smallLogo(team.logo, 132)}" alt="">
      <div>
        <div class="team-name">${team.name}</div>
        <div class="dim small">${subtitle}</div>
      </div>
    </div>
    <div class="games">${games}</div>
  `;
}

// "LIVE  21–17 @ ARI   Q3 5:12"
function liveRow(game, teamId) {
  const { prefix, us, opponent } = fromTeamView(game, teamId);
  return `
    <div class="game-row">
      <span class="badge live">LIVE</span>
      <span class="score">${us.score ?? 0}–${opponent.score ?? 0}</span>
      <span>${prefix} ${opponent.abbr}</span>
      <span class="dim right">${game.detail}</span>
    </div>`;
}

// "LAST  W 31–30 vs NO   Final/OT"
function lastRow(game, teamId) {
  const { prefix, us, opponent } = fromTeamView(game, teamId);

  // No scores means the game didn't happen (e.g. "Postponed")
  if (us.score == null || opponent.score == null) {
    return `
      <div class="game-row">
        <span class="badge">LAST</span>
        <span>${prefix} ${opponent.abbr}</span>
        <span class="dim right">${game.detail}</span>
      </div>`;
  }

  // W = win, L = loss, D = draw/tie
  const result = us.winner ? "W" : opponent.winner ? "L" : "D";
  return `
    <div class="game-row">
      <span class="badge">LAST</span>
      <span class="result result-${result}">${result}</span>
      <span class="score">${us.score}–${opponent.score}</span>
      <span>${prefix} ${opponent.abbr}</span>
      <span class="dim right">${game.detail}</span>
    </div>`;
}

// "NEXT  @ ARI   Sun, Oct 11 · 4:25 PM · Fox"
function nextRow(game, teamId) {
  const { prefix, opponent } = fromTeamView(game, teamId);
  const when = [gameTime(game), game.broadcast].filter(Boolean).join(" · ");
  // data-starts tells auto-refresh when this game begins
  return `
    <div class="game-row" data-starts="${game.date.getTime()}">
      <span class="badge">NEXT</span>
      <span>${prefix} ${opponent.abbr}</span>
      <span class="dim right">${when}</span>
    </div>`;
}
