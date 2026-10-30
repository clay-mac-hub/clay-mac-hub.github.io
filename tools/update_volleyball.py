"""
update_volleyball.py — collects NCAA women's volleyball stats for the app.

ESPN shows volleyball scores but keeps no stats. The NCAA does, through the
free open-source "ncaa-api" project (ncaa-api.henrygd.me), but web pages
aren't allowed to read it directly. So a GitHub job runs this script every
30 minutes (see .github/workflows/volleyball.yml). It:

  1. downloads NCAA box scores for recent matches,
  2. matches each NCAA match and team to ESPN's (the app uses ESPN's ids),
  3. adds up season totals for every team and player,
  4. writes small JSON files the app reads:
       games/<espn match id>.json   one match's box score
       teams/<espn team id>.json    a team's season totals and players
       index.json                   when it last ran, and any teams it couldn't match

Run by hand (writes into the folder you name):
    python3 tools/update_volleyball.py OUTPUT_FOLDER               # last 2 days
    python3 tools/update_volleyball.py OUTPUT_FOLDER --since 2026-08-20   # rebuild the season
"""

import argparse
import datetime as dt
import json
import pathlib
import re
import time
import unicodedata
import urllib.request
from zoneinfo import ZoneInfo

NCAA = "https://ncaa-api.henrygd.me"
ESPN = "https://site.api.espn.com/apis/site/v2/sports/volleyball/womens-college-volleyball"
EASTERN = ZoneInfo("America/New_York")   # both NCAA and ESPN list matches by US Eastern date
PAUSE = 0.35   # seconds between NCAA requests, to be polite to the free service


# ---------- Downloading ----------

def get_json(url, tries=3):
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "CMac Sports volleyball stats"})
            with urllib.request.urlopen(req, timeout=30) as response:
                return json.load(response)
        except urllib.error.HTTPError as error:
            if error.code == 404:
                return None
            if attempt == tries - 1:
                raise
        except Exception:
            if attempt == tries - 1:
                raise
        time.sleep(2 * (attempt + 1))


def ncaa(path):
    time.sleep(PAUSE)
    return get_json(f"{NCAA}{path}")


# ---------- Matching NCAA names to ESPN teams ----------

# Short forms the NCAA uses for words in school names ("Central Mich.")
ABBREVIATIONS = {
    "st": "state", "mich": "michigan", "ill": "illinois", "ala": "alabama", "colo": "colorado",
    "conn": "connecticut", "ark": "arkansas", "mo": "missouri", "ga": "georgia", "fla": "florida",
    "ky": "kentucky", "tenn": "tennessee", "wash": "washington", "ore": "oregon", "ariz": "arizona",
    "miss": "mississippi", "okla": "oklahoma", "tex": "texas", "ind": "indiana", "wis": "wisconsin",
    "minn": "minnesota", "neb": "nebraska", "kan": "kansas", "mass": "massachusetts", "va": "virginia",
    "caro": "carolina", "pa": "pennsylvania", "calif": "california", "nev": "nevada", "mex": "mexico",
}

# Whole names that differ between the two sites (NCAA name -> ESPN name)
ALIASES = {
    "hawaii": "hawai i",
    "alcorn": "alcorn state",
    "csun": "cal state northridge",
    "niu": "northern illinois",
    "umes": "maryland eastern shore",
    "usc upstate": "south carolina upstate",
    "utrgv": "ut rio grande valley",
    "a and m corpus christi": "texas a and m corpus christi",
    "n c a and t": "north carolina a and t",
    "southern u": "southern",
    "pitt": "pittsburgh",
    "southern california": "usc",
    "fiu": "florida international",
    "liu": "long island university",
    "umass": "massachusetts",
    "fgcu": "florida gulf coast",
    "ucf": "ucf",
    "smu": "smu",
    "lmu": "loyola marymount",
    "siue": "siu edwardsville",
    "etsu": "east tennessee state",
    "ualr": "little rock",
    "uiw": "incarnate word",
    "central connecticut state": "central connecticut",
    "ulm": "ul monroe",
    "uni": "northern iowa",
}


def normalize(name):
    """'Central Mich.' -> 'central michigan' — lower case, no punctuation,
    abbreviations spelled out. Both sites' names go through this, so they
    end up looking the same."""
    # "San José" -> "San Jose": drop accents
    name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    name = name.lower().strip().replace("&", " and ").replace("'", " ").replace("\u2019", " ")
    name = re.sub(r"[^a-z0-9 ]", " ", name)
    words = [ABBREVIATIONS.get(word, word) for word in name.split()]
    words = [word for word in words if word not in ("university", "of", "the")]
    return " ".join(words)


def lookup_key(name):
    key = normalize(name)
    return normalize(ALIASES[key]) if key in ALIASES else key


