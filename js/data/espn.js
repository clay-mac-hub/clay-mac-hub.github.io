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
    // College teams have a ranking; 99 means "not in the Top 25"
    const rank = c.curatedRank?.current;
    return {
      id: c.team.id,
      name: c.team.displayName,
      shortName: c.team.shortDisplayName ?? c.team.displayName,
      abbr: c.team.abbreviation,
      rank: rank && rank <= 25 ? rank : null,
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

// A league's scoreboard: every game on one day (or, with no date, ESPN's
// "current" games — today, or this week for football).
// Downloads are reused for 30 seconds, so several screens or favorite teams
// in the same league share one.
const scoreboardCache = {};

export function fetchScoreboard(league, date = null) {
  const params = [];
  if (date) params.push(`dates=${espnDate(date)}`);
  if (league.scoreboardQuery) params.push(league.scoreboardQuery);
  const url = `${BASE}/${league.path}/scoreboard?${params.join("&")}`;

  const cached = scoreboardCache[url];
  if (cached && Date.now() - cached.time < 30_000) return cached.promise;

  const promise = getJSON(url).then(data => data.events.map(toGame));
  promise.catch(() => delete scoreboardCache[url]);   // don't remember failures
  scoreboardCache[url] = { time: Date.now(), promise };
  return promise;
}

// Forget saved scoreboards, so the next request gets brand-new scores.
// Called when you refresh.
export function clearScoreCache() {
  for (const url in scoreboardCache) delete scoreboardCache[url];
}

// ESPN wants dates written like 20261011 (year, month, day)
function espnDate(date) {
  const two = n => String(n).padStart(2, "0");
  return `${date.getFullYear()}${two(date.getMonth() + 1)}${two(date.getDate())}`;
}

// One team's info plus all its games this season, oldest first:
// { team: { id, name, abbr, color, logo, record, standing }, games: [...] }
//
// ESPN's plain schedule doesn't always cover everything (e.g. NBA preseason
// only, or soccer past results only), so we also ask for the regular season
// (or upcoming soccer fixtures) and combine the two.
export async function fetchTeamGames(league, teamId) {
  const url = `${BASE}/${league.path}/teams/${teamId}`;
  const extra = league.path.startsWith("soccer") ? "fixture=true" : "seasontype=2";

  const [info, schedule, moreSchedule, scoreboard] = await Promise.all([
    getJSON(url),
    getJSON(`${url}/schedule`),
    getJSON(`${url}/schedule?${extra}`).catch(() => ({ events: [] })),
    // if the scoreboard fails, we just won't have the very latest live score
    fetchScoreboard(league).catch(() => []),
  ]);
  const team = info.team;

  // Collect every game from all the sources, without duplicates.
  // Later sources replace earlier ones, so the scoreboard (freshest) wins.
  const games = new Map();
  const add = game => games.set(game.id, game);
  schedule.events.map(toGame).forEach(add);
  moreSchedule.events.map(toGame).forEach(add);
  (team.nextEvent ?? []).map(toGame).forEach(add);
  scoreboard
    .filter(g => g.home.id === teamId || g.away.id === teamId)
    .forEach(add);

  return {
    team: {
      id: team.id,
      name: team.displayName,
      abbr: team.abbreviation,
      color: team.color ? `#${team.color}` : "#888888",
      logo: team.logos?.[0]?.href ?? "",
      record: team.record?.items?.[0]?.summary ?? "",
      standing: team.standingSummary ?? "",
    },
    games: [...games.values()].sort((a, b) => a.date - b.date),
  };
}

// Everything the Home card needs for one team:
// { record: "2-2", standing: "3rd in NFC North", live, last, next }
// live / last / next are games (or null if there isn't one).
export async function fetchTeamSummary(league, teamId) {
  const { team, games } = await fetchTeamGames(league, teamId);
  return {
    record: team.record,
    standing: team.standing,
    live: games.find(g => g.state === "in") ?? null,
    last: games.filter(g => g.state === "post").at(-1) ?? null,
    next: games.find(g => g.state === "pre") ?? null,
  };
}

// ---------- Standings ----------

// A league's standings, ready to draw:
// { season: "2026", groups: [{ name: "NFC North", rows: [{ team, stats }] }] }
// stats is a lookup like { wins: "4", losses: "0", winpercent: "1.000", ... }
export async function fetchStandings(league) {
  const level = league.divisions ? "?level=3" : "";
  const data = await getJSON(
    `https://site.api.espn.com/apis/v2/sports/${league.path}/standings${level}`);

  // Standings are nested (league > conference > division). Walk down the
  // tree and collect every group that actually has teams in it.
  const groups = [];
  let season = "";
  const walk = node => {
    const entries = node.standings?.entries;
    if (entries?.length) {
      season ||= node.standings.seasonDisplayName ?? "";
      groups.push({ name: node.name, rows: entries.map(toStandingRow) });
    }
    (node.children ?? []).forEach(walk);
  };
  walk(data);

  for (const group of groups) group.rows.sort(standingsOrder(league.sortBy));
  return { season, groups };
}

function toStandingRow(entry) {
  const stats = {};
  for (const stat of entry.stats) stats[stat.type] = stat.displayValue;
  return {
    team: {
      id: entry.team.id,
      name: entry.team.shortDisplayName ?? entry.team.displayName,
      logo: entry.team.logos?.[0]?.href ?? "",
    },
    stats,
  };
}

// Returns a "compare two rows" function for sorting
function standingsOrder(sortBy) {
  const num = (row, key) => parseFloat(row.stats[key]) || 0;
  if (sortBy === "rank") {
    return (a, b) => num(a, "rank") - num(b, "rank");
  }
  if (sortBy === "conference") {
    // Best conference win % first; ties broken by overall wins
    return (a, b) => num(b, "leaguewinpercent") - num(a, "leaguewinpercent")
                  || num(b, "wins") - num(a, "wins");
  }
  // "seed": playoff seed 1 first (0 means no seed, so put those last)
  return (a, b) => (num(a, "playoffseed") || 99) - (num(b, "playoffseed") || 99);
}
