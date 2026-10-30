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
// { id, date, timeKnown, state, detail, broadcast, note, home: {...}, away: {...} }
// state is "pre" (not started), "in" (live) or "post" (finished).
// detail is ESPN's short status text, e.g. "Final", "Q3 5:12", "Halftime".
// note is ESPN's label for special games, e.g. "NLCS - Game 5 If Necessary".
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
    note: comp.notes?.[0]?.headline ?? "",
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
  return cachedJSON(url).then(data => toGames(data.events));
}

// Like getJSON, but reuses an answer from the last 30 seconds
function cachedJSON(url) {
  const cached = scoreboardCache[url];
  if (cached && Date.now() - cached.time < 30_000) return cached.promise;

  const promise = getJSON(url);
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
//
// The team's details (record, standing, logo…) come from the schedule too.
// (ESPN's separate team-info feed stopped allowing web pages to read it in
// October 2026, so the app no longer uses it.)
export async function fetchTeamGames(league, teamId) {
  const url = `${BASE}/${league.path}/teams/${teamId}/schedule`;
  const extra = league.path.startsWith("soccer") ? "fixture=true" : "seasontype=2";

  // Each download may fail on its own; we use whatever arrives
  const [schedule, moreSchedule, scoreboard] = await Promise.all([
    getJSON(url).catch(() => null),
    getJSON(`${url}?${extra}`).catch(() => null),
    // if the scoreboard fails, we just won't have the very latest live score
    fetchScoreboard(league).catch(() => []),
  ]);
  if (!schedule && !moreSchedule) throw new Error("Couldn't load this team's schedule");
  const team = schedule?.team ?? moreSchedule.team;

  // The plain schedule's record is for the current part of the season. If
  // that's an empty "0-0" (e.g. a team not in the playoffs), use the
  // regular-season record instead.
  const isEmpty = record => !record || /^0(-0)+$/.test(record);
  const record = [schedule?.team?.recordSummary, moreSchedule?.team?.recordSummary]
    .find(r => !isEmpty(r)) ?? "";

  // Collect every game from all the sources, without duplicates.
  // Later sources replace earlier ones, so the scoreboard (freshest) wins.
  const games = new Map();
  const add = game => games.set(game.id, game);
  toGames(schedule?.events).forEach(add);
  toGames(moreSchedule?.events).forEach(add);
  scoreboard
    .filter(g => g.home.id === teamId || g.away.id === teamId)
    .forEach(add);

  return {
    team: {
      id: team.id,
      name: team.displayName,
      abbr: team.abbreviation,
      color: team.color ? `#${team.color}` : "#888888",
      logo: team.logo ?? team.logos?.[0]?.href ?? "",
      record,
      standing: team.standingSummary ?? "",
    },
    games: [...games.values()].sort((a, b) => a.date - b.date),
  };
}

// Turn a list of ESPN events into games, skipping any ESPN describes in a
// way we can't read (e.g. a playoff game whose opponent isn't decided yet),
// so one odd game can't break a whole screen.
function toGames(events) {
  const games = [];
  for (const event of events ?? []) {
    try {
      games.push(toGame(event));
    } catch {
      // skip this one game
    }
  }
  return games;
}

// ---------- Game details ----------

// Player and season stats live on a second ESPN address
const WEB = "https://site.web.api.espn.com/apis/common/v3/sports";

// Everything about one game:
// { game,                      — the usual game shape (teams, score, status)
//   videos:    [{ headline, thumb, duration, hls, mp4 }],
//   events:    [{ minute, type, player, teamId }]   (soccer goals and cards)
//   teamStats: [{ label, away, home }],
//   teams:     [{ team: { id, name, abbr, logo }, groups: [
//                 { name, labels, descriptions, players: [
//                   { id, name, shortName, headshot, position, jersey, stats, starter }] }] }]
//   hasStats }  — false when ESPN keeps no stats for the sport (e.g. volleyball)
export async function fetchGame(league, eventId) {
  const data = await cachedJSON(`${BASE}/${league.path}/summary?event=${eventId}`);
  const comp = data.header.competitions[0];
  const game = toGame({ id: data.header.id, date: comp.date, competitions: [comp] });

  // Highlights. "hls" is a streaming version iPhones play natively: it adapts
  // to your connection instead of downloading one huge file.
  const videos = (data.videos ?? []).map(v => ({
    headline: v.headline ?? "",
    thumb: v.thumbnail ?? "",
    duration: v.duration ?? 0,
    hls: v.links?.source?.HLS?.href ?? "",
    mp4: v.links?.mobile?.source?.href ?? v.links?.source?.href ?? "",
  })).filter(v => v.hls || v.mp4);

  // Soccer: goals and cards, in order
  const SHOW = ["Goal", "Penalty - Scored", "Own Goal", "Yellow Card", "Red Card"];
  const events = (data.keyEvents ?? [])
    .filter(e => SHOW.some(type => (e.type?.text ?? "").startsWith(type)))
    .map(e => ({
      minute: e.clock?.displayValue ?? "",
      type: e.type.text,
      player: e.participants?.[0]?.athlete?.displayName ?? "",
      teamId: e.team?.id ?? "",
    }));

  return {
    game,
    videos,
    events,
    teamStats: teamStatRows(data.boxscore?.teams ?? []),
    // Soccer has lineups instead of a box score. (Baseball has lineup data
    // too, but its box score is the better source, so only soccer uses it.)
    teams: (league.path.startsWith("soccer") && data.rosters?.length
      ? soccerLineups(data.rosters)
      : boxScorePlayers(data.boxscore?.players ?? []))
      .filter(side => side.groups.length),   // skip teams with nothing to show
    hasStats: Boolean(data.boxscore?.teams?.some(t => t.statistics?.length) || data.rosters?.length),
  };
}

// Team stats side by side: [{ label: "Rebounds", away: "41", home: "38" }]
function teamStatRows(boxTeams) {
  // Some sports (baseball) nest their stats in groups; flatten those
  const flat = team => (team.statistics ?? []).flatMap(stat =>
    stat.stats ? stat.stats.map(inner => ({ ...inner, group: stat.name })) : [stat]);
  const away = boxTeams.find(t => t.homeAway === "away") ?? boxTeams[0];
  const home = boxTeams.find(t => t.homeAway === "home") ?? boxTeams[1];
  if (!away || !home) return [];

  const homeStats = flat(home);
  return flat(away)
    .filter(stat => stat.displayValue != null)
    .map(stat => {
      const match = homeStats.find(h => h.name === stat.name && h.group === stat.group);
      return {
        label: stat.label ?? stat.displayName ?? stat.name,
        away: stat.displayValue,
        home: match?.displayValue ?? "–",
      };
    });
}

function playerInfo(athlete) {
  return {
    id: athlete.id,
    name: athlete.displayName,
    shortName: athlete.shortName ?? athlete.displayName,
    headshot: athlete.headshot?.href ?? "",
    position: athlete.position?.abbreviation ?? "",
    jersey: athlete.jersey ?? "",
  };
}

// Box score (most sports): each team's players in groups like "Passing"
function boxScorePlayers(boxPlayers) {
  return boxPlayers.map(side => ({
    team: teamInfo(side.team),
    groups: (side.statistics ?? [])
      .map(group => ({
        name: groupName(group),
        labels: group.labels ?? [],
        descriptions: group.descriptions ?? [],
        players: (group.athletes ?? [])
          .filter(a => a.stats?.length)   // skip players who didn't play
          .map(a => ({ ...playerInfo(a.athlete), stats: a.stats, starter: a.starter === true })),
      }))
      .filter(group => group.players.length),
  }));
}

// A heading for a group of players, e.g. "Passing", "Batting", "Goalies"
const GROUP_NAMES = { defenses: "Defense", kickReturns: "Kick Returns", puntReturns: "Punt Returns" };

function groupName(group) {
  const raw = group.name ?? group.type ?? group.text;
  if (raw) {
    if (GROUP_NAMES[raw]) return GROUP_NAMES[raw];
    // "kickReturns" -> "Kick Returns"
    const words = raw.replace(/([a-z])([A-Z])/g, "$1 $2");
    return words.charAt(0).toUpperCase() + words.slice(1);
  }
  const labels = group.labels ?? [];
  if (labels.includes("IP")) return "Pitching";
  if (labels.includes("AB")) return "Batting";
  return "Players";
}

function teamInfo(team) {
  return {
    id: team.id,
    name: team.displayName,
    abbr: team.abbreviation,
    logo: team.logo ?? team.logos?.[0]?.href ?? "",
  };
}

// Soccer: starting XI and substitutes who came on, with their match stats
const SOCCER_COLUMNS = [
  ["G", "G", "Goals"], ["A", "A", "Assists"], ["SH", "SHOT", "Shots"],
  ["SOG", "SOG", "Shots on goal"], ["FC", "FC", "Fouls committed"],
  ["YC", "YC", "Yellow cards"], ["RC", "RC", "Red cards"],
];

function soccerLineups(rosters) {
  return rosters.map(side => {
    const toPlayer = a => {
      const lookup = {};
      for (const stat of a.stats ?? []) lookup[stat.abbreviation] = stat.displayValue;
      return {
        ...playerInfo(a.athlete),
        position: a.position?.abbreviation === "SUB" ? "" : (a.position?.abbreviation ?? ""),
        jersey: a.jersey ?? a.athlete.jersey ?? "",
        stats: SOCCER_COLUMNS.map(([, key]) => lookup[key] ?? "0"),
        starter: a.starter === true,
      };
    };
    const group = (name, list) => ({
      name,
      labels: SOCCER_COLUMNS.map(([label]) => label),
      descriptions: SOCCER_COLUMNS.map(([, , description]) => description),
      players: list.map(toPlayer),
    });
    const roster = side.roster ?? [];
    return {
      team: teamInfo(side.team),
      formation: side.formation ?? "",
      groups: [
        group("Starting XI", roster.filter(a => a.starter)),
        group("Substitutes", roster.filter(a => !a.starter && a.subbedIn)),
      ].filter(g => g.players.length),
    };
  });
}

// ---------- Players ----------

// A player's profile and season stats:
// { name, headshot, position, jersey, height, age, team: { id, name },
//   season: { labels, descriptions, splits: [{ name, stats }] } }
// splits are e.g. "Regular Season" and "Postseason" (soccer: one per competition)
export async function fetchPlayer(league, athleteId) {
  const url = `${WEB}/${league.path}/athletes/${athleteId}`;
  const [bio, overview] = await Promise.all([
    getJSON(url),
    getJSON(`${url}/overview`).catch(() => null),   // some players have no stats yet
  ]);
  const a = bio.athlete;
  const stats = overview?.statistics;

  return {
    name: a.displayName,
    headshot: a.headshot?.href ?? "",
    position: a.position?.displayName ?? a.position?.abbreviation ?? "",
    jersey: a.jersey ?? "",
    height: a.displayHeight ?? "",
    age: a.age ?? null,
    team: a.team ? { id: a.team.id, name: a.team.displayName } : null,
    season: stats ? {
      labels: stats.labels ?? [],
      descriptions: stats.displayNames ?? [],
      // "Projected" and "Career" aren't this year's real stats
      splits: (stats.splits ?? [])
        .filter(split => !/projected|career/i.test(split.displayName ?? ""))
        .map(split => ({ name: split.displayName, stats: split.stats ?? [] })),
    } : null,
  };
}

// ---------- Team season stats ----------

// { season: "2026", categories: [{ name: "Passing", stats: [{ label, value }] }] }
export async function fetchTeamStats(league, teamId) {
  if (league.path.startsWith("soccer")) return fetchSoccerTeamStats(league, teamId);
  const data = await getJSON(`${BASE}/${league.path}/teams/${teamId}/statistics`);
  const categories = (data.results?.stats?.categories ?? [])
    .map(category => ({
      name: category.displayName ?? category.name,
      stats: (category.stats ?? [])
        .filter(stat => stat.displayValue != null)
        .map(stat => ({ label: stat.displayName ?? stat.name, value: stat.displayValue })),
    }))
    .filter(category => category.stats.length);
  return {
    season: data.season?.displayName ?? data.requestedSeason?.displayName ?? "",
    categories,
  };
}

// ---------- Soccer team season stats ----------
// ESPN's usual team-stats feed is empty for soccer, but its "core" feed has
// 100+ stats per team. We show the ones fans look at most first, hide a few
// that are always blank, and tidy up percentages.

const CORE = "https://sports.core.api.espn.com/v2/sports";

// The stats to show first in each category, in order, with friendlier names
const SOCCER_FEATURED = {
  offensive: [["totalGoals", "Goals"], ["avgGoals", "Goals per game"],
    ["avgExpectedGoals", "Expected goals per game"], ["totalShots", "Shots"],
    ["shotsOnTarget", "Shots on target"], ["goalAssists", "Assists"],
    ["possessionPct", "Possession"], ["bigChanceCreated", "Big chances created"]],
  defensive: [["effectiveTackles", "Tackles won"], ["interceptions", "Interceptions"],
    ["blockedShots", "Shots blocked"], ["totalClearance", "Clearances"], ["recoveries", "Ball recoveries"]],
  goalKeeping: [["cleanSheet", "Clean sheets"], ["goalsConceded", "Goals conceded"],
    ["avgGoalsConceded", "Goals conceded per game"], ["saves", "Saves"], ["shotsFaced", "Shots faced"]],
  general: [["wins", "Wins"], ["losses", "Losses"], ["goalDifference", "Goal difference"],
    ["passPct", "Pass accuracy"], ["wonCorners", "Corners won"], ["foulsCommitted", "Fouls"],
    ["yellowCards", "Yellow cards"], ["redCards", "Red cards"]],
};
const SOCCER_CATEGORY_NAMES = {
  offensive: "Attacking", defensive: "Defense", goalKeeping: "Goalkeeping", general: "General",
};
// Always blank or not meaningful for a whole team. ("draws" is wrong in
// ESPN's feed — it says 0 even when a team has drawn — so it's left out;
// the standings have the correct record.)
const SOCCER_HIDDEN = /rating|^dnp$|^draws$|^minutes$|^starts$|^subIns$|^subOuts$|^suspensions$|shootOut|partialCleenSheet/i;

// The league's current season, e.g. "2026" for 2026-27 (remembered once found)
const soccerSeasons = {};
async function soccerSeason(slug) {
  if (!soccerSeasons[slug]) {
    const data = await getJSON(`${CORE}/soccer/leagues/${slug}/seasons?limit=1`);
    soccerSeasons[slug] = data.items[0].$ref.split("/seasons/")[1].split("?")[0];
  }
  return soccerSeasons[slug];
}

async function fetchSoccerTeamStats(league, teamId) {
  const slug = league.path.split("/")[1];   // "soccer/eng.1" -> "eng.1"
  const year = await soccerSeason(slug);
  const data = await getJSON(
    `${CORE}/soccer/leagues/${slug}/seasons/${year}/types/1/teams/${teamId}/statistics`);

  const categories = (data.splits?.categories ?? []).map(category => {
    const byName = {};
    for (const stat of category.stats ?? []) byName[stat.name] = stat;
    const featured = SOCCER_FEATURED[category.name] ?? [];
    const featuredNames = featured.map(([name]) => name);

    const shown = [
      ...featured.filter(([name]) => byName[name])
        .map(([name, label]) => ({ label, value: soccerValue(byName[name]) })),
      ...(category.stats ?? [])
        .filter(stat => !featuredNames.includes(stat.name) && !SOCCER_HIDDEN.test(stat.name))
        .map(stat => ({ label: stat.displayName ?? stat.name, value: soccerValue(stat) })),
    ];
    return { name: SOCCER_CATEGORY_NAMES[category.name] ?? category.displayName, stats: shown };
  }).filter(category => category.stats.length);

  // Attacking first, then defense, goalkeeping, general
  const order = ["Attacking", "Defense", "Goalkeeping", "General"];
  categories.sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name));

  const nextYear = String(Number(year) + 1).slice(2);
  return { season: `${year}-${nextYear}`, categories };
}

