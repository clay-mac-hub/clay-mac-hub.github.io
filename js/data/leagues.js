// leagues.js — the list of leagues and tours the app knows about.
// "path" is the part of ESPN's web address for that league.
// Golf tours have no teams, so they're marked hasTeams: false.
//
// Standings settings:
//   divisions — true: show divisions (e.g. NFC North); false: conferences/whole league
//   sortBy    — how to order teams in each group:
//               "seed" (playoff position), "rank" (table position, soccer),
//               "conference" (conference win %, college)
//   columns   — [heading, ESPN stat name] pairs shown in the standings table
//
// Scores settings (college only):
//   scoreboardQuery — extra settings for ESPN's scoreboard: every top-division
//                     game, not just ESPN's default selection
//   topGamesOnly    — on the Scores screen, show Top 25 and favorite teams'
//                     games first and hide the rest behind "Show all"

import { getLeagueOrder } from "../store.js";

const RECORD =[["W", "wins"], ["L", "losses"], ["PCT", "winpercent"], ["GB", "gamesbehind"]];
const COLLEGE = [["CONF", "vsconf"], ["OVR", "total"]];
const SOCCER = [["GP", "gamesplayed"], ["W", "wins"], ["D", "ties"], ["L", "losses"],
                ["GD", "pointdifferential"], ["PTS", "points"]];

export const LEAGUES = [
  { id: "nfl", name: "NFL", path: "football/nfl", hasTeams: true,
    divisions: true, sortBy: "seed",
    columns: [["W", "wins"], ["L", "losses"], ["T", "ties"], ["PCT", "winpercent"]] },
  { id: "nba", name: "NBA", path: "basketball/nba", hasTeams: true,
    divisions: false, sortBy: "seed", columns: RECORD },
  { id: "mlb", name: "MLB", path: "baseball/mlb", hasTeams: true,
    divisions: true, sortBy: "seed", columns: RECORD },
  { id: "nhl", name: "NHL", path: "hockey/nhl", hasTeams: true,
    divisions: true, sortBy: "seed",
    columns: [["GP", "gamesplayed"], ["W", "wins"], ["L", "losses"], ["OTL", "otlosses"], ["PTS", "points"]] },
  { id: "cfb", name: "College Football", path: "football/college-football", hasTeams: true,
    divisions: false, sortBy: "conference", columns: COLLEGE,
    scoreboardQuery: "groups=80&limit=300", topGamesOnly: true },
  { id: "cbb", name: "College Basketball", path: "basketball/mens-college-basketball", hasTeams: true,
    divisions: false, sortBy: "conference", columns: COLLEGE,
    scoreboardQuery: "groups=50&limit=400", topGamesOnly: true },
  { id: "epl", name: "Premier League", path: "soccer/eng.1", hasTeams: true,
    divisions: false, sortBy: "rank", columns: SOCCER },
  { id: "ucl", name: "Champions League", path: "soccer/uefa.champions", hasTeams: true,
    divisions: false, sortBy: "rank", columns: SOCCER },
  { id: "pga", name: "PGA Tour", path: "golf/pga", hasTeams: false },
  { id: "lpga", name: "LPGA Tour", path: "golf/lpga", hasTeams: false },
];

// Look up one league by its id, e.g. getLeague("nfl")
export function getLeague(id) {
  return LEAGUES.find(league => league.id === id);
}

// All leagues, in the order you've arranged them (Settings → League Order).
// Any league missing from your saved order (e.g. one added to the app
// later) goes at the end, in the standard order.
export function orderedLeagues() {
  const saved = getLeagueOrder();
  const position = id => {
    const i = saved.indexOf(id);
    return i === -1 ? saved.length + LEAGUES.findIndex(l => l.id === id) : i;
  };
  return [...LEAGUES].sort((a, b) => position(a.id) - position(b.id));
}
