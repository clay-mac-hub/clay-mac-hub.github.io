// game.js — one game's details (e.g. "#game/nba/401909881").
// Scoreboard, highlights, goals and cards (soccer), team stats side by side,
// and every player's stats with their photo. Tap a team or a player for more.

import { getLeague } from "../data/leagues.js";
import { fetchGame, smallLogo } from "../data/espn.js";
import { gameTime } from "../format.js";
import { setTitle, backButton, stillOn, isRefreshing, markUpdated,
         wireShowAll, rememberExpanded } from "../ui.js";

// How many team-stat rows show before "Show all"
const SHORT_LIST = 10;

export async function gameScreen(screen, leagueId, eventId) {
  const league = getLeague(leagueId);
  if (!league || !eventId) { location.hash = "#scores"; return; }

  const here = location.hash;
  const refreshing = isRefreshing();
  if (!refreshing) {
    setTitle("Game");
    screen.innerHTML = `
      <div class="toolbar">${backButton("Back")}<span></span></div>
      <div class="card dim">Loading game…</div>`;
  }

  let details;
  try {
    details = await fetchGame(league, eventId);
  } catch {
    // A failed refresh keeps the old info; a failed first load shows a note
    if (stillOn(here) && !refreshing) {
      screen.innerHTML = `
        <div class="toolbar">${backButton("Back")}<span></span></div>
        <div class="card dim">Couldn't load this game. Check your connection.</div>`;
    }
    return;
  }
  if (!stillOn(here)) return;

  const { game } = details;
  setTitle(`${game.away.abbr} @ ${game.home.abbr}`);

  // Keep playing videos playing through a refresh: only redraw the parts
  // below the highlights if they're already on screen.
  const videoArea = screen.querySelector("#highlights");
  const videoPlaying = [...(videoArea?.querySelectorAll("video") ?? [])].some(v => !v.paused);

  const reopenLists = rememberExpanded(screen);
  const rest = `
    ${goalsAndCards(details)}
    ${teamStats(details)}
    ${players(league, eventId, details)}`;

  if (refreshing && videoPlaying) {
    screen.querySelector("#scoreboard").outerHTML = scoreboard(league, game);
    screen.querySelector("#game-rest").innerHTML = rest;
  } else {
    screen.innerHTML = `
      <div class="toolbar">${backButton("Back")}<span></span></div>
      ${scoreboard(league, game)}
      <div id="highlights">${highlights(details.videos)}</div>
      <div id="game-rest">${rest}</div>`;
  }
  reopenLists();
  wireShowAll(screen);
  markUpdated();
}

// ---------- Scoreboard ----------

function scoreboard(league, game) {
  const side = team => {
    const other = team === game.home ? game.away : game.home;
    const lost = game.state === "post" && other.winner;
    return `
      <a class="sb-team ${lost ? "lost" : ""}" href="#team/${league.id}/${team.id}/stats">
        <img class="logo big" src="${smallLogo(team.logo, 132)}" alt="">
        <span class="sb-name">${team.rank ? `<span class="rank">${team.rank}</span> ` : ""}${team.shortName}</span>
        ${game.state !== "pre" && team.score != null ? `<span class="sb-score">${team.score}</span>` : ""}
      </a>`;
  };

  let status;
  if (game.state === "in") {
    status = `<span class="badge live">LIVE</span><span>${game.detail}</span>`;
  } else if (game.state === "pre") {
    status = `<span>${gameTime(game)}</span><span class="dim small">${game.broadcast}</span>`;
  } else {
    status = `<span class="dim">${game.detail}</span>`;
  }

  return `
    <div class="card scoreboard" id="scoreboard">
      ${game.note ? `<div class="game-note center">${game.note}</div>` : ""}
      <div class="sb-row">
        ${side(game.away)}
        <div class="sb-status">${status}</div>
        ${side(game.home)}
      </div>
      <div class="dim small center">${league.name} · tap a team for its season stats</div>
    </div>`;
}

// ---------- Highlights ----------

function highlights(videos) {
  if (!videos.length) return "";
  const minutes = seconds => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

  // preload="none": nothing downloads until you press play (saves data)
  const cards = videos.map((video, i) => `
    <div class="video-card ${i >= 3 ? "extra" : ""}">
      <video controls playsinline preload="none" poster="${video.thumb}">
        ${video.hls ? `<source src="${video.hls}" type="application/vnd.apple.mpegurl">` : ""}
        ${video.mp4 ? `<source src="${video.mp4}" type="video/mp4">` : ""}
      </video>
      <div class="video-title">${video.headline}
        ${video.duration ? `<span class="dim small">${minutes(video.duration)}</span>` : ""}</div>
    </div>`).join("");

  return `
    <div class="section">
      <h2 class="section-title">Highlights</h2>
      <div class="stack">${cards}</div>
      ${videos.length > 3 ? `<button class="button-link show-all">Show all ${videos.length} videos</button>` : ""}
    </div>`;
}

