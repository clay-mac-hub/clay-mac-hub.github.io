// player.js — one player's page (e.g. "#player/nba/3032977/401909881").
// Profile, their stats in the game you came from (if any), and their
// stats for this season.

import { getLeague } from "../data/leagues.js";
import { fetchPlayer, fetchGame } from "../data/espn.js";
import { headshot } from "./game.js";
import { setTitle, backButton, stillOn, isRefreshing, markUpdated } from "../ui.js";

export async function playerScreen(screen, leagueId, athleteId, eventId) {
  const league = getLeague(leagueId);
  if (!league || !athleteId) { location.hash = "#scores"; return; }

  const here = location.hash;
  const refreshing = isRefreshing();
  if (!refreshing) {
    setTitle("Player");
    screen.innerHTML = `
      <div class="toolbar">${backButton("Back")}<span></span></div>
      <div class="card dim">Loading player…</div>`;
  }

  // The profile is required; the game is optional extra
  let player, details = null;
  try {
    [player, details] = await Promise.all([
      fetchPlayer(league, athleteId),
      eventId ? fetchGame(league, eventId).catch(() => null) : null,
    ]);
  } catch {
    if (stillOn(here) && !refreshing) {
      screen.innerHTML = `
        <div class="toolbar">${backButton("Back")}<span></span></div>
        <div class="card dim">Couldn't load this player. Check your connection.</div>`;
    }
    return;
  }
  if (!stillOn(here)) return;

  setTitle(player.name);
  screen.innerHTML = `
    <div class="toolbar">${backButton("Back")}<span></span></div>
    ${profile(league, player)}
    ${details ? thisGame(details, athleteId) : ""}
    ${thisSeason(player)}
  `;
  markUpdated();
}

function profile(league, player) {
  const facts = [
    player.position,
    player.jersey && `#${player.jersey}`,
    player.height,
    player.age && `Age ${player.age}`,
  ].filter(Boolean).join(" · ");

  return `
    <div class="card team-head player-profile">
      ${headshot(player.headshot, player.name, "big")}
      <div>
        <div class="team-name">${player.name}</div>
        ${facts ? `<div class="dim small">${facts}</div>` : ""}
        ${player.team ? `<a class="button-link small" href="#team/${league.id}/${player.team.id}">${player.team.name} ›</a>` : ""}
      </div>
    </div>`;
}

// The player's line(s) from the game box score. A football player can
// appear in several groups (e.g. Rushing and Receiving).
function thisGame({ game, teams }, athleteId) {
  const lines = [];
  for (const side of teams) {
    for (const group of side.groups) {
      const p = group.players.find(x => x.id === athleteId);
      if (p) {
        // Groups like "Passing" are useful titles; "Players" or a soccer
        // lineup name ("Starting XI") isn't, so those just say "Game Stats"
        const generic = ["Players", "Starting XI", "Substitutes"].includes(group.name);
        const title = generic ? "Game Stats" : group.name;
        lines.push(statGrid(title, group.labels, group.descriptions, p.stats));
      }
    }
  }
  const title = `This Game <span class="dim small">${game.away.abbr} @ ${game.home.abbr}${
    game.state === "in" ? " · live" : ""}</span>`;
  // Live game: a LIVE badge keeps the page auto-refreshing
  const live = game.state === "in" ? `<span class="badge live">LIVE</span>` : "";

  return `
    <div class="section">
      <h2 class="section-title">${title} ${live}</h2>
      ${lines.join("") || `<div class="card dim small">No stats for this player in this game.</div>`}
    </div>`;
}

function thisSeason(player) {
  const season = player.season;
  if (!season || !season.splits.length) {
    return `
      <div class="section">
        <h2 class="section-title">This Season</h2>
        <div class="card dim small">No season stats yet.</div>
      </div>`;
  }
  return `
    <div class="section">
      <h2 class="section-title">This Season</h2>
      ${season.splits.map(split =>
        statGrid(split.name, season.labels, season.descriptions, split.stats)).join("")}
    </div>`;
}

// A card of stat boxes: big number, with the stat's full name underneath
// (e.g. "Field Goal Percentage" rather than "FG%"), when ESPN gives one
function statGrid(title, labels, descriptions, values) {
  const boxes = labels.map((label, i) => `
    <div class="stat-box">
      <div class="stat-value">${values[i] ?? "–"}</div>
      <div class="dim stat-label">${descriptions[i] || label}</div>
    </div>`).join("");
  return `
    <div class="card stat-card">
      <div class="stat-card-title">${title}</div>
      <div class="stat-grid">${boxes}</div>
    </div>`;
}