class TeamMatcher:
    def __init__(self):
        data = get_json(f"{ESPN}/teams?limit=1000")
        self.by_name = {}
        self.names = {}
        for entry in data["sports"][0]["leagues"][0]["teams"]:
            team = entry["team"]
            if team["id"].startswith("-"):
                continue   # ESPN's "TBD" placeholders
            self.names[team["id"]] = team["displayName"]
            # ESPN's school name ("Central Michigan") is the main match; the
            # short name is a fallback
            for name in [team.get("location", ""), team.get("shortDisplayName", "")]:
                if name:
                    self.by_name.setdefault(normalize(name), team["id"])
        self.misses = set()

    def find(self, ncaa_names):
        """ncaa_names: {'short': 'Hawaii', 'seo': 'hawaii', 'char6': 'HAWAII'}"""
        candidates = [ncaa_names.get("short", ""), ncaa_names.get("seo", "").replace("-", " "),
                      ncaa_names.get("full", "")]
        for name in candidates:
            if not name:
                continue
            for key in (lookup_key(name), lookup_key(re.sub(r"\(.*?\)", "", name))):
                # second try: "Saint Mary's (CA)" without the bracketed state
                if key in self.by_name:
                    return self.by_name[key]
        self.misses.add(ncaa_names.get("short", "?"))
        return None


# ---------- Box scores ----------

STAT_FIELDS = ["kills", "attackErrors", "attackAttempts", "assists", "setErrors", "setAttempts",
               "serviceAces", "serviceErrors", "serveAttempts", "digs", "receptionAttempts",
               "receptionErrors", "blockSolos", "blockAssists", "blockingErrors",
               "ballHandlingErrors", "points"]


