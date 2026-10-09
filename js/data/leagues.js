// leagues.js — the list of leagues and tours the app knows about.
// "path" is the part of ESPN's web address for that league.
// Golf tours have no teams, so they're marked hasTeams: false.

export const LEAGUES = [
  { id: "nfl",   name: "NFL",                path: "football/nfl",                       hasTeams: true },
  { id: "nba",   name: "NBA",                path: "basketball/nba",                     hasTeams: true },
  { id: "mlb",   name: "MLB",                path: "baseball/mlb",                       hasTeams: true },
  { id: "nhl",   name: "NHL",                path: "hockey/nhl",                         hasTeams: true },
  { id: "cfb",   name: "College Football",   path: "football/college-football",          hasTeams: true },
  { id: "cbb",   name: "College Basketball", path: "basketball/mens-college-basketball", hasTeams: true },
  { id: "epl",   name: "Premier League",     path: "soccer/eng.1",                       hasTeams: true },
  { id: "ucl",   name: "Champions League",   path: "soccer/uefa.champions",              hasTeams: true },
  { id: "pga",   name: "PGA Tour",           path: "golf/pga",                           hasTeams: false },
  { id: "lpga",  name: "LPGA Tour",          path: "golf/lpga",                          hasTeams: false },
];

// Look up one league by its id, e.g. getLeague("nfl")
export function getLeague(id) {
  return LEAGUES.find(league => league.id === id);
}