// Percentages: ESPN mixes 0.8 (meaning 80%) and 53.3 (meaning 53.3%)
function soccerValue(stat) {
  if (/pct$/i.test(stat.name)) {
    const number = Number(stat.value);
    if (!Number.isFinite(number)) return stat.displayValue;
    return `${Math.round((number <= 1 ? number * 100 : number) * 10) / 10}%`;
  }
  return stat.displayValue;
}

// ---------- Golf ----------

// Golf scores are written relative to par: "-3", "+2" or "E" (even).
// "-" or blank means "not played yet".
function parseToPar(text) {
  if (text === "E") return 0;
  const number = Number(text);
  return text && text !== "-" && Number.isFinite(number) ? number : null;
}

export function formatToPar(number) {
  if (number == null) return "";
  return number === 0 ? "E" : number > 0 ? `+${number}` : `${number}`;
}

// The current (or next) tournament on a tour, with its leaderboard:
// { id, name, start, end, course, city, purse, champion, state, detail, round,
//   players: [{ id, pos, name, shortName, flag, toPar, today, thru, state }] }
// state is "pre" (not started), "in" (being played) or "post" (finished).
export async function fetchLeaderboard(league) {
  const tour = league.path.split("/")[1];   // "golf/pga" -> "pga"
  const data = await cachedJSON(`${BASE}/golf/leaderboard?league=${tour}`);
  const event = data.events?.[0];
  if (!event) return null;   // no tournament scheduled

  const comp = event.competitions[0];
  const course = event.courses?.[0];
  const round = comp.status?.period ?? 0;
  const tournamentState = comp.status?.type?.state ?? "pre";

  let players = (comp.competitors ?? [])
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(player => {
      const status = player.status ?? {};
      const state = status.type?.state ?? "pre";
      const espnPos = status.position?.displayName ?? "";

      // TOTAL: add up every round played so far, INCLUDING the round in
      // progress. (ESPN's own total only counts finished rounds.)
      const roundScores = (player.linescores ?? [])
        .map(l => parseToPar(l.displayValue))
        .filter(score => score != null);
      let total = roundScores.length ? roundScores.reduce((a, b) => a + b, 0) : null;
      // Hasn't teed off in round 1 yet, but the tournament has started: even par
      if (total == null && tournamentState !== "pre") total = 0;

      // This round's score to par, e.g. "-3"
      const today = parseToPar(player.linescores?.find(l => l.period === round)?.displayValue);

      // "Thru 12" while playing, "F" when done, their tee time before starting
      let thru = status.displayValue ?? "";
      if (state === "pre" && status.teeTime) {
        thru = new Date(status.teeTime)
          .toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
      }

      return {
        id: player.id,
        espnPos,
        // Still competing? (Not "CUT", "WD", "DQ"…) Only these get re-ranked.
        inContention: espnPos === "" || /^T?\d+$/.test(espnPos),
        total,
        name: player.athlete.displayName,
        shortName: player.athlete.shortName ?? player.athlete.displayName,   // "K. Mitchell"
        flag: player.athlete.flag?.href ?? "",
        toPar: formatToPar(total),
        today: formatToPar(today),
        thru,
        state,
      };
    });

  players = rankPlayers(players);

  return {
    id: event.id,
    tour,
    name: event.name,
    start: new Date(event.date),
    end: new Date(event.endDate),
    course: course?.name ?? "",
    city: [course?.address?.city, course?.address?.state ?? course?.address?.country]
      .filter(Boolean).join(", "),
    purse: event.displayPurse ?? "",
    champion: event.defendingChampion?.athlete?.displayName ?? "",
    state: tournamentState,
    detail: comp.status?.type?.detail ?? "",
    round,
    players,
  };
}