def number(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def player_key(first, last):
    return re.sub(r"[^a-z0-9]+", "-", f"{first} {last}".lower()).strip("-")


def trim_box(box, game):
    """Keep just what the app needs from an NCAA box score."""
    teams = []
    for side in box.get("teamBoxscore", []):
        # (team ids appear as text in one place and numbers in another, so
        # compare them as text)
        info = next((t for t in box.get("teams", [])
                     if str(t.get("teamId")) == str(side.get("teamId"))), {})
        totals = side.get("teamStats") or {}
        players = []
        for p in side.get("playerStats") or []:
            if p.get("participated") is False:
                continue
            players.append({
                "key": player_key(p.get("firstName", ""), p.get("lastName", "")),
                "name": f"{p.get('firstName', '')} {p.get('lastName', '')}".strip(),
                "number": p.get("number"),
                "position": p.get("position") or "",
                "starter": bool(p.get("starter")),
                "sets": number(p.get("gamesPlayed")),
                **{field: number(p.get(field)) for field in STAT_FIELDS},
            })
        teams.append({
            "ncaaTeamId": side.get("teamId"),
            "isHome": bool(info.get("isHome")),
            "name": info.get("nameShort", ""),
            "seo": info.get("seoname", ""),
            "sets": number(totals.get("gamesPlayed")),
            "totals": {field: number(totals.get(field)) for field in STAT_FIELDS},
            "bySet": [{"set": s.get("game"), "kills": number(s.get("kills")),
                       "attackErrors": number(s.get("attackErrors")),
                       "attackAttempts": number(s.get("attackAttempts"))}
                      for s in totals.get("sets") or []],
            "players": players,
        })
    return {"ncaaId": game["gameID"], "state": game.get("gameState"),
            "date": game.get("startDate"), "home": game["home"], "away": game["away"],
            "teams": teams}


# ---------- Season totals ----------

def hitting(kills, errors, attempts):
    return round((kills - errors) / attempts, 3) if attempts else 0.0


def season_totals(games):
    """Add up every finished match for each ESPN team and its players."""
    teams = {}
    for game in games:
        if game.get("state") != "final":
            continue
        sides = game["teams"]
        for side in sides:
            espn_id = side.get("espnTeamId")
            if not espn_id:
                continue
            other = next((s for s in sides if s is not side), None)
            team = teams.setdefault(espn_id, {"matches": 0, "wins": 0, "losses": 0, "sets": 0.0,
                                               "totals": {f: 0.0 for f in STAT_FIELDS},
                                               "opponent": {"kills": 0.0, "attackErrors": 0.0, "attackAttempts": 0.0},
                                               "players": {}})
            team["matches"] += 1
            team["sets"] += side["sets"]
            my_score = number((game["home"] if side["isHome"] else game["away"]).get("score"))
            their_score = number((game["away"] if side["isHome"] else game["home"]).get("score"))
            if my_score > their_score:
                team["wins"] += 1
            elif their_score > my_score:
                team["losses"] += 1
            for field in STAT_FIELDS:
                team["totals"][field] += side["totals"][field]
            if other:
                for field in team["opponent"]:
                    team["opponent"][field] += other["totals"][field]
            for p in side["players"]:
                player = team["players"].setdefault(p["key"], {
                    "key": p["key"], "name": p["name"], "number": p["number"], "position": p["position"],
                    "matches": 0, "sets": 0.0, **{f: 0.0 for f in STAT_FIELDS}})
                player["matches"] += 1
                player["sets"] += p["sets"]
                player["number"] = p["number"] or player["number"]
                player["position"] = p["position"] or player["position"]
                for field in STAT_FIELDS:
                    player[field] += p[field]
    return teams


# ---------- Main ----------

def eastern_dates(since, days):
    today = dt.datetime.now(EASTERN).date()
    start = dt.date.fromisoformat(since) if since else today - dt.timedelta(days=days - 1)
    day = start
    while day <= today:
        yield day
        day += dt.timedelta(days=1)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("out", help="folder to write the data files into")
    parser.add_argument("--since", help="rebuild from this date (YYYY-MM-DD)")
    parser.add_argument("--days", type=int, default=2, help="how many recent days to refresh")
    args = parser.parse_args()

    out = pathlib.Path(args.out)
    for folder in ["ncaa", "games", "teams"]:
        (out / folder).mkdir(parents=True, exist_ok=True)

    matcher = TeamMatcher()
    fetched = 0

    problems = 0
    for day in eastern_dates(args.since, args.days):
        try:
            board = ncaa(f"/scoreboard/volleyball-women/d1/{day:%Y/%m/%d}") or {}
            espn_board = get_json(f"{ESPN}/scoreboard?dates={day:%Y%m%d}&limit=400") or {}
        except Exception as error:
            # A temporary problem: skip this day; the next run will catch up
            print(f"Skipped {day}: {error}")
            problems += 1
            continue
        espn_events = []
        for event in espn_board.get("events", []):
            ids = {c["team"]["id"] for c in event["competitions"][0]["competitors"]}
            espn_events.append((event["id"], ids))

        for entry in board.get("games", []):
            game = entry["game"]
            state = game.get("gameState")
            if state not in ("final", "live"):
                continue
            saved = out / "ncaa" / f"{game['gameID']}.json"
            previous = json.loads(saved.read_text()) if saved.exists() else None
            if state == "final" and previous and previous.get("state") == "final":
                # Finished matches only need downloading once. If it wasn't
                # matched to ESPN last time, try matching it again.
                if previous.get("espnEventId"):
                    continue
                record = previous
            else:
                try:
                    box = ncaa(f"/game/{game['gameID']}/boxscore")
                except Exception as error:
                    print(f"Skipped match {game['gameID']}: {error}")
                    problems += 1
                    continue
                if not box or not box.get("teamBoxscore"):
                    continue
                fetched += 1
                record = trim_box(box, game)

            # Match both teams, then the ESPN match they played that day
            for side in record["teams"]:
                names = (game["home"] if side["isHome"] else game["away"]).get("names", {})
                side["espnTeamId"] = matcher.find(names)
            # Safety net: a match can't be one school playing itself
            if len(record["teams"]) == 2 and record["teams"][0]["espnTeamId"] == record["teams"][1]["espnTeamId"]:
                for side in record["teams"]:
                    side["espnTeamId"] = None
            ids = {side["espnTeamId"] for side in record["teams"]}
            record["espnEventId"] = next((event_id for event_id, event_ids in espn_events
                                          if ids <= event_ids and None not in ids), None)
            if not record["espnEventId"]:
                # One team unmatched: accept an ESPN match with the other team that day
                known = [i for i in ids if i]
                options = [event_id for event_id, event_ids in espn_events if known and set(known) <= event_ids]
                record["espnEventId"] = options[0] if len(options) == 1 else None

            saved.write_text(json.dumps(record, separators=(",", ":")))
            if record["espnEventId"]:
                app_game = {"updated": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
                            "state": record["state"], "teams": record["teams"]}
                (out / "games" / f"{record['espnEventId']}.json").write_text(
                    json.dumps(app_game, separators=(",", ":")))

    # Rebuild every team's season totals from all saved matches
    games = [json.loads(p.read_text()) for p in (out / "ncaa").glob("*.json")]
    for espn_id, team in season_totals(games).items():
        t = team["totals"]
        players = sorted(team["players"].values(), key=lambda p: -p["points"])
        for p in players:
            p["hittingPct"] = hitting(p["kills"], p["attackErrors"], p["attackAttempts"])
        (out / "teams" / f"{espn_id}.json").write_text(json.dumps({
            "name": matcher.names.get(espn_id, ""),
            "matches": team["matches"], "wins": team["wins"], "losses": team["losses"],
            "sets": team["sets"], "totals": t,
            "hittingPct": hitting(t["kills"], t["attackErrors"], t["attackAttempts"]),
            "opponentHittingPct": hitting(team["opponent"]["kills"], team["opponent"]["attackErrors"],
                                          team["opponent"]["attackAttempts"]),
            "players": players,
        }, separators=(",", ":")))

    matched = sum(1 for g in games if g.get("espnEventId"))
    (out / "index.json").write_text(json.dumps({
        "updated": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "matches": len(games), "matchedToEspn": matched,
        "unmatchedTeams": sorted(matcher.misses),
    }, indent=1))
    print(f"Downloaded {fetched} box scores; {len(games)} matches saved, {matched} matched to ESPN; "
          f"{problems} temporary problems (retried next run).")
    if matcher.misses:
        print("Couldn't match these NCAA team names to ESPN:", ", ".join(sorted(matcher.misses)))


if __name__ == "__main__":
    main()
