// espn.js — everything that talks to ESPN lives in this one file.
// If ESPN ever changes, this is the only file we should need to fix.

const BASE = "https://site.api.espn.com/apis/site/v2/sports";

// ESPN's logos are big (500×500). This asks ESPN's image service for a
// small copy instead (about 8× less to download), so lists load quickly.
export function smallLogo(url, size = 96) {
  if (!url) return "";
  const path = url.replace("https://a.espncdn.com", "");
  if (path === url) return url;   // not an ESPN image: leave it alone
  return `https://a.espncdn.com/combiner/i?img=${path}&w=${size}&h=${size}`;
}

// Download a web address and read the answer as data
async function getJSON(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`ESPN returned ${response.status}`);
  return response.json();
}

// ---------- Team lists ----------

// Team lists come from teams.json, a file saved inside the app by
// tools/update_teams.py. (ESPN doesn't let web pages download the full
// team list directly, and the lists rarely change anyway.)
let allTeams = null;

// Get every team in a league, sorted A–Z.
// Returns a list like: [{ id, name, abbr, color, logo }, ...]
export async function fetchTeams(league) {
  if (!allTeams) {
    const response = await fetch("js/data/teams.json");
    if (!response.ok) throw new Error(`teams.json returned ${response.status}`);
    allTeams = await response.json();
  }
  return allTeams[league.id] ?? [];
}

// ---------- Games ----------

// ESPN describes a game in a big, nested way. This turns one into our own
// simple shape:
// { id, date, timeKnown, state, detail, broadcast, home: {...}, away: {...} }
// state is "pre" (not started), "in" (live) or "post" (finished).
// detail is ESPN's short status text, e.g. "Final", "Q3 5:12", "Halftime".
function toGame(event) {
  const comp = event.competitions[0];
  const status = comp.status ?? event.status;
  const broadcast = comp.broadcasts?.[0];

  const side = homeAway => {
    const c = comp.competitors.find(x => x.homeAway === homeAway);
    // Scores come as "24" on scoreboards but { displayValue: "24" } on schedules
    const score = typeof c.score === "object" ? c.score?.displayValue : c.score;
    return {
      id: c.team.id,
      name: c.team.displayName,
      abbr: c.team.abbreviation,
      logo: c.team.logo ?? c.team.logos?.[0]?.href ?? "",
      score: score ?? null,
      winner: c.winner === true,
    };
  };

  return {
    id: event.id,
    date: new Date(event.date),
    timeKnown: event.timeValid !== false && comp.timeValid !== false,
    state: status.type.state,
    detail: status.type.shortDetail,
    broadcast: broadcast?.media?.shortName ?? broadcast?.names?.[0] ?? "",
    home: side("home"),
    away: side("away"),
  };
}

// Today's scoreboard for a league. Several favorite teams in the same league
// share one download, and it's reused for 30 seconds.
const scoreboardCache = {};

function fetchScoreboard(league) {
  const cached = scoreboardCache[league.id];
  if (cached && Date.now() - cached.time < 30_000) return cached.promise;

  const promise = getJSON(`${BASE}/${league.path}/scoreboard`)
    .then(data => data.events.map(toGame))
    .catch(() => []);   // if the scoreboard fails, we just won't have live updates
  scoreboardCache[league.id] = { time: Date.now(), promise };
  return promise;
}

// Everything the Home card needs for one team:
// { record: "2-2", standing: "3rd in NFC North", live, last, next }
// live / last / next are games (or null if there isn't one).
export async function fetchTeamSummary(league, teamId) {
  const [info, schedule, scoreboard] = await Promise.all([
    getJSON(`${BASE}/${league.path}/teams/${teamId}`),
    getJSON(`${BASE}/${league.path}/teams/${teamId}/schedule`),
    fetchScoreboard(league),
  ]);
  const team = info.team;

  // Collect every game we know about for this team, from all three sources.
  // Later sources replace earlier ones, so the scoreboard (freshest) wins.
  const games = new Map();
  const add = game => games.set(game.id, game);
  schedule.events.map(toGame).forEach(add);
  (team.nextEvent ?? []).map(toGame).forEach(add);
  scoreboard
    .filter(g => g.home.id === teamId || g.away.id === teamId)
    .forEach(add);

  const all = [...games.values()].sort((a, b) => a.date - b.date);

  return {
    record: team.record?.items?.[0]?.summary ?? "",
    standing: team.standingSummary ?? "",
    live: all.find(g => g.state === "in") ?? null,
    last: all.filter(g => g.state === "post").at(-1) ?? null,
    next: all.find(g => g.state === "pre") ?? null,
  };
}