// Put players in order of their up-to-the-minute totals and number them,
// with "T" for ties (T3, T3, T3, then 6). Players who were cut or withdrew
// stay at the bottom with ESPN's label ("CUT", "WD"…).
function rankPlayers(players) {
  const ranked = players.filter(p => p.inContention && p.total != null);
  const others = players.filter(p => !(p.inContention && p.total != null));
  if (ranked.length === 0) return players.map(p => ({ ...p, pos: p.espnPos }));

  ranked.sort((a, b) => a.total - b.total);   // keeps ESPN's order for ties
  for (const player of ranked) {
    const better = ranked.filter(p => p.total < player.total).length;
    const tied = ranked.filter(p => p.total === player.total).length;
    player.pos = `${tied > 1 ? "T" : ""}${better + 1}`;
  }
  for (const player of others) player.pos = player.espnPos;
  return [...ranked, ...others];
}

// One golfer's hole-by-hole scorecard for every round of a tournament:
// { name, headshot, age,
//   rounds: [{ number, strokes, toPar, teeTime, startTee,
//              holes: [{ hole, par, strokes }], stats: { birdies, bogeys, … } }] }
export async function fetchScorecard(tour, eventId, playerId) {
  const data = await cachedJSON(
    `${BASE}/golf/${tour}/leaderboard/${eventId}/playersummary?player=${playerId}`);

  const rounds = (data.rounds ?? []).map(round => {
    // Birdies, bogeys etc. for the round, as a simple lookup
    const stats = {};
    for (const stat of round.statistics?.categories?.[0]?.stats ?? []) {
      stats[stat.name] = stat.value;
    }
    return {
      number: round.period,
      strokes: round.value || null,
      toPar: round.displayValue ?? "",
      teeTime: round.teeTime ? new Date(round.teeTime) : null,
      startTee: round.startTee ?? 1,
      holes: (round.linescores ?? [])
        .map(h => ({ hole: h.period, par: h.par ?? null, strokes: h.value ?? null }))
        .sort((a, b) => a.hole - b.hole),
      stats,
    };
  }).sort((a, b) => a.number - b.number);

  return {
    name: data.profile?.displayName ?? "",
    headshot: data.profile?.headshot ?? "",
    age: data.profile?.age ?? null,
    rounds,
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