// ---------- Soccer: goals and cards ----------

function goalsAndCards({ events, game }) {
  if (!events.length) return "";
  const symbol = type =>
    type.includes("Yellow") ? `<span class="card-icon yellow"></span>` :
    type.includes("Red") ? `<span class="card-icon red"></span>` : "⚽";
  const abbr = teamId => teamId === game.home.id ? game.home.abbr : teamId === game.away.id ? game.away.abbr : "";

  const rows = events.map(e => `
    <li class="event-line">
      <span class="dim minute">${e.minute}</span>
      <span class="event-symbol">${symbol(e.type)}</span>
      <span>${e.player}${e.type.startsWith("Own") ? " (own goal)" : ""}${e.type.startsWith("Penalty") ? " (pen)" : ""}</span>
      <span class="dim right">${abbr(e.teamId)}</span>
    </li>`).join("");

  return `
    <div class="section">
      <h2 class="section-title">Goals and Cards</h2>
      <ul class="list">${rows}</ul>
    </div>`;
}

// ---------- Team stats ----------
// Before kickoff, ESPN fills this with a season comparison of the two
// teams (streak, points per game…), so it gets a different title then.

function teamStats({ teamStats: rows, game, hasStats }) {
  if (!rows.length) {
    const why = game.state === "pre"
      ? "Stats appear once the game starts."
      : hasStats ? "" : "ESPN doesn't keep stats for this sport.";
    return why ? `<div class="section"><div class="card dim small">${why}</div></div>` : "";
  }

  const lines = rows.map((row, i) => `
    <tr class="${i >= SHORT_LIST ? "extra" : ""}">
      <td>${row.away}</td><th>${row.label}</th><td>${row.home}</td>
    </tr>`).join("");

  return `
    <div class="section">
      <h2 class="section-title">${game.state === "pre" ? "Season Comparison" : "Team Stats"}</h2>
      <div class="card">
        <table class="compare">
          <thead><tr>
            <td><img class="logo tiny" src="${smallLogo(game.away.logo, 48)}" alt=""> ${game.away.abbr}</td>
            <th></th>
            <td>${game.home.abbr} <img class="logo tiny" src="${smallLogo(game.home.logo, 48)}" alt=""></td>
          </tr></thead>
          <tbody>${lines}</tbody>
        </table>
      </div>
      ${rows.length > SHORT_LIST ? `<button class="button-link show-all">Show all ${rows.length} stats</button>` : ""}
    </div>`;
}

// ---------- Players ----------

function players(league, eventId, { teams, game }) {
  if (!teams.length) return "";

  // Away team first, like the scoreboard
  const ordered = [...teams].sort((a, b) =>
    (a.team.id === game.home.id) - (b.team.id === game.home.id));

  return ordered.map(side => `
    <div class="section">
      <h2 class="section-title team-heading">
        <img class="logo tiny" src="${smallLogo(side.team.logo, 48)}" alt="">
        ${side.team.name}
        ${side.formation ? `<span class="dim small">${side.formation}</span>` : ""}
      </h2>
      ${side.groups.map(group => playerTable(league, eventId, group)).join("")}
    </div>`).join("");
}

// One group (e.g. "Passing") as a table. The name column stays put while
// the numbers scroll sideways if there are many of them.
function playerTable(league, eventId, group) {
  const heads = group.labels.map((label, i) =>
    `<th title="${group.descriptions[i] ?? ""}">${label}</th>`).join("");

  const rows = group.players.map(p => `
    <tr onclick="location.hash = '#player/${league.id}/${p.id}/${eventId}'">
      <td class="player-cell">
        ${headshot(p.headshot, p.name)}
        <span class="player-name">${p.shortName}
          <span class="dim small">${[p.position, p.jersey && `#${p.jersey}`].filter(Boolean).join(" ")}</span>
        </span>
      </td>
      ${p.stats.map(value => `<td>${value}</td>`).join("")}
    </tr>`).join("");

  return `
    <div class="card box-score">
      <div class="scroll-x">
        <table>
          <thead><tr><th class="player-cell group-label">${group.name}</th>${heads}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}

// A round player photo, or their initials if ESPN has no photo
export function headshot(url, name, size = "") {
  if (url) {
    return `<img class="face ${size}" src="${playerPhoto(url, size === "big" ? 240 : 96)}" alt="" loading="lazy">`;
  }
  const initials = name.split(" ").map(part => part[0]).slice(0, 2).join("");
  return `<span class="face initials ${size}">${initials}</span>`;
}

// ESPN's player photos are large and wider than tall. Ask ESPN's image
// service for a small copy, keeping the shape (the circle crops the sides).
function playerPhoto(url, width) {
  const path = url.replace("https://a.espncdn.com", "");
  if (path === url) return url;
  return `https://a.espncdn.com/combiner/i?img=${path}&w=${width}&h=${Math.round(width * 0.727)}&scale=crop`;
}
