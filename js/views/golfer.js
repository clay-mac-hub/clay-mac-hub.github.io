// golfer.js — one golfer's scorecards (e.g. "#golfer/pga/10030").
// Their position and total, then a hole-by-hole card for each round,
// newest round first.

import { getLeague } from "../data/leagues.js";
import { fetchLeaderboard, fetchScorecard } from "../data/espn.js";
import { setTitle, backButton, stillOn, isRefreshing, markUpdated } from "../ui.js";

export async function golferScreen(screen, leagueId, playerId) {
  const league = getLeague(leagueId);
  if (!league || !playerId) { location.hash = "#leagues"; return; }

  const here = location.hash;
  const refreshing = isRefreshing();
  if (!refreshing) {
    setTitle("");
    screen.innerHTML = `
      <div class="toolbar">${backButton("Leaderboard")}<span></span></div>
      <div class="card dim">Loading scorecard…</div>`;
  }

  let board, card;
  try {
    // The leaderboard gives the tournament and the golfer's live position;
    // the scorecard gives every hole of every round.
    board = await fetchLeaderboard(league);
    card = await fetchScorecard(board.tour, board.id, playerId);
  } catch {
    if (stillOn(here) && !refreshing) {
      screen.innerHTML = `
        <div class="toolbar">${backButton("Leaderboard")}<span></span></div>
        <div class="card dim">Couldn't load this scorecard. Check your connection.</div>`;
    }
    return;
  }
  if (!stillOn(here)) return;

  const player = board.players.find(p => p.id === playerId);
  setTitle(card.name || player?.name || "Scorecard");

  // Newest round first; skip rounds that are too far off to have a tee time
  const rounds = card.rounds
    .filter(r => r.holes.length || r.teeTime)
    .reverse();

  screen.innerHTML = `
    <div class="toolbar">${backButton("Leaderboard")}<span></span></div>
    ${summaryCard(board, player, card)}
    ${rounds.map(roundCard).join("") ||
      `<div class="card dim small">No rounds played yet.</div>`}
    ${legend()}
  `;
  markUpdated();
}

// Top card: photo, position, total, today, holes played
function summaryCard(board, player, card) {
  const status = player?.state === "in"
    ? `<span class="badge live">LIVE</span>`   // also tells auto-refresh to keep updating
    : "";
  const facts = player ? `
    <div class="golfer-facts">
      <div><div class="dim small">POS</div><div class="big">${player.pos || "–"}</div></div>
      <div><div class="dim small">TOTAL</div>
        <div class="big ${player.toPar.startsWith("-") ? "under-par" : ""}">${player.toPar || "–"}</div></div>
      <div><div class="dim small">TODAY</div><div class="big">${player.today || "–"}</div></div>
      <div><div class="dim small">THRU</div><div class="big small-text">${player.thru || "–"}</div></div>
    </div>` : "";

  return `
    <div class="card golfer-card">
      <div class="team-head">
        ${card.headshot ? `<img class="headshot" src="${card.headshot}" alt="">` : ""}
        <div>
          <div class="team-name">${board.name}</div>
          <div class="dim small">${[card.age && `Age ${card.age}`, board.detail].filter(Boolean).join(" · ")}</div>
        </div>
        ${status}
      </div>
      ${facts}
    </div>`;
}

// One round: heading, front nine, back nine, and a stats line
function roundCard(round) {
  const played = round.holes.filter(h => h.strokes != null);
  const under = round.toPar.startsWith("-");

  // "67 (-4)" for a finished round; the score so far for one in progress
  const score = played.length
    ? `<span class="${under ? "under-par" : ""}"><strong>${round.toPar}</strong></span>
       ${played.length === 18 && round.strokes ? `<span class="dim">(${round.strokes})</span>` : `<span class="dim">thru ${played.length}</span>`}`
    : "";

  const tee = round.teeTime
    ? `Tee time ${round.teeTime.toLocaleString(undefined,
        { weekday: "short", hour: "numeric", minute: "2-digit" })}` +
      (round.startTee === 10 ? " · started on 10" : "")
    : "";

  const s = round.stats;
  const statsLine = [
    s.eagles && `${s.eagles} eagle${s.eagles > 1 ? "s" : ""}`,
    s.birdies && `${s.birdies} birdie${s.birdies > 1 ? "s" : ""}`,
    s.pars && `${s.pars} par${s.pars > 1 ? "s" : ""}`,
    s.bogeys && `${s.bogeys} bogey${s.bogeys > 1 ? "s" : ""}`,
    s.doubleBogeys && `${s.doubleBogeys} double${s.doubleBogeys > 1 ? "s" : ""}`,
  ].filter(Boolean).join(" · ");

  return `
    <div class="section">
      <div class="round-head">
        <h2 class="section-title">Round ${round.number}</h2>
        <span class="round-score">${score}</span>
      </div>
      <div class="card scorecard">
        ${tee ? `<div class="dim small">${tee}</div>` : ""}
        ${round.holes.length ? nineHoles(round.holes, 1, "OUT") + nineHoles(round.holes, 10, "IN") : ""}
        ${statsLine ? `<div class="dim small stats-line">${statsLine}</div>` : ""}
      </div>
    </div>`;
}

// A table for holes first..first+8, with the total ("OUT" or "IN") at the end
function nineHoles(holes, first, totalLabel) {
  const nine = [];
  for (let n = first; n < first + 9; n++) {
    nine.push(holes.find(h => h.hole === n) ?? { hole: n, par: null, strokes: null });
  }
  const sum = key => {
    const values = nine.map(h => h[key]).filter(v => v != null);
    return values.length ? values.reduce((a, b) => a + b, 0) : "";
  };

  return `
    <table class="nine">
      <tr class="hole-row"><th>Hole</th>${nine.map(h => `<td>${h.hole}</td>`).join("")}<td>${totalLabel}</td></tr>
      <tr class="par-row"><th>Par</th>${nine.map(h => `<td>${h.par ?? ""}</td>`).join("")}<td>${sum("par")}</td></tr>
      <tr class="score-row"><th>Score</th>${nine.map(h => `<td>${scoreMark(h)}</td>`).join("")}<td><strong>${sum("strokes")}</strong></td></tr>
    </table>`;
}

// A hole's score, marked the way TV scorecards do:
// circle = birdie, double circle = eagle, square = bogey, double square = double bogey or worse
function scoreMark(hole) {
  if (hole.strokes == null) return "";
  if (hole.par == null) return `${hole.strokes}`;
  const diff = hole.strokes - hole.par;
  const kind =
    diff <= -2 ? "eagle" :
    diff === -1 ? "birdie" :
    diff === 0 ? "par" :
    diff === 1 ? "bogey" : "double";
  return `<span class="mark ${kind}">${hole.strokes}</span>`;
}

function legend() {
  return `
    <div class="legend dim small">
      <span><span class="mark eagle">3</span> Eagle</span>
      <span><span class="mark birdie">3</span> Birdie</span>
      <span><span class="mark bogey">5</span> Bogey</span>
      <span><span class="mark double">6</span> Double+</span>
    </div>`;
}
