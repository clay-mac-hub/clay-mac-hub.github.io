// golf.js — golf tournament leaderboards (PGA Tour, LPGA Tour).
// Used by the league screen ("#league/pga") and by the Scores tab.

import { fetchLeaderboard, smallLogo } from "../data/espn.js";
import { backButton, stillOn, isRefreshing, markUpdated,
         wireShowAll, rememberExpanded } from "../ui.js";

// How many players show before "Show all"
const SHORT_LIST = 25;

// The full leaderboard screen
export async function golfScreen(screen, league) {
  const here = location.hash;
  const refreshing = isRefreshing();

  if (!refreshing) {
    screen.innerHTML = `
      <div class="toolbar">${backButton("Leagues")}<span></span></div>
      <div class="card dim">Loading leaderboard…</div>`;
  }

  let board;
  try {
    board = await fetchLeaderboard(league);
  } catch {
    // A failed refresh keeps the old leaderboard; a failed first load shows a note
    if (stillOn(here) && !refreshing) {
      screen.innerHTML = `
        <div class="toolbar">${backButton("Leagues")}<span></span></div>
        <div class="card dim">Couldn't load the leaderboard. Check your connection.</div>`;
    }
    return;
  }
  if (!stillOn(here)) return;

  if (!board) {
    screen.innerHTML = `
      <div class="toolbar">${backButton("Leagues")}<span></span></div>
      <div class="card empty"><p class="dim">No tournament scheduled right now.</p></div>`;
    markUpdated();
    return;
  }

  const rows = board.players.map((p, i) => playerRow(p, i >= SHORT_LIST ? "extra" : "")).join("");
  let leaderboard;
  if (board.players.length) {
    leaderboard = `
      <div class="section">
        <div class="card standings golf">
          <table>
            <thead><tr><th>POS</th><th class="group-name">Player</th>
              <th>TOT</th><th>${board.state === "post" ? `R${board.round}` : "TODAY"}</th><th>THRU</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        ${board.players.length > SHORT_LIST
          ? `<button class="button-link show-all">Show all ${board.players.length} players</button>` : ""}
      </div>`;
  } else {
    leaderboard = `<div class="card dim small">The field and tee times haven't been posted yet.</div>`;
  }

  const reopenLists = rememberExpanded(screen);
  screen.innerHTML = `
    <div class="toolbar">${backButton("Leagues")}<span></span></div>
    ${tournamentHeader(board)}
    ${leaderboard}`;
  reopenLists();
  wireShowAll(screen);
  markUpdated();
}

// The card at the top: name, status, course, dates, purse, champion
function tournamentHeader(board) {
  const facts = [
    [board.course, board.city].filter(Boolean).join(" · "),
    [tournamentDates(board), board.purse].filter(Boolean).join(" · "),
    board.champion && `Defending champion: ${board.champion}`,
  ].filter(Boolean).map(text => `<div class="dim small">${text}</div>`).join("");

  return `
    <div class="card tournament">
      <div class="tournament-name">${board.name}</div>
      ${statusLine(board)}
      ${facts}
    </div>`;
}

// "LIVE Round 3 - In Progress", "Final", or "Starts Thu, Oct 15"
function statusLine(board) {
  if (board.state === "in") {
    return `<div class="game-row"><span class="badge live">LIVE</span><span>${board.detail}</span></div>`;
  }
  if (board.state === "post") {
    return `<div class="game-row"><span class="badge">FINAL</span><span class="dim">${board.detail}</span></div>`;
  }
  const day = board.start.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  return `<div class="game-row"><span class="badge">NEXT</span><span>Starts ${day}</span></div>`;
}

// "Oct 8 – 11" (or "Oct 29 – Nov 1")
export function tournamentDates(board) {
  const first = board.start.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const sameMonth = board.start.getMonth() === board.end.getMonth();
  const last = board.end.toLocaleDateString(undefined,
    sameMonth ? { day: "numeric" } : { month: "short", day: "numeric" });
  return `${first} – ${last}`;
}

// One player on the leaderboard
function playerRow(player, extraClass) {
  // Under par (e.g. "-9") shows in red, like on TV leaderboards
  const under = player.toPar.startsWith("-");
  return `
    <tr class="${extraClass}">
      <td class="pos">${player.pos}</td>
      <td class="team-cell">
        ${player.flag ? `<img class="flag" src="${smallLogo(player.flag, 40)}" alt="" loading="lazy">` : ""}
        <span>${player.shortName}</span>
      </td>
      <td class="${under ? "under-par" : ""}"><strong>${player.toPar}</strong></td>
      <td>${player.today || "–"}</td>
      <td class="dim">${player.thru}</td>
    </tr>`;
}

// ---------- Scores tab ----------

// Does this tournament run on the given day?
export function playsOn(board, day) {
  const startDay = new Date(board.start.getFullYear(), board.start.getMonth(), board.start.getDate());
  const endDay = new Date(board.end.getFullYear(), board.end.getMonth(), board.end.getDate());
  return day >= startDay && day <= endDay;
}

// A small card for the Scores tab: status and the top 5. Tap for the full board.
export function golfSummaryCard(league, board) {
  const top = board.players.slice(0, 5).map(p => `
    <div class="golf-line">
      <span class="dim pos">${p.pos}</span>
      <span class="name">${p.name}</span>
      <span class="${p.toPar.startsWith("-") ? "under-par" : ""}"><strong>${p.toPar}</strong></span>
      <span class="dim thru">${p.thru}</span>
    </div>`).join("");

  return `
    <div class="section">
      <h2 class="section-title">${league.name}</h2>
      <div class="card tournament tappable" onclick="location.hash = '#league/${league.id}'">
        <div class="tournament-name">${board.name}</div>
        ${statusLine(board)}
        ${top ? `<div class="golf-top">${top}</div>` : ""}
        <div class="button-link small see-all">Full leaderboard ›</div>
      </div>
    </div>`;
}
